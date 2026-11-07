const express = require('express');
const cors = require('cors');
const { authRequired } = require('../../../packages/jwt-auth');
const store = require('./store');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'account' }));

// Profile — merged from the JWT claims plus any saved overrides.
app.get('/api/account/me', authRequired, (req, res) => {
  const overrides = store.getProfile(req.user.sub) || {};
  res.json({
    user: {
      id: req.user.sub,
      name: overrides.name || req.user.name,
      email: req.user.email,
      joinedAt: overrides.joinedAt || null,
    },
  });
});

app.patch('/api/account/me', authRequired, (req, res) => {
  const { name } = req.body || {};
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'Name cannot be empty', field: 'name' });
  }
  const patch = {};
  if (name !== undefined) patch.name = String(name).trim();
  store.updateProfile(req.user.sub, patch);
  const overrides = store.getProfile(req.user.sub) || {};
  res.json({
    user: {
      id: req.user.sub,
      name: overrides.name || req.user.name,
      email: req.user.email,
    },
  });
});

// Earnings summary derived from the transaction history.
app.get('/api/account/summary', authRequired, (req, res) => {
  const txs = store.getTransactions(req.user.sub);
  const earned = txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const withdrawn = -txs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
  const pending = txs.filter((t) => t.status === 'pending').reduce((s, t) => s + Math.max(t.amount, 0), 0);
  res.json({
    summary: {
      balance: +(earned - withdrawn).toFixed(2),
      earned: +earned.toFixed(2),
      withdrawn: +withdrawn.toFixed(2),
      pending: +pending.toFixed(2),
      currency: 'USD',
    },
  });
});

app.get('/api/account/transactions', authRequired, (req, res) => {
  const txs = [...store.getTransactions(req.user.sub)].sort((a, b) => b.date.localeCompare(a.date));
  res.json({ transactions: txs });
});

module.exports = app;
