const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { signToken, verifyToken, authRequired } = require('../../../packages/jwt-auth');
const sessions = require('../../../packages/session-store');
const store = require('./store');
const { normalizeDevice } = require('./device');

const app = express();
app.use(cors());
app.use(express.json());

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APP_URL = process.env.AUTH_APP_URL || (process.env.NODE_ENV === 'production' ? 'https://eearny.pages.dev' : 'http://localhost:5173');

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt };
}

function publicSession(s) {
  const { sid, createdAt, lastSeenAt, ip, browser, os, deviceType, screen, timezone, language, fingerprint } = s;
  return { sid, createdAt, lastSeenAt, ip, browser, os, deviceType, screen, timezone, language, fingerprint };
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'auth' }));

// ---------- registration & login ----------

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required', field: 'name' });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address', field: 'email' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters', field: 'password' });
  if (store.findUserByEmail(email)) return res.status(409).json({ error: 'An account with this email already exists', field: 'email' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = store.createUser({ name: String(name).trim(), email, passwordHash });
  const session = sessions.createSession(user.id, normalizeDevice(req.body?.device, req));
  res.status(201).json({ token: signToken(user, session.sid), sid: session.sid, user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address', field: 'email' });
  if (!password) return res.status(400).json({ error: 'Password is required', field: 'password' });

  const user = store.findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  const session = sessions.createSession(user.id, normalizeDevice(req.body?.device, req));
  res.json({ token: signToken(user, session.sid), sid: session.sid, user: publicUser(user) });
});

// ---------- password self-service ----------

// Always 200 (never reveal whether the email exists). In dev there is no mailer,
// so the reset link is returned here — replace with an email send in production.
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address', field: 'email' });
  const user = store.findUserByEmail(email);
  if (!user) return res.json({ ok: true });
  const record = store.createPasswordReset(email);
  res.json({ ok: true, resetUrl: `${APP_URL}/?reset=${record.token}` });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Reset token is missing', field: 'token' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters', field: 'password' });
  const record = store.consumePasswordReset(token);
  if (!record) return res.status(400).json({ error: 'This reset link is invalid or has expired', field: 'token' });
  const user = store.findUserByEmail(record.email);
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired', field: 'token' });

  store.updatePassword(user.id, await bcrypt.hash(password, 10));
  sessions.revokeAllForUser(user.id); // a reset signs every device out
  res.json({ ok: true });
});

app.post('/api/auth/change-password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = store.findUserById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: 'Current password is incorrect', field: 'currentPassword' });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters', field: 'newPassword' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'New password must be different from the current one', field: 'newPassword' });
  }
  store.updatePassword(user.id, await bcrypt.hash(newPassword, 10));
  // keep the current device signed in, sign out everywhere else
  const revoked = sessions.revokeAllForUser(user.id, req.user.sid);
  res.json({ ok: true, revokedOtherSessions: revoked });
});

// ---------- session management ----------

app.get('/api/auth/sessions', authRequired, (req, res) => {
  res.json({ sessions: sessions.listActiveByUser(req.user.sub).map(publicSession) });
});

app.delete('/api/auth/sessions/:sid', authRequired, (req, res) => {
  const target = sessions.findActive(req.params.sid);
  if (!target || target.userId !== req.user.sub) return res.status(404).json({ error: 'Session not found' });
  sessions.revoke(req.params.sid);
  res.json({ ok: true });
});

// Revoke every other session ("sign out everywhere else").
app.delete('/api/auth/sessions', authRequired, (req, res) => {
  const revoked = sessions.revokeAllForUser(req.user.sub, req.user.sid);
  res.json({ ok: true, revoked });
});

// ---------- misc ----------

app.get('/api/auth/me', authRequired, (req, res) => {
  const user = store.findUserById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user), sid: req.user.sid || null });
});

// Stateless fallback: revoke the caller's session if a token is provided.
app.post('/api/auth/logout', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token && verifyToken(token);
  if (payload?.sid) sessions.revoke(payload.sid);
  res.json({ ok: true });
});

module.exports = app;
