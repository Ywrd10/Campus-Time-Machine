// Laptop-side relay between the Vite frontend and the GPU worker on the AMD Jupyter instance.
// Serves the frontend contract (see docs/api.md); transport-jupyter.mjs moves jobs to
// the instance and handles the gateway login. Node built-ins only; Node >= 22.18 so the shared
// TypeScript preset/prompt files can be imported directly (type stripping).
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Readable, pipeline } from 'node:stream';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { HttpError, createJupyterTransport } from './transport-jupyter.mjs';
import { createBucketStorage } from './storage.mjs';
import { DURATIONS, RESOLUTIONS, STEPS, dimensions } from '../src/lib/capabilities.ts';
import { MOMENTS, buildShots } from '../src/timeMachine/moments.ts';
import { PLACES, placeView } from '../src/timeMachine/places.ts';
import { DEFAULT_JOURNEY_QUALITY, journeyQuality } from '../src/timeMachine/quality.ts';

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
const PUBLIC_DIR = new URL('../public/', import.meta.url);
const WALL_FILE = new URL('./wall.json', import.meta.url); // local index of timeline jobs, newest first
// Finished clips are copied here once, so replays (the wall, the demo) don't depend on the gateway.
const CACHE_DIR = new URL('./cache/', import.meta.url);

let instance, storage;
try {
  instance = createJupyterTransport(process.env);
  storage = createBucketStorage(process.env);
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
  const quality = journeyQuality(form.get('quality') ?? DEFAULT_JOURNEY_QUALITY);
  if (!quality) throw new HttpError(400, 'Choose a supported video quality: quick, standard, or high.');
  let image = formFile(form, 'image');
  let place, view;
  if (!image) {
    place = PLACES.find(place => place.id === form.get('place'));
    if (!place) throw new HttpError(400, 'Choose a campus place or upload a photo.');
    view = placeView(place, form.get('view'));
    if (!view) throw new HttpError(400, `There’s no photo of ${place.name} yet. Upload one, or add it under public/places.`);
    image = new File([await readFile(new URL(`.${view.photo}`, PUBLIC_DIR))], view.photo.split('/').pop());
  }
  const [{ prompt }] = buildShots(moment, view?.description || 'the UCF campus', 'snapshot');
  const placeName = place?.name || 'Your campus photo';
  const timeline = { place: placeName, moment: moment.id, length, quality: quality.id };
  const preset = { model: quality.model, width: quality.width, height: quality.height, fps: 24, durationSeconds: 3 };
  // Moment prompts go in as written: the expander adds camera moves ("the camera pans slowly to the right") that
  // pull away from the photo, and it turned the rocket into a static tower. Measured side by side, 2026-10-10.
  const request = withPreset(preset);
  const { jobId, createdAt } = await queueJob({ mode: 'image', prompt, ...request, bench: { ...request.bench, enhance: false }, timeline }, { image });
  const wall = await readWallIndex();
  await writeFile(WALL_FILE, JSON.stringify([{ id: jobId, place: placeName, moment: moment.id }, ...wall].slice(0, 200)));
  // The journey is already queued, so a bucket outage only costs it its place on the shared wall.
  storage?.putJson(recordKey(jobId), { id: jobId, place: placeName, moment: moment.id, quality: quality.id, createdAt, status: 'pending' })
    .catch(error => console.error('[relay] bucket record', jobId, error.message));
  return { jobId };
}

const requestCache = new Map(); // jobId -> request.json (immutable once written)

async function readRequest(jobId) {
  if (!requestCache.has(jobId)) requestCache.set(jobId, await instance.readRequest(jobId));
  return requestCache.get(jobId);
}

async function getTimeline(jobId) {
  let job;
  try {
    job = await getGeneration(jobId);
  } catch (error) {
    // The instance may be gone; an archived journey still plays from the bucket.
    const record = storage && await storage.getJson(recordKey(jobId)).catch(() => null);
    if (record?.status !== 'completed') throw error;
    return timelineFromRecord(record);
  }
  if (job.status === 'completed') {
    archiveJourney(jobId, job);
    if (archived.has(jobId)) return timelineFromRecord(archived.get(jobId));
  }
  const image = (await readRequest(jobId))?.image;
  return {
    ...job,
    shots: [{ phase: 'arrive', status: job.status, progress: job.progress, output: job.output, thumbnail: job.finalFrameUrl }],
    ...(image && { beforeImageUrl: `/api/outputs/${jobId}/${image}` }),
  };
}

async function readWallIndex() {
  try { return JSON.parse(await readFile(WALL_FILE, 'utf8')); } catch { return []; }
}

let wallCache;

async function getWall() {
  if (wallCache && Date.now() - wallCache.at < 15_000) return wallCache.body;
  if (storage) {
    wallCache = { at: Date.now(), body: await getRemoteWall() };
    return wallCache.body;
  }
  const entries = (await readWallIndex()).slice(0, 48);
  const jobs = await Promise.all(entries.map(entry => getGeneration(entry.id).catch(() => null)));
  const body = entries.flatMap((entry, i) => jobs[i]?.status === 'completed' ? [{ ...entry, url: jobs[i].output.url, ...(jobs[i].finalFrameUrl && { thumbnail: jobs[i].finalFrameUrl }) }] : []);
  wallCache = { at: Date.now(), body };
  return body;
}

// Remote storage (relay/storage.mjs): each journey is journeys/<id>.json in the bucket, written as pending when it's
// queued and completed once its clip, last frame and source photo are uploaded next to it. The bucket is then the
// wall's source of truth, so the wall and finished clips outlive this laptop and the GPU instance.
const recordKey = jobId => `journeys/${jobId}.json`;
const archived = new Map(); // jobId -> completed record
const archiving = new Map(); // jobId -> in-flight upload

function timelineFromRecord(record) {
  return {
    jobId: record.id, status: 'completed', progress: 100, output: record.output,
    ...(record.thumbnail && { finalFrameUrl: record.thumbnail }),
    shots: [{ phase: 'arrive', status: 'completed', progress: 100, output: record.output, thumbnail: record.thumbnail }],
    ...(record.beforeImageUrl && { beforeImageUrl: record.beforeImageUrl }),
  };
}

async function readOutput(jobId, file) {
  if (CACHED_FILES.includes(file) && existsSync(cachedPath(jobId, file))) return readFile(cachedPath(jobId, file));
  return Buffer.from(await (await instance.openFile(jobId, file)).arrayBuffer());
}

// Uploads a completed journey's files and marks its record completed. Idempotent; jobs without a record
// (Free mode) are left alone.
function archiveJourney(jobId, job) {
  if (!storage || archived.has(jobId)) return Promise.resolve();
  if (!archiving.has(jobId)) archiving.set(jobId, (async () => {
    const record = await storage.getJson(recordKey(jobId));
    if (!record) return;
    if (record.status === 'completed') return void archived.set(jobId, record);
    const upload = async (file, key) => {
      await storage.put(key, await readOutput(jobId, file), CONTENT_TYPES[file.split('.').pop()]);
      return storage.url(key);
    };
    const url = await upload('out.mp4', `journeys/${jobId}.mp4`);
    const thumbnail = job.finalFrameUrl && await upload('last.png', `journeys/${jobId}-last.png`);
    const image = (await readRequest(jobId))?.image;
    const beforeImageUrl = image && await upload(image, `journeys/${jobId}-before.${image.split('.').pop()}`);
    const done = { ...record, status: 'completed', completedAt: new Date().toISOString(), output: { ...job.output, url }, url, thumbnail, beforeImageUrl };
    await storage.putJson(recordKey(jobId), done);
    archived.set(jobId, done);
    console.log(`[relay] archived ${jobId} to ${storage.describe()}`);
  })().catch(error => console.error('[relay] archiving', jobId, error.message)).finally(() => archiving.delete(jobId)));
  return archiving.get(jobId);
}

// Pending records are checked against the instance: completed ones show up right away (served by the relay
// until their upload lands), failed or vanished ones are marked failed so they're skipped from then on.
async function getRemoteWall() {
  const files = (await storage.list('journeys')).filter(file => file.path.endsWith('.json'))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 96);
  const records = await Promise.all(files.map(async file => {
    const id = file.path.slice('journeys/'.length, -'.json'.length);
    const record = archived.get(id) ?? await storage.getJson(file.path).catch(() => null);
    if (record?.status === 'completed') archived.set(id, record);
    if (record?.status !== 'pending') return record;
    try {
      const job = await getGeneration(id);
      if (job.status === 'completed') {
        archiveJourney(id, job);
        return { ...record, status: 'completed', url: job.output.url, thumbnail: job.finalFrameUrl };
      }
      if (job.status === 'failed') storage.putJson(file.path, { ...record, status: 'failed' }).catch(() => {});
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) storage.putJson(file.path, { ...record, status: 'failed' }).catch(() => {});
    }
    return record;
  }));
  return records.filter(record => record?.status === 'completed')
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 48)
    .map(({ id, place, moment, url, thumbnail }) => ({ id, place, moment, url, ...(thumbnail && { thumbnail }) }));
}

// Journeys made while the relay ran without a bucket (relay/wall.json) get a pending record, so the wall
// above archives them like any other.
async function backfillBucket() {
  const known = new Set((await storage.list('journeys')).map(file => file.path));
  for (const entry of await readWallIndex()) {
    if (known.has(recordKey(entry.id))) continue;
    const request = await readRequest(entry.id).catch(() => null);
    if (!request) continue;
    await storage.putJson(recordKey(entry.id), { ...entry, quality: request.timeline?.quality, createdAt: request.createdAt, status: 'pending' });
    console.log(`[relay] backfilled ${entry.id} to ${storage.describe()}`);
  }
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
      const { seed, prompt, finalFrame, ...output } = status.output;
      body.output = { ...output, url: `/api/outputs/${jobId}.mp4`, filename: `knight-studio-${jobId.slice(0, 8)}.mp4` };
      cacheOutput(jobId, 'out.mp4');
      // The clip's last frame (last.png); jobs from before the worker wrote it have none.
      if (finalFrame === 'last.png') {
        body.finalFrameUrl = `/api/outputs/${jobId}/last.png`;
        cacheOutput(jobId, 'last.png');
      }
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

const CACHED_FILES = ['out.mp4', 'last.png'];
const cachedPath = (jobId, file) => new URL(file === 'out.mp4' ? `${jobId}.mp4` : `${jobId}-${file}`, CACHE_DIR);
const caching = new Set();

// Copies a finished clip's files to relay/cache/ in the background; until they land, they stream from the instance.
function cacheOutput(jobId, file) {
  const path = cachedPath(jobId, file);
  if (caching.has(path.href) || existsSync(path)) return;
  caching.add(path.href);
  (async () => {
    const response = await instance.openFile(jobId, file);
    await mkdir(CACHE_DIR, { recursive: true });
    const tmp = new URL(`${path.href}.tmp`);
    await writeFile(tmp, Readable.fromWeb(response.body));
    await rename(tmp, path);
  })().catch(error => console.error('[relay] caching', jobId, file, error.message)).finally(() => caching.delete(path.href));
}

// Serves a cached file with Range support (browsers seek <video> with Range requests).
async function sendCached(req, res, path, contentType) {
  const { size } = await stat(path);
  const headers = { 'Content-Type': contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' };
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
  if (CACHED_FILES.includes(file) && existsSync(cachedPath(jobId, file)))
    return sendCached(req, res, cachedPath(jobId, file), CONTENT_TYPES[file.split('.').pop()]);
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
    } else if (req.method === 'GET' && (match = pathname.match(/^\/api\/outputs\/([^/]+)\/(image\.(?:png|jpe?g|webp)|last\.png)$/))) {
      // The uploaded source photo and the clip's last frame, for the Time Machine before/after view.
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
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[relay] http://127.0.0.1:${PORT}/api -> ${instance.describe()}; journeys -> ${storage?.describe() ?? 'relay/wall.json only'}`);
  storage && backfillBucket().catch(error => console.error('[relay] backfill', error.message));
});
