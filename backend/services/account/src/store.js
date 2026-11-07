// JSON-file store for account data: profile overrides + per-user transactions.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'accounts.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { profiles: {}, transactions: {} };
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

function getTransactions(userId) {
  const db = load();
  if (!db.transactions[userId]) {
    // Seed a small demo history on first visit so the dashboard isn't empty.
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    db.transactions[userId] = [
      { id: 't1', title: 'Referral bonus',        amount: 25.0,  type: 'credit', status: 'paid',     date: new Date(now - 2 * day).toISOString() },
      { id: 't2', title: 'Survey payout',         amount: 12.4,  type: 'credit', status: 'paid',     date: new Date(now - 5 * day).toISOString() },
      { id: 't3', title: 'Cashback — online shop', amount: 8.75,  type: 'credit', status: 'paid',     date: new Date(now - 9 * day).toISOString() },
      { id: 't4', title: 'Withdrawal to bank',    amount: -40.0, type: 'debit',  status: 'paid',     date: new Date(now - 12 * day).toISOString() },
      { id: 't5', title: 'Task reward',           amount: 6.2,   type: 'credit', status: 'pending',  date: new Date(now - 1 * day).toISOString() },
    ];
    save(db);
  }
  return db.transactions[userId];
}

module.exports = { getProfile, updateProfile, getTransactions };
