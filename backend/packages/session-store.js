// Shared session store for eearny.
// Sessions bind a sid claim inside every JWT; revoking a session here
// instantly invalidates that token in EVERY service (both import this module).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const kvSync = require('./kv-sync');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'sessions.json');
kvSync.registerStore('eearny:sessions', DB_FILE);

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { sessions: [] };
  }
}

function save(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const raw = JSON.stringify(db, null, 2);
  fs.writeFileSync(DB_FILE, raw);
  kvSync.pushToCloud('eearny:sessions', raw);
}

// device: { ip, userAgent, browser, os, deviceType, screen, timezone, language, fingerprint }
function createSession(userId, device = {}) {
  const db = load();
  const session = {
    sid: crypto.randomBytes(16).toString('hex'),
    userId,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    ip: device.ip || null,
    userAgent: device.userAgent || null,
    browser: device.browser || 'Unknown browser',
    os: device.os || 'Unknown OS',
    deviceType: device.deviceType || 'desktop',
    screen: device.screen || null,
    timezone: device.timezone || null,
    language: device.language || null,
    fingerprint: device.fingerprint || null,
    revokedAt: null,
  };
  db.sessions.push(session);
  save(db);
  return session;
}

function findActive(sid) {
  if (!sid) return null;
  const db = load();
  return db.sessions.find((s) => s.sid === sid && !s.revokedAt) || null;
}

function listActiveByUser(userId) {
  const db = load();
  return db.sessions
    .filter((s) => s.userId === userId && !s.revokedAt)
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

function touch(sid) {
  const db = load();
  const s = db.sessions.find((x) => x.sid === sid);
  if (!s) return;
  s.lastSeenAt = new Date().toISOString();
  save(db);
}

function revoke(sid) {
  const db = load();
  const s = db.sessions.find((x) => x.sid === sid);
  if (!s || s.revokedAt) return false;
  s.revokedAt = new Date().toISOString();
  save(db);
  return true;
}

function revokeAllForUser(userId, exceptSid = null) {
  const db = load();
  let count = 0;
  for (const s of db.sessions) {
    if (s.userId === userId && !s.revokedAt && s.sid !== exceptSid) {
      s.revokedAt = new Date().toISOString();
      count++;
    }
  }
  if (count) save(db);
  return count;
}

module.exports = {
  createSession,
  findActive,
  listActiveByUser,
  touch,
  revoke,
  revokeAllForUser,
};
