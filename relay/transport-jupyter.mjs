// Everything the relay knows about reaching the GPU worker: the Radeon gateway, its cookies, and the job folder
// layout under /workspace/jobs/<id>/ (request.json, status.json, out.mp4, worker.heartbeat) moved through the
// Jupyter Contents API. The instance has no other way in, and its egress proxy blocks outbound calls to us.
//
// Auth: the gateway in front of Jupyter wants a cookie that the dashboard's "Open notebook" link
// (/api/notebook/open) sets on the way to /instances/<id>/lab. Given the dashboard session cookie
// (RADEON_SESSION, ~2 weeks), the relay follows that link itself whenever the gateway turns it away, so the
// Jupyter cookie never has to be copied by hand. The same redirect also tells us the current instance URL.

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const MAX_REDIRECTS = 10;
const LOGIN_COOLDOWN_MS = 30_000;

// Minimal cookie jar: enough for a redirect chain across *.anruicloud.com. Ignores Path and Expires.
class CookieJar {
  #cookies = new Map(); // `${domain}|${name}` -> { name, value, domain, hostOnly }

  set(url, header) {
    const [pair, ...attrs] = header.split(';');
    const eq = pair.indexOf('=');
    if (eq < 1) return;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const attr = key => attrs.map(a => a.trim()).find(a => a.toLowerCase().startsWith(`${key}=`))?.slice(key.length + 1);
    const domainAttr = attr('domain');
    const domain = domainAttr ? domainAttr.replace(/^\./, '').toLowerCase() : new URL(url).hostname;
    const key = `${domain}|${name}`;
    const maxAge = attr('max-age');
    const expires = attr('expires');
    // Servers delete cookies with Max-Age<=0 or an Expires date in the past.
    const expired = maxAge !== undefined ? Number(maxAge) <= 0 : expires !== undefined && Date.parse(expires) < Date.now();
    if (expired) this.#cookies.delete(key);
    else this.#cookies.set(key, { name, value, domain, hostOnly: !domainAttr });
  }

  // A raw "a=1; b=2" string, as pasted from DevTools, scoped to one host.
  setRaw(url, raw) {
    for (const pair of raw.split(';')) if (pair.includes('=')) this.set(url, pair.trim());
  }

  header(url) {
    const host = new URL(url).hostname;
    return [...this.#cookies.values()]
      .filter(c => c.hostOnly ? host === c.domain : host === c.domain || host.endsWith(`.${c.domain}`))
      .map(c => `${c.name}=${c.value}`).join('; ');
  }

  get(name) {
    for (const c of this.#cookies.values()) if (c.name === name) return c.value;
  }
}

export function createJupyterTransport(env) {
  const dashboard = (env.RADEON_DASHBOARD_URL || 'https://radeon-global.anruicloud.com').replace(/\/+$/, '');
  const session = (env.RADEON_SESSION || '').trim();
  let base = (env.JUPYTER_URL || '').replace(/\/+(lab.*)?$/, ''); // https://jupyter.../instances/<id>
  const jar = new CookieJar();
  if (session) jar.set(dashboard, session.includes('=') ? session : `__Host-oneclick-manager=${session}`);
  if (base && env.JUPYTER_COOKIE) jar.setRaw(base, env.JUPYTER_COOKIE);
  if (!session && !(base && env.JUPYTER_COOKIE))
    throw new Error('Set RADEON_SESSION (or JUPYTER_URL + JUPYTER_COOKIE) in relay/.env.local (see relay/.env.example).');

  let login = null; // in-flight login promise, shared by concurrent requests
  let lastLogin = 0;
  let authState = base && env.JUPYTER_COOKIE ? 'unknown' : 'logged-out';

  // Follows "Open notebook" the way the browser does, collecting cookies at every hop. The gateway hands off
  // through jupyter.../_auth/start#request=… or #ticket=…: a page whose script POSTs that one fragment value
  // back to /_auth/start as a form (fetch never sends fragments, so we replay the script's POST).
  async function openNotebook() {
    let url = `${dashboard}/api/notebook/open`;
    let form = null;
    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
      let response;
      try {
        const init = form
          ? { method: 'POST', body: new URLSearchParams(form), headers: { Origin: new URL(url).origin, Referer: new URL('/_auth/start', url).href } }
          : { headers: {} };
        init.headers.Cookie = jar.header(url);
        response = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(20_000) });
      } catch (error) {
        throw new HttpError(502, `Can't reach the Radeon dashboard: ${error.cause?.code || error.message}`);
      }
      if (env.RELAY_DEBUG) // names only: the values are credentials
        console.log(`[relay] login hop ${form ? 'POST' : 'GET'} ${new URL(url).host}${new URL(url).pathname} -> ${response.status}`,
          response.headers.getSetCookie().map(c => [c.split('=')[0], ...c.split(';').slice(1).map(a => a.trim())].join(' ')).join(', '));
      form = null;
      for (const header of response.headers.getSetCookie()) jar.set(url, header);
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel();
        const next = new URL(location, url);
        const handoff = new URLSearchParams(next.hash.slice(1));
        if (next.pathname === '/_auth/start' && handoff.size === 1 && (handoff.has('request') || handoff.has('ticket')))
          form = Object.fromEntries(handoff);
        next.hash = '';
        url = next.href;
        continue;
      }
      // After the POST, the gateway sets its cookie and moves on with a script redirect plus a <noscript> link.
      if (response.ok && new URL(url).pathname === '/_auth/start') {
        const link = (await response.text()).match(/<a href="([^"]+)"/)?.[1];
        if (link) {
          url = new URL(link.replaceAll('&amp;', '&'), url).href;
          continue;
        }
        throw new HttpError(502, 'The gateway login page changed: no link to JupyterLab after the handoff.');
      }
      await response.body?.cancel();
      const match = new URL(url).pathname.match(/^(\/instances\/[^/]+)\/lab/);
      if (response.ok && match) {
        base = new URL(match[1], url).href;
        return;
      }
      authState = 'expired';
      throw new HttpError(502, new URL(url).hostname === new URL(dashboard).hostname
        ? `The Radeon dashboard didn't open the notebook (${response.status} at ${new URL(url).pathname}). Its session may have expired: log in again and refresh RADEON_SESSION in relay/.env.local. Is the instance running?`
        : `"Open notebook" ended at ${new URL(url).host}${new URL(url).pathname} (${response.status}) instead of JupyterLab.`);
    }
    authState = 'expired';
    throw new HttpError(502, 'Too many redirects while opening the notebook. The dashboard session may have expired: refresh RADEON_SESSION in relay/.env.local.');
  }

  async function relogin() {
    if (!session) {
      authState = 'expired';
      throw new HttpError(502, 'Jupyter rejected the relay. Re-open the notebook from the Radeon dashboard and refresh JUPYTER_COOKIE, or set RADEON_SESSION so the relay can do it.');
    }
    if (!login) {
      login = openNotebook().then(() => {
        lastLogin = Date.now();
        authState = 'ok';
        console.log(`[relay] opened the notebook via the dashboard -> ${base}`);
      }).finally(() => { login = null; });
    }
    return login;
  }

  // `stream: true` limits the timeout to the response headers, so a long video download isn't cut off.
  async function upstream(path, { stream = false, retry = true, ...init } = {}) {
    if (!base) await relogin();
    const url = base + path;
    // The gateway's nginx rejects writes without a same-origin Origin header, as a CSRF check.
    const xsrf = jar.get('_xsrf');
    const headers = { Cookie: jar.header(url), Origin: new URL(url).origin, ...(xsrf && { 'X-XSRFToken': xsrf }), ...init.headers };
    let response;
    // Campus Wi-Fi DNS fails now and then (EAI_AGAIN). Nothing was sent yet, so retrying is safe even for writes.
    for (let attempt = 1; ; attempt++) {
      try {
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(new Error('timed out')), 60_000);
        try {
          response = await fetch(url, { ...init, headers, redirect: 'manual', signal: abort.signal });
        } finally {
          if (stream) clearTimeout(timer);
        }
        break;
      } catch (error) {
        if (error.cause?.code === 'EAI_AGAIN' && attempt < 4) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw new HttpError(502, `Can't reach the Jupyter instance: ${error.cause?.code || error.message}`);
      }
    }
    for (const header of response.headers.getSetCookie()) jar.set(url, header);
    // The gateway answers a missing or expired cookie with 403 or a redirect to the dashboard.
    if ([401, 403].includes(response.status) || (response.status >= 300 && response.status < 400)) {
      await response.body?.cancel();
      if (retry && Date.now() - lastLogin > LOGIN_COOLDOWN_MS) {
        await relogin();
        return upstream(path, { stream, retry: false, ...init });
      }
      authState = 'expired';
      throw new HttpError(502, 'Jupyter still rejects the relay after opening the notebook. Is the instance running?');
    }
    if (authState !== 'ok' && response.ok) authState = 'ok';
    return response;
  }

  const contentsPath = path => `/api/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

  async function putContents(path, model) {
    const response = await upstream(contentsPath(path), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(model),
    });
    if (!response.ok) throw new HttpError(502, `Upload to the instance failed (${response.status}).`);
  }

  // Parsed JSON for a small text file, or null if it doesn't exist.
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

  return {
    describe: () => base || `${dashboard} (instance URL found at first request)`,
    authState: () => authState,

    // files: { field: { name, bytes } }; returns the request with each field set to its file name on the instance.
    async submitJob(jobId, request, files) {
      const dir = `jobs/${jobId}`;
      await putContents(dir, { type: 'directory' });
      for (const [field, { name, bytes }] of Object.entries(files)) {
        await putContents(`${dir}/${name}`, { type: 'file', format: 'base64', content: Buffer.from(bytes).toString('base64') });
        request = { ...request, [field]: name };
      }
      // request.json is the worker's "ready" marker, so it goes last.
      await putContents(`${dir}/request.json`, { type: 'file', format: 'text', content: JSON.stringify(request) });
      return request;
    },
    readRequest: jobId => readJson(`jobs/${jobId}/request.json`),
    readStatus: jobId => readJson(`jobs/${jobId}/status.json`),
    writeStatus: (jobId, body) => putContents(`jobs/${jobId}/status.json`, { type: 'file', format: 'text', content: JSON.stringify(body) }),
    jobExists: jobId => exists(`jobs/${jobId}/request.json`),

    async heartbeatAge() {
      const beat = await readJson('jobs/worker.heartbeat');
      return beat ? Date.now() / 1000 - beat.time : Infinity;
    },

    // A fetch Response for a file in the job folder (supports Range); throws 404 if it isn't there.
    async openFile(jobId, file, range) {
      const response = await upstream(`/files/jobs/${jobId}/${file}`, { stream: true, headers: range ? { Range: range } : {} });
      if (response.status === 404) throw new HttpError(404, 'Output not found.');
      if (!response.ok) throw new HttpError(502, `Fetching ${file} failed (${response.status}).`);
      return response;
    },
  };
}
