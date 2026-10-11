// Remote storage for finished journeys: a public Hugging Face Storage Bucket. Writes go through HF's
// S3-compatible gateway (SigV4-signed with the bucket's HFAK key); reads use the public Hub URLs, which need no
// credentials and which the browser can play directly (they redirect to the CDN and honor Range).
// Without HF_BUCKET/HF_S3_KEY_ID/HF_S3_SECRET, createBucketStorage returns null and the relay stays local-only.
import { createHash, createHmac } from 'node:crypto';

const S3_ENDPOINT = 'https://s3.hf.co';
const REGION = 'us-east-1'; // the gateway is single-region

const sha256 = data => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
// S3 canonical URIs encode each path segment, including the characters encodeURIComponent leaves alone.
const encodeKey = key => key.split('/').map(part => encodeURIComponent(part).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');

export function createBucketStorage(env) {
  const { HF_BUCKET: bucketId, HF_S3_KEY_ID: keyId, HF_S3_SECRET: secret } = env;
  if (!bucketId && !keyId && !secret) return null;
  if (!bucketId?.includes('/') || !keyId || !secret)
    throw new Error('Remote storage needs HF_BUCKET (namespace/bucket), HF_S3_KEY_ID and HF_S3_SECRET in relay/.env.local.');
  const hubBase = `https://huggingface.co/buckets/${bucketId}`;
  const apiBase = `https://huggingface.co/api/buckets/${bucketId}`;

  async function s3(method, key, body = '', contentType) {
    const url = new URL(`${S3_ENDPOINT}/${bucketId}/${encodeKey(key)}`);
    const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
    const date = amzDate.slice(0, 8);
    const headers = { host: url.host, 'x-amz-content-sha256': sha256(body), 'x-amz-date': amzDate };
    if (contentType) headers['content-type'] = contentType;
    const names = Object.keys(headers).sort();
    const signedHeaders = names.join(';');
    const canonical = [method, url.pathname, '', ...names.map(name => `${name}:${headers[name]}`), '', signedHeaders, headers['x-amz-content-sha256']].join('\n');
    const scope = `${date}/${REGION}/s3/aws4_request`;
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret}`, date), REGION), 's3'), 'aws4_request');
    const signature = hmac(signingKey, ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n')).toString('hex');
    const { host, ...sent } = headers;
    const response = await fetch(url, {
      method,
      body: method === 'PUT' ? body : undefined,
      headers: { ...sent, authorization: `AWS4-HMAC-SHA256 Credential=${keyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` },
    });
    if (!response.ok) throw new Error(`bucket ${method} ${key}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
    return response;
  }

  return {
    describe: () => `hf://buckets/${bucketId}`,
    // Browser-playable URL of an object (302 to the CDN).
    url: key => `${hubBase}/resolve/${encodeKey(key)}`,
    put: (key, body, contentType) => s3('PUT', key, Buffer.from(body), contentType),
    delete: key => s3('DELETE', key),
    putJson(key, value) {
      return s3('PUT', key, Buffer.from(JSON.stringify(value)), 'application/json');
    },
    // null when the object doesn't exist.
    async getJson(key) {
      const response = await fetch(`${hubBase}/resolve/${encodeKey(key)}`, { cache: 'no-store' });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`bucket GET ${key}: HTTP ${response.status}`);
      return response.json();
    },
    // Every file under a directory: [{ path, size, uploadedAt }], following the API's Link pagination.
    async list(dir) {
      const files = [];
      let next = `${apiBase}/tree/${encodeKey(dir)}?limit=1000`;
      while (next) {
        const response = await fetch(next, { cache: 'no-store' });
        if (response.status === 404) return files;
        if (!response.ok) throw new Error(`bucket list ${dir}: HTTP ${response.status}`);
        files.push(...(await response.json()).filter(entry => entry.type === 'file'));
        next = response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
      }
      return files;
    },
  };
}
