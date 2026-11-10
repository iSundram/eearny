// Single-port entrypoint: serves the auth and account services behind one host
// (e.g. apieearny.getvoroa.com). /api/auth/* -> auth, /api/account/* -> account.
const http = require('http');
const authApp = require('./services/auth/src/app');
const accountApp = require('./services/account/src/app');

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (url === '/health' || url === '/') {
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
server.listen(PORT, () => console.log(`[eearny] backend gateway listening on :${PORT}`));
