// Single-port entrypoint: serves the auth and account services behind one host
// (e.g. apieearny.onvoroa.com). /api/auth/* -> auth, /api/account/* -> account.
// Hydrates state from Cloudflare KV on boot so container restarts never wipe data.
const http = require('http');
const kvSync = require('./packages/kv-sync');
const authApp = require('./services/auth/src/app');
const accountApp = require('./services/account/src/app');

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (['/', '/health', '/healthz', '/api/health'].includes(url.split('?')[0])) {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, services: ['auth', 'account'], persistence: 'cloud-kv' }));
  }
  if (url.startsWith('/api/auth')) return authApp(req, res);
  if (url.startsWith('/api/account')) return accountApp(req, res);
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 4000;
kvSync.hydrateAll().finally(() => {
  server.listen(PORT, '0.0.0.0', () => console.log(`[eearny] backend gateway listening on 0.0.0.0:${PORT}`));
});
server.on('error', (e) => { console.error('[eearny] listen failed', e); process.exit(1); });
process.on('uncaughtException', (e) => console.error('[eearny] uncaught', e));
process.on('unhandledRejection', (e) => console.error('[eearny] unhandled', e));
