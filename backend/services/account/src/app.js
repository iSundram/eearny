const express = require('express');
const cors = require('cors');
const { authRequired } = require('../../../packages/jwt-auth');
const { rateLimit } = require('../../../packages/rate-limit');
const store = require('./store');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/account', rateLimit({ name: 'account-api', windowMs: 60 * 1000, max: 120 }));
const writeLimit = rateLimit({ name: 'account-write', windowMs: 60 * 1000, max: 20, keyBy: 'user' });

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
  if (patch.name) wallet.pushNotification(req.user.sub, { name: patch.name, email: req.user.email }, 'account', 'Profile updated', `Display name changed to ${patch.name}.`);
  const overrides = store.getProfile(req.user.sub) || {};
  res.json({
    user: {
      id: req.user.sub,
      name: overrides.name || req.user.name,
      email: req.user.email,
    },
  });
});

// ---------- wallet / dashboard (INR) ----------
const wallet = require('./wallet');
const who = (req) => ({ name: req.user.name, email: req.user.email });
const uid = (req) => req.user.sub;

// Wraps a handler: JSON result, WalletError -> 4xx with { error, field }.
const h = (fn) => (req, res) => {
  try {
    const out = fn(req);
    res.json(out === undefined ? { ok: true } : out);
  } catch (err) {
    if (err instanceof wallet.WalletError) return res.status(err.status).json({ error: err.message, field: err.field });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

app.get('/api/account/summary', authRequired, h((req) => ({ summary: wallet.getWallet(uid(req), who(req)) })));
app.get('/api/account/wallet', authRequired, h((req) => ({ wallet: wallet.getWallet(uid(req), who(req)) })));
app.get('/api/account/transactions', authRequired, h((req) => ({ transactions: wallet.listTransactions(uid(req), who(req), { category: req.query.category }) })));
app.post('/api/account/topup', authRequired, writeLimit, h((req) => ({ wallet: wallet.topUp(uid(req), who(req), req.body || {}) })));
app.post('/api/account/withdraw', authRequired, writeLimit, h((req) => ({ wallet: wallet.withdraw(uid(req), who(req), req.body || {}) })));

app.get('/api/account/config', authRequired, h(() => ({
  currency: wallet.CURRENCY, minTopup: wallet.MIN_TOPUP, minWithdraw: wallet.MIN_WITHDRAW,
  commissionRates: wallet.COMMISSION_RATES, tiers: wallet.TIERS, checkinBase: wallet.CHECKIN_BASE,
  luckyPrizes: wallet.LUCKY_PRIZES.map((p) => p.amount), notificationCategories: wallet.NOTIF_CATEGORIES,
})));

app.get('/api/account/methods', authRequired, h((req) => ({ methods: wallet.listMethods(uid(req), who(req)) })));
app.post('/api/account/methods', authRequired, writeLimit, h((req) => ({ method: wallet.addMethod(uid(req), who(req), req.body) })));
app.post('/api/account/methods/:id/default', authRequired, h((req) => ({ methods: wallet.setDefaultMethod(uid(req), who(req), req.params.id) })));
app.delete('/api/account/methods/:id', authRequired, h((req) => wallet.removeMethod(uid(req), who(req), req.params.id)));

app.get('/api/account/plans', authRequired, h(() => ({ plans: wallet.PLANS })));
app.get('/api/account/investments', authRequired, h((req) => ({ investments: wallet.listInvestments(uid(req), who(req)) })));
app.post('/api/account/invest', authRequired, writeLimit, h((req) => wallet.invest(uid(req), who(req), req.body || {})));

app.get('/api/account/checkin', authRequired, h((req) => wallet.getCheckin(uid(req), who(req))));
app.post('/api/account/checkin', authRequired, writeLimit, h((req) => wallet.checkin(uid(req), who(req))));
app.get('/api/account/lucky', authRequired, h((req) => wallet.getLucky(uid(req), who(req))));
app.post('/api/account/lucky/spin', authRequired, writeLimit, h((req) => wallet.spin(uid(req), who(req))));

app.get('/api/account/referrals', authRequired, h((req) => wallet.getReferrals(uid(req), who(req))));
app.post('/api/account/referrals/redeem', authRequired, writeLimit, h((req) => wallet.redeemReferral(uid(req), who(req), (req.body || {}).code)));

app.get('/api/account/notifications', authRequired, h((req) => wallet.listNotifications(uid(req), who(req))));
app.get('/api/account/notifications/unread-count', authRequired, h((req) => ({ unread: wallet.unreadCount(uid(req), who(req)) })));
app.post('/api/account/notifications/read-all', authRequired, h((req) => wallet.markAllRead(uid(req), who(req))));
app.post('/api/account/notifications/:id/read', authRequired, h((req) => wallet.markRead(uid(req), who(req), req.params.id)));
app.delete('/api/account/notifications/:id', authRequired, h((req) => wallet.deleteNotification(uid(req), who(req), req.params.id)));
app.delete('/api/account/notifications', authRequired, h((req) => wallet.clearNotifications(uid(req), who(req))));
app.get('/api/account/notification-prefs', authRequired, h((req) => ({ prefs: wallet.getPrefs(uid(req), who(req)) })));
app.put('/api/account/notification-prefs', authRequired, h((req) => ({ prefs: wallet.setPrefs(uid(req), who(req), req.body) })));

module.exports = app;
