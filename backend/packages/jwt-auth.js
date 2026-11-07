// Shared JWT + session helpers for eearny backend services.
// Every login creates a server-side session (see session-store.js); the JWT
// carries its sid. authRequired() rejects tokens whose session was revoked,
// so "sign out everywhere" works across all services immediately.
const jwt = require('jsonwebtoken');
const sessions = require('./session-store');

const SECRET = process.env.JWT_SECRET || 'eearny-dev-secret-change-me';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(user, sid) {
  const payload = { sub: user.id, email: user.email, name: user.name };
  if (sid) payload.sid = sid;
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

// Express middleware: requires "Authorization: Bearer <token>".
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  // Session-bound tokens: reject revoked sessions.
  if (payload.sid) {
    const session = sessions.findActive(payload.sid);
    if (!session) return res.status(401).json({ error: 'Session revoked — please sign in again' });
    if (session.userId !== payload.sub) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    sessions.touch(payload.sid);
    req.session = session;
  }

  req.user = payload; // { sub, email, name, sid? }
  next();
}

module.exports = { signToken, verifyToken, authRequired, SECRET };
