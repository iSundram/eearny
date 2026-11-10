// JSON-file store for account profile overrides (wallet data lives in wallet.js).
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'accounts.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { profiles: {} };
  }
}

function save(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getProfile(userId) {
  const db = load();
  return db.profiles[userId] || null;
}

function updateProfile(userId, patch) {
  const db = load();
  const current = db.profiles[userId] || {};
  db.profiles[userId] = { ...current, ...patch, updatedAt: new Date().toISOString() };
  save(db);
  return db.profiles[userId];
}

module.exports = { getProfile, updateProfile };
