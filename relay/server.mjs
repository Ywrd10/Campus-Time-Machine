// Laptop-side relay between the Vite frontend and the GPU worker on the AMD Jupyter instance.
// Serves the frontend contract (see README "Suggested backend contract"); transport-jupyter.mjs moves jobs to
// the instance and handles the gateway login. Node built-ins only; Node >= 22.18 so the shared
// TypeScript preset/prompt files can be imported directly (type stripping).
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Readable, pipeline } from 'node:stream';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { HttpError, createJupyterTransport } from './transport-jupyter.mjs';
import { DURATIONS, RESOLUTIONS, STEPS, dimensions } from '../src/lib/capabilities.ts';
import { MOMENTS, buildShots } from '../src/timeMachine/moments.ts';
import { PLACES } from '../src/timeMachine/places.ts';

const envFile = new URL('./.env.local', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

const PORT = Number(process.env.PORT || 8000);
const HEARTBEAT_STALE_S = 60;
const MODES = ['text', 'image'];
const LIMITS = { image: 15, finalFrame: 15, audio: 32 }; // MB, same as the frontend
const EXTENSIONS = { image: /\.(png|jpe?g|webp)$/i, finalFrame: /\.(png|jpe?g|webp)$/i, audio: /\.(mp3|wav|m4a|ogg)$/i };
const JOB_ID = /^[0-9a-f-]{36}$/;
// Every size the frontend offers, both orientations, e.g. "640x352".
const SIZES = RESOLUTIONS.flatMap(resolution => ['16:9', '9:16'].map(aspectRatio => dimensions({ resolution, aspectRatio })));
// Time Machine snapshot: the fastest tested preset that keeps full-volume audio (~50 s plus prompt expansion).
const SNAPSHOT = { model: 'k6-lite-quality', width: 640, height: 352, fps: 24, durationSeconds: 3 };
const PUBLIC_DIR = new URL('../public/', import.meta.url);
const WALL_FILE = new URL('./wall.json', import.meta.url); // local index of timeline jobs, newest first
// Finished clips are copied here once, so replays (the wall, the demo) don't depend on the gateway.
const CACHE_DIR = new URL('./cache/', import.meta.url);

let instance;
try {
  instance = createJupyterTransport(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function parseRequestField(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { throw new HttpError(400, 'The "request" field must be JSON.'); }
  if (!data || typeof data !== 'object') throw new HttpError(400, 'The "request" field must be a JSON object.');
  const { mode, prompt = '', model, width, height, fps, durationSeconds } = data;
  if (!MODES.includes(mode)) throw new HttpError(400, 'Unknown generation mode.');
  if (typeof prompt !== 'string' || prompt.length > 5000) throw new HttpError(400, 'Keep your prompt under 5,000 characters.');
  if (mode !== 'image' && !prompt.trim()) throw new HttpError(400, 'Describe the scene you want to create.');
  return { mode, prompt: prompt.trim(), ...withPreset({ model, width, height, fps, durationSeconds }) };
}

// Accept only the presets rendered on the instance (src/lib/capabilities.ts) and pass the exact size and step
// count to the worker as `bench`; on its own the worker would pick 864x480 at 10 steps for every request.
function withPreset({ model, width, height, fps, durationSeconds }) {
  const size = SIZES.find(([w, h]) => w === width && h === height);
  if (!Object.hasOwn(STEPS, model) || !size || fps !== 24 || !DURATIONS.includes(durationSeconds))
    throw new HttpError(400, `Choose a tested preset: ${SIZES.map(s => s.join('×')).join(', ')} at 24 FPS, ${DURATIONS.join('/')} seconds.`);
  return { model, width, height, fps, durationSeconds, bench: { size, steps: STEPS[model] } };
}

async function readForm(req) {
  try {
    return await new Request('http://relay/', { method: 'POST', headers: req.headers, body: Readable.toWeb(req), duplex: 'half' }).formData();
  } catch {
    throw new HttpError(400, 'Expected a multipart form body.');
  }
}

function formFile(form, field) {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  if (!EXTENSIONS[field].test(file.name)) throw new HttpError(400, `Unsupported ${field} file type.`);
  if (file.size > LIMITS[field] * 1024 * 1024) throw new HttpError(400, `The ${field} file must be smaller than ${LIMITS[field]} MB.`);
  return file;
}

async function createGeneration(req) {
  const form = await readForm(req);
  const request = parseRequestField(form.get('request'));
  const files = {};
  for (const field of ['image', 'finalFrame', 'audio']) {
    const file = formFile(form, field);
    if (file) files[field] = file;
  }
  if (request.mode === 'image' && !files.image) throw new HttpError(400, 'Upload a source image first.');
  return queueJob(request, files);
}

async function queueJob(request, files) {
  const jobId = randomUUID();
  const createdAt = new Date().toISOString();
  const uploads = {};
  for (const [field, file] of Object.entries(files))
    uploads[field] = { name: `${field}.${file.name.split('.').pop().toLowerCase()}`, bytes: await file.arrayBuffer() };
  await instance.submitJob(jobId, { ...request, jobId, createdAt }, uploads);
  console.log(`[relay] queued ${jobId} (${request.mode}) ${JSON.stringify(request.prompt.slice(0, 60))}`);
  return { jobId, createdAt };
}

// Time Machine Snapshot: one image->video shot of the place at the chosen moment. Film (three chained shots)
// needs the worker to start each shot from the previous one's last frame, which it doesn't do yet.
async function createTimeline(req) {
  const form = await readForm(req);
  const moment = MOMENTS.find(moment => moment.id === form.get('moment'));
  if (!moment) throw new HttpError(400, 'Choose a destination moment.');
  const length = form.get('length');
  if (length === 'film') throw new HttpError(400, 'Film journeys aren’t supported by the GPU worker yet. Choose Snapshot.');
  if (length !== 'snapshot') throw new HttpError(400, 'Choose Snapshot or Film.');
  let image = formFile(form, 'image');
  let place;
  if (!image) {
    place = PLACES.find(place => place.id === form.get('place'));
    if (!place) throw new HttpError(400, 'Choose a campus place or upload a photo.');
    if (!place.photo) throw new HttpError(400, `There’s no photo of ${place.name} yet. Upload one, or add it under public/places.`);
    image = new File([await readFile(new URL(`.${place.photo}`, PUBLIC_DIR))], place.photo.split('/').pop());
  }
  const [{ prompt }] = buildShots(moment, place?.description || 'campus', 'snapshot');
  const placeName = place?.name || 'Your campus photo';
  const timeline = { place: placeName, moment: moment.id, length };
  const { jobId } = await queueJob({ mode: 'image', prompt, ...withPreset(SNAPSHOT), timeline }, { image });
  const wall = await readWallIndex();
  await writeFile(WALL_FILE, JSON.stringify([{ id: jobId, place: placeName, moment: moment.id }, ...wall].slice(0, 200)));
  return { jobId };
}

const requestCache = new Map(); // jobId -> request.json (immutable once written)

async function getTimeline(jobId) {
  const job = await getGeneration(jobId);
  if (!requestCache.has(jobId)) requestCache.set(jobId, await instance.readRequest(jobId));
  const image = requestCache.get(jobId)?.image;
  return {
    ...job,
    shots: [{ phase: 'arrive', status: job.status, progress: job.progress, output: job.output }],
    ...(image && { beforeImageUrl: `/api/outputs/${jobId}/${image}` }),
  };
}

async function readWallIndex() {
  try { return JSON.parse(await readFile(WALL_FILE, 'utf8')); } catch { return []; }
}

let wallCache;

async function getWall() {
  if (wallCache && Date.now() - wallCache.at < 15_000) return wallCache.body;
  const entries = (await readWallIndex()).slice(0, 48);
  const jobs = await Promise.all(entries.map(entry => getGeneration(entry.id).catch(() => null)));
  const body = entries.flatMap((entry, i) => jobs[i]?.status === 'completed' ? [{ ...entry, url: jobs[i].output.url }] : []);
  wallCache = { at: Date.now(), body };
  return body;
}

const statusCache = new Map(); // jobId -> { at, body }

async function getGeneration(jobId) {
  const cached = statusCache.get(jobId);
  // Finished jobs never change; others are re-read at most every 2 s.
  if (cached && (['completed', 'failed'].includes(cached.body.status) || Date.now() - cached.at < 2000)) return cached.body;
  const status = await instance.readStatus(jobId);
  let body;
  if (status) {
    body = { jobId, status: status.status, progress: status.progress };
    if (status.error) body.error = status.error;
    if (status.status === 'completed' && status.output) {
      const { seed, prompt, ...output } = status.output;
      body.output = { ...output, url: `/api/outputs/${jobId}.mp4`, filename: `knight-studio-${jobId.slice(0, 8)}.mp4` };
      cacheOutput(jobId);
    }
  } else {
    if (!(await instance.jobExists(jobId))) throw new HttpError(404, 'Unknown job. It may have expired; generate again.');
    const age = await instance.heartbeatAge();
    if (age > HEARTBEAT_STALE_S) {
      body = { jobId, status: 'failed', error: 'The GPU worker is offline. Start worker_k6.py on the instance, then generate again.' };
      // Persist it so a worker that comes back later doesn't spend GPU time on a job nobody is watching.
      await instance.writeStatus(jobId, body);
    } else {
      body = { jobId, status: 'queued', progress: 0 };
    }
  }
  statusCache.set(jobId, { at: Date.now(), body });
  if (statusCache.size > 200) statusCache.delete(statusCache.keys().next().value);
  return body;
}

const cachedPath = jobId => new URL(`${jobId}.mp4`, CACHE_DIR);
const caching = new Set();

// Copies a finished clip to relay/cache/ in the background; until it lands, outputs stream from the instance.
function cacheOutput(jobId) {
  if (caching.has(jobId) || existsSync(cachedPath(jobId))) return;
  caching.add(jobId);
  (async () => {
    const response = await instance.openFile(jobId, 'out.mp4');
    await mkdir(CACHE_DIR, { recursive: true });
    const tmp = new URL(`${jobId}.mp4.tmp`, CACHE_DIR);
    await writeFile(tmp, Readable.fromWeb(response.body));
    await rename(tmp, cachedPath(jobId));
  })().catch(error => console.error('[relay] caching', jobId, error.message)).finally(() => caching.delete(jobId));
}

// Serves a cached clip with Range support (browsers seek <video> with Range requests).
async function sendCached(req, res, path) {
  const { size } = await stat(path);
  const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' };
  const match = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0, end = size - 1, status = 200;
  if (match && (match[1] || match[2])) {
    start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      return res.end();
    }
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = end - start + 1;
  res.writeHead(status, headers);
  pipeline(createReadStream(path, { start, end }), res, () => {});
}

const CONTENT_TYPES = { mp4: 'video/mp4', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

async function streamOutput(req, res, jobId, file) {
  if (file === 'out.mp4' && existsSync(cachedPath(jobId))) return sendCached(req, res, cachedPath(jobId));
  const response = await instance.openFile(jobId, file, req.headers.range);
  const headers = { 'Content-Type': CONTENT_TYPES[file.split('.').pop()], 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' };
  for (const name of ['content-length', 'content-range']) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  res.writeHead(response.status, headers);
  // A dropped browser connection or upstream error ends this response only, not the relay.
  pipeline(Readable.fromWeb(response.body), res, error => {
    if (error && error.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error('[relay] stream', jobId, file, error.message);
  });
}

// Tells "the gateway won't let us in" apart from "the worker isn't running".
async function getHealth() {
  try {
    const age = await instance.heartbeatAge();
    return { relay: 'ok', instance: 'ok', worker: age <= HEARTBEAT_STALE_S ? 'online' : 'offline', heartbeatAgeSeconds: Number.isFinite(age) ? Math.round(age) : null };
  } catch (error) {
    return { relay: 'ok', instance: instance.authState() === 'expired' ? 'login-expired' : 'unreachable', worker: 'unknown', error: error.message };
  }
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
      await streamOutput(req, res, match[1], 'out.mp4');
    } else if (req.method === 'GET' && (match = pathname.match(/^\/api\/outputs\/([^/]+)\/(image\.(?:png|jpe?g|webp))$/))) {
      // The uploaded source photo, for the Time Machine before/after view.
      if (!JOB_ID.test(match[1])) throw new HttpError(404, 'Output not found.');
      await streamOutput(req, res, match[1], match[2]);
    } else if (req.method === 'POST' && pathname === '/api/timelines') {
      sendJson(res, 202, await createTimeline(req));
    } else if (req.method === 'GET' && (match = pathname.match(/^\/api\/timelines\/([^/]+)$/))) {
      if (!JOB_ID.test(match[1])) throw new HttpError(404, 'Unknown journey.');
      sendJson(res, 200, await getTimeline(match[1]));
    } else if (req.method === 'GET' && pathname === '/api/wall') {
      sendJson(res, 200, await getWall());
    } else if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, await getHealth());
    } else {
      throw new HttpError(404, 'Not found.');
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error('[relay]', req.method, pathname, error.message);
    if (!res.headersSent) sendJson(res, status, { error: error.message });
    else res.destroy();
  }
}).listen(PORT, '127.0.0.1', () => console.log(`[relay] http://127.0.0.1:${PORT}/api -> ${instance.describe()}`));
