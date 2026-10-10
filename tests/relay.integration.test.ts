import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { HttpTimelineService } from '../src/services/timeline';
import { HttpGenerationService } from '../src/services/generation';
import { DEFAULT_SETTINGS } from '../src/lib/capabilities';

// Exercise the actual relay through the frontend adapters, without cloud credentials or GPU usage.
// Copy it to a disposable directory so its Wall index never touches the user's real relay data.
let temp: string;
let relay: ChildProcess;
let upstream: Server;
let base: string;
const files = new Map<string, { content?: string; format?: string }>();
const queued: Record<string, unknown>[] = [];
const output = { mimeType: 'video/mp4', width: 640, height: 352, fps: 24, durationSeconds: 3.042 };
async function listen(server: Server): Promise<number> {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as { port: number }).port;
}
async function close(server?: Server) {
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
beforeAll(async () => {
  const video = await readFile(resolve('public/demo.mp4'));
  upstream = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url!, 'http://fixture').pathname);
    const json = (body: unknown, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.headers.cookie !== 'test=fixture' || !req.headers.origin) { json({}, 403); return; }
    if (path.startsWith('/api/contents/')) {
      const file = path.slice('/api/contents/'.length);
      if (req.method === 'PUT') {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const model = JSON.parse(Buffer.concat(chunks).toString()); files.set(file, model);
        if (file.endsWith('/request.json')) {
          const job = JSON.parse(model.content); queued.push(job);
          files.set(file.replace('request.json', 'status.json'), { content: JSON.stringify({ status: 'completed', progress: 100, output }) });
        }
        json(model, 201); return;
      }
      if (file === 'jobs/worker.heartbeat') { json({ content: JSON.stringify({ time: Date.now() / 1000 }) }); return; }
      const model = files.get(file); json(model || {}, model ? 200 : 404); return;
    }
    if (path.startsWith('/files/jobs/')) {
      const source = files.get(path.slice('/files/'.length));
      const body = path.endsWith('/out.mp4') ? video : Buffer.from(source?.content || '', 'base64');
      const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      const start = range ? Number(range[1]) : 0;
      const end = range?.[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
      res.writeHead(range ? 206 : 200, { 'Content-Length': end - start + 1, ...(range ? { 'Content-Range': `bytes ${start}-${end}/${body.length}` } : {}) });
      res.end(body.subarray(start, end + 1)); return;
    }
    json({}, 404);
  });
  const upstreamPort = await listen(upstream);
  const reservation = createServer(); const port = await listen(reservation); await close(reservation);
  temp = await mkdtemp(join(tmpdir(), 'knight-relay-test-'));
  for (const file of ['relay/server.mjs', 'src/lib/capabilities.ts', 'src/timeMachine/places.ts', 'src/timeMachine/moments.ts']) {
    const target = join(temp, file); await mkdir(dirname(target), { recursive: true }); await copyFile(resolve(file), target);
  }
  base = `http://127.0.0.1:${port}/api`;
  relay = spawn(process.execPath, [join(temp, 'relay/server.mjs')], { cwd: temp, windowsHide: true,
    env: { ...process.env, PORT: String(port), JUPYTER_URL: `http://127.0.0.1:${upstreamPort}`, JUPYTER_COOKIE: 'test=fixture', JUPYTER_XSRF: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Relay fixture did not start')), 10000);
    relay.once('error', error => { clearTimeout(timeout); reject(error); });
    relay.once('exit', code => { clearTimeout(timeout); reject(new Error(`Relay exited: ${code}`)); });
    relay.stdout!.on('data', chunk => { if (chunk.toString().includes('[relay] http')) { clearTimeout(timeout); resolve(); } });
  });
  vi.stubGlobal('window', { location: { origin: `http://127.0.0.1:${port}` } });
}, 20000);
afterAll(async () => {
  if (relay && relay.exitCode === null) { const stopped = new Promise<void>(resolve => relay.once('exit', () => resolve())); relay.kill(); await stopped; }
  await close(upstream); vi.unstubAllGlobals();
  if (temp && dirname(temp) === tmpdir() && basename(temp).startsWith('knight-relay-test-')) await rm(temp, { recursive: true, force: true });
});

it('keeps waypoint snapshots, Wall, source images, video seeking, and Free mode connected to the relay', async () => {
  expect(await (await fetch(`${base}/health`)).json()).toMatchObject({ relay: 'ok', worker: 'online' });
  const timeline = new HttpTimelineService(base);
  const image = new File(['source-photo-fixture'], 'campus.jpg', { type: 'image/jpeg' });
  const submitted = await timeline.submit({ image, moment: 'future', length: 'snapshot' });
  const job = await timeline.getStatus(submitted.jobId);
  expect(job).toMatchObject({ status: 'completed', shots: [{ phase: 'arrive', status: 'completed' }], output });
  expect(queued[0]).toMatchObject({ mode: 'image', bench: { size: [640, 352], steps: 10 }, timeline: { moment: 'future', length: 'snapshot' } });
  expect(queued[0].prompt).toContain('2125');
  expect((await timeline.getWall())[0].id).toBe(submitted.jobId);
  const origin = new URL(base).origin;
  expect(await (await fetch(origin + job.beforeImageUrl)).text()).toBe('source-photo-fixture');
  const media = await fetch(origin + job.output!.url, { headers: { Range: 'bytes=0-31' } });
  expect(media.status).toBe(206); expect(media.headers.get('content-type')).toBe('video/mp4'); expect((await media.arrayBuffer()).byteLength).toBe(32);
  await expect(timeline.submit({ image, moment: 'future', length: 'film' })).rejects.toThrow('Film');
  await expect(timeline.submit({ place: 'student-union', moment: 'future', length: 'snapshot' })).rejects.toThrow('photo');
  const studio = new HttpGenerationService(base);
  const free = await studio.submit({ mode: 'text', prompt: 'A purple campus at dusk.', settings: DEFAULT_SETTINGS });
  expect((await studio.getStatus(free.jobId)).output).toMatchObject(output);
  expect(queued[1]).toMatchObject({ mode: 'text', width: 640, height: 352, fps: 24, durationSeconds: 3 });
}, 20000);
