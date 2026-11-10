// Single-port entrypoint: serves the auth and account services behind one host
// (e.g. apieearny.getvoroa.com). /api/auth/* -> auth, /api/account/* -> account.
const http = require('http');
const authApp = require('./services/auth/src/app');
const accountApp = require('./services/account/src/app');

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (['/', '/health', '/healthz', '/api/health'].includes(url.split('?')[0])) {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, services: ['auth', 'account'] }));
  }
  if (url.startsWith('/api/auth')) return authApp(req, res);
  if (url.startsWith('/api/account')) return accountApp(req, res);
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => console.log(`[eearny] backend gateway listening on 0.0.0.0:${PORT}`));
server.on('error', (e) => { console.error('[eearny] listen failed', e); process.exit(1); });
process.on('uncaughtException', (e) => console.error('[eearny] uncaught', e));
process.on('unhandledRejection', (e) => console.error('[eearny] unhandled', e));
