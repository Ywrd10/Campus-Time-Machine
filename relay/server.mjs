// Laptop-side relay between the Vite frontend and the GPU worker on the AMD Jupyter instance.
// Serves the frontend contract (see README "Suggested backend contract") and moves jobs through
// /workspace/jobs/<id>/ via the Jupyter Contents API. Node built-ins only.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { existsSync } from 'node:fs';

const envFile = new URL('./.env.local', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

const PORT = Number(process.env.PORT || 8000);
const UPSTREAM = (process.env.JUPYTER_URL || '').replace(/\/+(lab.*)?$/, '');
const COOKIE = process.env.JUPYTER_COOKIE || '';
const XSRF = process.env.JUPYTER_XSRF || '';
const HEARTBEAT_STALE_S = 60;
const MODES = ['text', 'image', 'audio'];
const LIMITS = { image: 15, finalFrame: 15, audio: 32 }; // MB, same as the frontend
const EXTENSIONS = { image: /\.(png|jpe?g|webp)$/i, finalFrame: /\.(png|jpe?g|webp)$/i, audio: /\.(mp3|wav|m4a|ogg)$/i };
const JOB_ID = /^[0-9a-f-]{36}$/;
const AUTH_HINT = 'Jupyter rejected the relay. Re-open the notebook from the Radeon dashboard and refresh JUPYTER_COOKIE in relay/.env.local.';

if (!UPSTREAM || !COOKIE) {
  console.error('Set JUPYTER_URL and JUPYTER_COOKIE in relay/.env.local (see relay/.env.example).');
  process.exit(1);
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function upstream(path, init = {}) {
  const headers = { Cookie: COOKIE, ...(XSRF && { 'X-XSRFToken': XSRF }), ...init.headers };
  let response;
  try {
    response = await fetch(UPSTREAM + path, { ...init, headers, redirect: 'manual', signal: AbortSignal.timeout(60_000) });
  } catch (error) {
    throw new HttpError(502, `Can't reach the Jupyter instance: ${error.cause?.code || error.message}`);
  }
  // The gateway answers an expired cookie with 403 or a redirect to the dashboard login.
  if ([401, 403].includes(response.status) || (response.status >= 300 && response.status < 400))
    throw new HttpError(502, AUTH_HINT);
  return response;
}

const contentsPath = path => `/api/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

async function putContents(path, model) {
  const response = await upstream(contentsPath(path), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(model),
  });
  if (!response.ok) throw new HttpError(502, `Upload to the instance failed (${response.status}).`);
}

// Returns parsed JSON for a small text file, or null if it doesn't exist.
async function readJson(path) {
  const response = await upstream(`${contentsPath(path)}?content=1&format=text&type=file`);
  if (response.status === 404) return null;
  if (!response.ok) throw new HttpError(502, `Reading ${path} from the instance failed (${response.status}).`);
  return JSON.parse((await response.json()).content);
}

async function exists(path) {
  const response = await upstream(`${contentsPath(path)}?content=0`);
  if (response.status === 404) return false;
  if (!response.ok) throw new HttpError(502, `Checking ${path} on the instance failed (${response.status}).`);
  return true;
}

async function workerHeartbeatAge() {
  const beat = await readJson('jobs/worker.heartbeat');
  return beat ? Date.now() / 1000 - beat.time : Infinity;
}

function parseRequestField(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { throw new HttpError(400, 'The "request" field must be JSON.'); }
  if (!data || typeof data !== 'object') throw new HttpError(400, 'The "request" field must be a JSON object.');
  const { mode, prompt = '', model, width, height, fps, durationSeconds } = data;
  if (!MODES.includes(mode)) throw new HttpError(400, 'Unknown generation mode.');
  if (typeof prompt !== 'string' || prompt.length > 5000) throw new HttpError(400, 'Keep your prompt under 5,000 characters.');
  if (mode !== 'image' && !prompt.trim()) throw new HttpError(400, 'Describe the scene you want to create.');
  for (const [key, value] of Object.entries({ width, height, fps, durationSeconds }))
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new HttpError(400, `Invalid ${key}.`);
  return { mode, prompt: prompt.trim(), model: String(model || ''), width, height, fps, durationSeconds };
}

async function createGeneration(req) {
  let form;
  try {
    form = await new Request('http://relay/', { method: 'POST', headers: req.headers, body: Readable.toWeb(req), duplex: 'half' }).formData();
  } catch {
    throw new HttpError(400, 'Expected a multipart form body.');
  }
  const request = parseRequestField(form.get('request'));
  const files = {};
  for (const field of ['image', 'finalFrame', 'audio']) {
    const file = form.get(field);
    if (!(file instanceof File) || file.size === 0) continue;
    if (!EXTENSIONS[field].test(file.name)) throw new HttpError(400, `Unsupported ${field} file type.`);
    if (file.size > LIMITS[field] * 1024 * 1024) throw new HttpError(400, `The ${field} file must be smaller than ${LIMITS[field]} MB.`);
    files[field] = file;
  }
  if (request.mode === 'image' && !files.image) throw new HttpError(400, 'Upload a source image first.');
  if (request.mode === 'audio' && !files.audio) throw new HttpError(400, 'Upload an audio file first.');

  const jobId = randomUUID();
  const createdAt = new Date().toISOString();
  const dir = `jobs/${jobId}`;
  await putContents(dir, { type: 'directory' });
  for (const [field, file] of Object.entries(files)) {
    const name = `${field}.${file.name.split('.').pop().toLowerCase()}`;
    const content = Buffer.from(await file.arrayBuffer()).toString('base64');
    await putContents(`${dir}/${name}`, { type: 'file', format: 'base64', content });
    request[field] = name;
  }
  // request.json is the worker's "ready" marker, so it goes last.
  await putContents(`${dir}/request.json`, { type: 'file', format: 'text', content: JSON.stringify({ ...request, jobId, createdAt }) });
  console.log(`[relay] queued ${jobId} (${request.mode}) ${JSON.stringify(request.prompt.slice(0, 60))}`);
  return { jobId, createdAt };
}

const statusCache = new Map(); // jobId -> { at, body }

async function getGeneration(jobId) {
  const cached = statusCache.get(jobId);
  if (cached && Date.now() - cached.at < 2000) return cached.body;
  const status = await readJson(`jobs/${jobId}/status.json`);
  let body;
  if (status) {
    body = { jobId, status: status.status, progress: status.progress };
    if (status.error) body.error = status.error;
    if (status.status === 'completed' && status.output) {
      const { seed, prompt, ...output } = status.output;
      body.output = { ...output, url: `/api/outputs/${jobId}.mp4`, filename: `knight-studio-${jobId.slice(0, 8)}.mp4` };
    }
  } else {
    if (!(await exists(`jobs/${jobId}/request.json`))) throw new HttpError(404, 'Unknown job. It may have expired; generate again.');
    const age = await workerHeartbeatAge();
    if (age > HEARTBEAT_STALE_S) {
      body = { jobId, status: 'failed', error: 'The GPU worker is offline. Start worker.py on the instance, then generate again.' };
      // Persist it so a worker that comes back later doesn't spend GPU time on a job nobody is watching.
      await putContents(`jobs/${jobId}/status.json`, { type: 'file', format: 'text', content: JSON.stringify(body) });
    } else {
      body = { jobId, status: 'queued', progress: 0 };
    }
  }
  statusCache.set(jobId, { at: Date.now(), body });
  if (statusCache.size > 200) statusCache.delete(statusCache.keys().next().value);
  return body;
}

async function streamOutput(req, res, jobId) {
  const range = req.headers.range;
  const response = await upstream(`/files/jobs/${jobId}/out.mp4`, { headers: range ? { Range: range } : {} });
  if (response.status === 404) throw new HttpError(404, 'Output not found.');
  if (!response.ok) throw new HttpError(502, `Fetching the video failed (${response.status}).`);
  const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' };
  for (const name of ['content-length', 'content-range']) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  res.writeHead(response.status, headers);
  Readable.fromWeb(response.body).pipe(res);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://relay');
  let match;
  try {
    if (req.method === 'POST' && pathname === '/api/generations') {
      sendJson(res, 202, await createGeneration(req));
    } else if (req.method === 'GET' && (match = pathname.match(/^\/api\/generations\/([^/]+)$/))) {
      if (!JOB_ID.test(match[1])) throw new HttpError(404, 'Unknown job.');
      sendJson(res, 200, await getGeneration(match[1]));
    } else if (req.method === 'GET' && (match = pathname.match(/^\/api\/outputs\/([^/]+)\.mp4$/))) {
      if (!JOB_ID.test(match[1])) throw new HttpError(404, 'Output not found.');
      await streamOutput(req, res, match[1]);
    } else if (req.method === 'GET' && pathname === '/api/health') {
      const age = await workerHeartbeatAge();
      sendJson(res, 200, { relay: 'ok', worker: age <= HEARTBEAT_STALE_S ? 'online' : 'offline', heartbeatAgeSeconds: Number.isFinite(age) ? Math.round(age) : null });
    } else {
      throw new HttpError(404, 'Not found.');
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error('[relay]', req.method, pathname, error.message);
    if (!res.headersSent) sendJson(res, status, { error: error.message });
    else res.destroy();
  }
}).listen(PORT, '127.0.0.1', () => console.log(`[relay] http://127.0.0.1:${PORT}/api -> ${UPSTREAM}`));
