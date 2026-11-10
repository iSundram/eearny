// Persistent cloud KV sync for eearny backend.
// Keeps local JSON files in sync with Cloudflare KV so container restarts or
// redeploys on ephemeral hosts (Voroa / Render free tier) never lose data.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SEAL = 'b452b63f7159f08d07aa6ebcc16dbac6:d33f7a983d09dcf353a2a2927fc191feaec8f86e7233302918c61b8bce58695d73d572ee08409f6f9c55ddf554bb80036d0f225f36d7f60ae360883da7400d4a27797bd92de2562146343e6b0532ff6dc00f751359f03c1877de13c7b436023e1dae40dd6d6b3f31a9eecd3bfbaa7cec';
const NS_ID = process.env.CF_KV_NAMESPACE_ID || 'd0ab4c9525984356a148a2a3e30dc050';

function getCreds() {
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    return { t: process.env.CLOUDFLARE_API_TOKEN, a: process.env.CLOUDFLARE_ACCOUNT_ID };
  }
  try {
    const [ivHex, encHex] = SEAL.split(':');
    const key = crypto.scryptSync('eearny-kv-seal-key-v1', 'eearny-salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
    return JSON.parse(dec.toString('utf8'));
  } catch {
    return null;
  }
}

const creds = getCreds();
const baseUrl = creds ? `https://api.cloudflare.com/client/v4/accounts/${creds.a}/storage/kv/namespaces/${NS_ID}/values/` : null;

// Registry of { key, filePath } so startup hydration knows what to pull
const registry = new Map();

function registerStore(key, filePath) {
  registry.set(key, filePath);
}

// Push JSON string to Cloudflare KV asynchronously (debounced per key)
const pendingTimers = new Map();

function pushToCloud(key, jsonString) {
  if (!baseUrl || process.env.DISABLE_KV_SYNC === '1') return;
  if (pendingTimers.has(key)) clearTimeout(pendingTimers.get(key));
  pendingTimers.set(
    key,
    setTimeout(() => {
      pendingTimers.delete(key);
      fetch(baseUrl + encodeURIComponent(key), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${creds.t}`, 'Content-Type': 'application/json' },
        body: jsonString,
      }).catch((err) => console.error(`[kv-sync] push error (${key}):`, err.message));
    }, 50)
  );
}

// Pull all registered stores from Cloudflare KV before the HTTP server accepts requests
async function hydrateAll() {
  if (!baseUrl || process.env.DISABLE_KV_SYNC === '1') return;
  for (const [key, filePath] of registry.entries()) {
    try {
      // Only hydrate if local file doesn't exist or is empty
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 2) continue;
      const res = await fetch(baseUrl + encodeURIComponent(key), {
        headers: { Authorization: `Bearer ${creds.t}` },
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text || text.includes('"code":10009')) continue;
      JSON.parse(text); // verify valid JSON
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, text);
      console.log(`[kv-sync] Restored ${key} from cloud persistence (${text.length} bytes)`);
    } catch (err) {
      console.error(`[kv-sync] hydrate skip (${key}):`, err.message);
    }
  }
}

module.exports = { registerStore, pushToCloud, hydrateAll };
