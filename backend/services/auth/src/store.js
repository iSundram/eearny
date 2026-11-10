// Tiny JSON-file store for eearny auth users + password-reset tokens.
// Good enough for local dev; swap for a real DB later — the interface stays the same.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const kvSync = require('../../../packages/kv-sync');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'users.json');
kvSync.registerStore('eearny:users', DB_FILE);

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { users: [] };
  }
}

function save(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const raw = JSON.stringify(db, null, 2);
  fs.writeFileSync(DB_FILE, raw);
  kvSync.pushToCloud('eearny:users', raw);
}

function findUserByEmail(email) {
  const db = load();
  const needle = String(email).trim().toLowerCase();
  return db.users.find((u) => u.email.toLowerCase() === needle) || null;
}

function findUserById(id) {
  const db = load();
  return db.users.find((u) => u.id === id) || null;
}

function createUser({ name, email, passwordHash }) {
  const db = load();
  const user = {
    id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name,
    email: String(email).trim().toLowerCase(),
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  save(db);
  return user;
}

function updatePassword(userId, passwordHash) {
  const db = load();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;
  user.passwordHash = passwordHash;
  user.passwordChangedAt = new Date().toISOString();
  save(db);
  return user;
}

// ---- password reset tokens (dev: returned to the client instead of emailed) ----

const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes

function createPasswordReset(email) {
  const db = load();
  db.resets = db.resets || [];
  const record = {
    token: crypto.randomBytes(24).toString('hex'),
    email: String(email).trim().toLowerCase(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString(),
    usedAt: null,
  };
  db.resets.push(record);
  save(db);
  return record;
}

function consumePasswordReset(token) {
  const db = load();
  db.resets = db.resets || [];
  const record = db.resets.find((r) => r.token === token);
  if (!record || record.usedAt || new Date(record.expiresAt) < new Date()) return null;
  record.usedAt = new Date().toISOString();
  save(db);
  return record;
}

module.exports = { findUserByEmail, findUserById, createUser, updatePassword, createPasswordReset, consumePasswordReset };
