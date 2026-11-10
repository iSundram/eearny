// Wallet domain logic for eearny (currency: INR).
// Persisted in a JSON file (same approach as the other services) — swap for a real DB later.
//
// Money model per user:
//   balance      – recharge wallet (top-ups). Used to buy investment plans.
//   withdrawable – income wallet (plan revenue, commissions, check-in, lucky draw). Can be withdrawn.
//   Both can be used to buy plans; only `withdrawable` can be withdrawn.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const kvSync = require('../../../packages/kv-sync');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = process.env.WALLET_DB_FILE || path.join(DATA_DIR, 'wallet.json');
kvSync.registerStore('eearny:wallet', DB_FILE);

const CURRENCY = 'INR';
const DAY_MS = Number(process.env.REVENUE_DAY_MS) || 24 * 60 * 60 * 1000; // override to demo accrual quickly
const WITHDRAW_PROCESS_MS = Number(process.env.WITHDRAW_PROCESS_MS ?? 60 * 1000);

const MIN_TOPUP = 100;
const MAX_TOPUP = 200000;
const MIN_WITHDRAW = 200;
const MAX_UNITS_PER_BUY = 10;
const CHECKIN_BASE = 5; // default daily check-in reward: ₹5
const COMMISSION_RATES = [0.10, 0.05, 0.02]; // level 1 / 2 / 3 of the purchase amount

// ---- investment plans (unit price, daily revenue per unit, duration) ----
const PLANS = [
  { id: 'starter',  name: 'Starter',  unitPrice: 500,   dailyRevenue: 20,   days: 30 },
  { id: 'basic',    name: 'Basic',    unitPrice: 1000,  dailyRevenue: 42,   days: 30 },
  { id: 'silver',   name: 'Silver',   unitPrice: 5000,  dailyRevenue: 225,  days: 35 },
  { id: 'gold',     name: 'Gold',     unitPrice: 10000, dailyRevenue: 480,  days: 40 },
  { id: 'platinum', name: 'Platinum', unitPrice: 25000, dailyRevenue: 1250, days: 45 },
  { id: 'diamond',  name: 'Diamond',  unitPrice: 50000, dailyRevenue: 2600, days: 50 },
].map((p) => ({ ...p, totalRevenue: p.dailyRevenue * p.days, roiPercent: +(((p.dailyRevenue * p.days) / p.unitPrice - 1) * 100).toFixed(1) }));

// ---- account tiers by lifetime invested amount ----
const TIERS = [
  { id: 'bronze',   name: 'Bronze',   min: 0,      checkinBonus: 0 },
  { id: 'silver',   name: 'Silver',   min: 1000,   checkinBonus: 1 },
  { id: 'gold',     name: 'Gold',     min: 10000,  checkinBonus: 2 },
  { id: 'platinum', name: 'Platinum', min: 50000,  checkinBonus: 3 },
  { id: 'diamond',  name: 'Diamond',  min: 150000, checkinBonus: 5 },
];

const LUCKY_PRIZES = [
  { amount: 0, weight: 300 }, { amount: 1, weight: 250 }, { amount: 2, weight: 200 },
  { amount: 5, weight: 120 }, { amount: 10, weight: 70 }, { amount: 20, weight: 40 },
  { amount: 50, weight: 15 }, { amount: 100, weight: 5 },
];

const NOTIF_CATEGORIES = ['deposit', 'withdraw', 'income', 'invest', 'referral', 'checkin', 'draw', 'account'];

class WalletError extends Error {
  constructor(message, field, status = 400) { super(message); this.field = field; this.status = status; }
}

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const uid = (p) => p + '_' + crypto.randomBytes(5).toString('hex');
const dayKey = (t = Date.now()) => new Date(t + 5.5 * 3600 * 1000).toISOString().slice(0, 10); // IST calendar day

function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return { users: {}, refCodes: {} }; }
}
function save(db) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const raw = JSON.stringify(db, null, 2);
  fs.writeFileSync(DB_FILE, raw);
  kvSync.pushToCloud('eearny:wallet', raw);
}

function newCode(db) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let c = 'EE';
    for (let i = 0; i < 6; i++) c += alphabet[crypto.randomInt(alphabet.length)];
    if (!db.refCodes[c]) return c;
  }
}

function ensureUser(db, id, who = {}) {
  let u = db.users[id];
  if (!u) {
    const code = newCode(db);
    u = db.users[id] = {
      id, name: who.name || 'Member', email: who.email || '',
      balance: 0, withdrawable: 0, totalIncome: 0, totalInvested: 0, totalTopup: 0, totalWithdrawn: 0,
      txs: [], investments: [], methods: [], notifications: [],
      prefs: Object.fromEntries(NOTIF_CATEGORIES.map((c) => [c, true])),
      lastCheckIn: null, streak: 0, lastDraw: null,
      referralCode: code, referredBy: null, createdAt: new Date().toISOString(),
    };
    db.refCodes[code] = id;
  }
  if (who.name) u.name = who.name;
  if (who.email) u.email = who.email;
  return u;
}

function notify(u, category, title, body) {
  if (u.prefs[category] === false) return;
  u.notifications.unshift({ id: uid('n'), category, title, body, read: false, createdAt: new Date().toISOString() });
  if (u.notifications.length > 200) u.notifications.length = 200;
}

function addTx(u, { title, amount, category, wallet, status = 'paid', meta }) {
  const tx = { id: uid('t'), title, amount: r2(amount), category, wallet, status, date: new Date().toISOString() };
  if (meta) tx.meta = meta;
  u.txs.unshift(tx);
  return tx;
}

function credit(u, wallet, amount) { u[wallet] = r2(u[wallet] + amount); }

function tierFor(u) {
  let tier = TIERS[0];
  for (const t of TIERS) if (u.totalInvested >= t.min) tier = t;
  const idx = TIERS.indexOf(tier);
  const next = TIERS[idx + 1] || null;
  return {
    ...tier, totalInvested: u.totalInvested, next: next && { id: next.id, name: next.name, min: next.min, remaining: r2(next.min - u.totalInvested) },
    progress: next ? Math.min(1, (u.totalInvested - tier.min) / (next.min - tier.min)) : 1,
    perks: [`Daily check-in ₹${CHECKIN_BASE + tier.checkinBonus}`, 'Commission levels 1–3'],
  };
}

// ---- lazy time-based processing: investment revenue + withdrawal settlement ----
function settle(db, u) {
  let changed = false;
  const now = Date.now();
  for (const inv of u.investments) {
    if (inv.status !== 'active') continue;
    const elapsed = Math.floor((now - new Date(inv.startedAt).getTime()) / DAY_MS);
    const target = Math.min(inv.days, elapsed);
    const due = target - inv.daysPaid;
    if (due > 0) {
      const amount = r2(due * inv.dailyRevenue * inv.units);
      inv.daysPaid = target;
      inv.earned = r2(inv.earned + amount);
      credit(u, 'withdrawable', amount);
      u.totalIncome = r2(u.totalIncome + amount);
      addTx(u, { title: `Daily revenue — ${inv.name}${due > 1 ? ` (${due} days)` : ''}`, amount, category: 'income', wallet: 'withdrawable', meta: { investmentId: inv.id } });
      notify(u, 'income', 'Revenue credited', `₹${amount} from ${inv.name} (${inv.daysPaid}/${inv.days} days).`);
      if (inv.daysPaid >= inv.days) {
        inv.status = 'completed';
        notify(u, 'invest', 'Plan completed', `${inv.name} ×${inv.units} finished. Total earned ₹${inv.earned}.`);
      }
      changed = true;
    }
  }
  for (const tx of u.txs) {
    if (tx.category === 'withdraw' && tx.status === 'pending' && now - new Date(tx.date).getTime() >= WITHDRAW_PROCESS_MS) {
      tx.status = 'paid';
      notify(u, 'withdraw', 'Withdrawal completed', `₹${Math.abs(tx.amount)} sent to ${tx.meta?.method || 'your account'}.`);
      changed = true;
    }
  }
  return changed;
}

// Runs fn(user, db) with a settled, persisted user record.
function withUser(id, who, fn) {
  const db = load();
  if (!db.refCodes) db.refCodes = {};
  const u = ensureUser(db, id, who);
  settle(db, u);
  const out = fn(u, db);
  save(db);
  return out;
}

const view = (u) => ({
  currency: CURRENCY,
  balance: u.balance,
  productIncome: u.totalIncome,
  withdrawable: u.withdrawable,
  totalInvested: u.totalInvested,
  totalTopup: u.totalTopup,
  totalWithdrawn: u.totalWithdrawn,
  activeInvestments: u.investments.filter((i) => i.status === 'active').length,
  dailyIncome: r2(u.investments.filter((i) => i.status === 'active').reduce((s, i) => s + i.dailyRevenue * i.units, 0)),
  tier: tierFor(u),
});

// ---------- operations ----------
function getWallet(id, who) { return withUser(id, who, (u) => view(u)); }

function listTransactions(id, who, { category } = {}) {
  return withUser(id, who, (u) => u.txs.filter((t) => !category || category === 'all' || t.category === category));
}

function topUp(id, who, { amount, methodId }) {
  amount = r2(Number(amount));
  if (!Number.isFinite(amount) || amount < MIN_TOPUP) throw new WalletError(`Minimum top up is ₹${MIN_TOPUP}`, 'amount');
  if (amount > MAX_TOPUP) throw new WalletError(`Maximum top up is ₹${MAX_TOPUP}`, 'amount');
  return withUser(id, who, (u) => {
    let via = 'UPI';
    if (methodId) {
      const m = u.methods.find((x) => x.id === methodId);
      if (!m) throw new WalletError('Payment method not found', 'methodId', 404);
      via = m.label;
    }
    credit(u, 'balance', amount);
    u.totalTopup = r2(u.totalTopup + amount);
    addTx(u, { title: `Top up via ${via}`, amount, category: 'deposit', wallet: 'balance', meta: { method: via } });
    notify(u, 'deposit', 'Top up successful', `₹${amount} added to your balance.`);
    return view(u);
  });
}

function withdraw(id, who, { amount, methodId }) {
  amount = r2(Number(amount));
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAW) throw new WalletError(`Minimum withdrawal is ₹${MIN_WITHDRAW}`, 'amount');
  return withUser(id, who, (u) => {
    const m = u.methods.find((x) => x.id === methodId);
    if (!m) throw new WalletError('Choose a saved payment method to withdraw to', 'methodId');
    if (amount > u.withdrawable) throw new WalletError('Amount exceeds your withdrawal balance', 'amount');
    credit(u, 'withdrawable', -amount);
    u.totalWithdrawn = r2(u.totalWithdrawn + amount);
    addTx(u, { title: `Withdrawal to ${m.label}`, amount: -amount, category: 'withdraw', wallet: 'withdrawable', status: 'pending', meta: { method: m.label } });
    notify(u, 'withdraw', 'Withdrawal requested', `₹${amount} to ${m.label} is being processed.`);
    return view(u);
  });
}

// ---- payment methods ----
function listMethods(id, who) { return withUser(id, who, (u) => u.methods); }

function addMethod(id, who, body = {}) {
  const type = body.type;
  let method;
  if (type === 'upi') {
    const vpa = String(body.vpa || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,}@[a-z]{2,}$/.test(vpa)) throw new WalletError('Enter a valid UPI ID (e.g. name@upi)', 'vpa');
    method = { type, label: `UPI · ${vpa}`, vpa };
  } else if (type === 'bank') {
    const holder = String(body.holder || '').trim();
    const acct = String(body.accountNumber || '').replace(/\s+/g, '');
    const ifsc = String(body.ifsc || '').trim().toUpperCase();
    if (!holder) throw new WalletError('Account holder name is required', 'holder');
    if (!/^\d{9,18}$/.test(acct)) throw new WalletError('Account number must be 9–18 digits', 'accountNumber');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new WalletError('Enter a valid IFSC code', 'ifsc');
    method = { type, label: `Bank · ••••${acct.slice(-4)}`, holder, accountLast4: acct.slice(-4), ifsc };
  } else {
    throw new WalletError('Method type must be "upi" or "bank"', 'type');
  }
  return withUser(id, who, (u) => {
    const dup = u.methods.find((m) => m.label === method.label);
    if (dup) throw new WalletError('This payment method is already saved', 'vpa');
    if (u.methods.length >= 5) throw new WalletError('You can save up to 5 payment methods');
    method = { id: uid('pm'), ...method, isDefault: u.methods.length === 0, addedAt: new Date().toISOString() };
    u.methods.push(method);
    notify(u, 'account', 'Payment method added', `${method.label} was saved.`);
    return method;
  });
}

function removeMethod(id, who, methodId) {
  return withUser(id, who, (u) => {
    const i = u.methods.findIndex((m) => m.id === methodId);
    if (i < 0) throw new WalletError('Payment method not found', undefined, 404);
    const [gone] = u.methods.splice(i, 1);
    if (gone.isDefault && u.methods[0]) u.methods[0].isDefault = true;
    notify(u, 'account', 'Payment method removed', `${gone.label} was removed.`);
  });
}

function setDefaultMethod(id, who, methodId) {
  return withUser(id, who, (u) => {
    const m = u.methods.find((x) => x.id === methodId);
    if (!m) throw new WalletError('Payment method not found', undefined, 404);
    u.methods.forEach((x) => { x.isDefault = x.id === methodId; });
    return u.methods;
  });
}

// ---- investing ----
function listInvestments(id, who) {
  return withUser(id, who, (u) => u.investments.map((i) => ({
    ...i, totalRevenue: r2(i.dailyRevenue * i.units * i.days), invested: r2(i.unitPrice * i.units),
  })));
}

function invest(id, who, { planId, units = 1, source = 'balance' }) {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) throw new WalletError('Plan not found', 'planId', 404);
  units = Number(units);
  if (!Number.isInteger(units) || units < 1 || units > MAX_UNITS_PER_BUY) throw new WalletError(`Choose 1–${MAX_UNITS_PER_BUY} units`, 'units');
  if (!['balance', 'withdrawable'].includes(source)) throw new WalletError('Invalid payment source', 'source');
  const cost = r2(plan.unitPrice * units);
  return withUser(id, who, (u, db) => {
    if (u[source] < cost) throw new WalletError(source === 'balance' ? 'Insufficient balance — top up first' : 'Insufficient withdrawal balance', 'units');
    credit(u, source, -cost);
    u.totalInvested = r2(u.totalInvested + cost);
    const before = tierFor(u).id;
    const inv = {
      id: uid('inv'), planId: plan.id, name: plan.name, units, unitPrice: plan.unitPrice,
      dailyRevenue: plan.dailyRevenue, days: plan.days, daysPaid: 0, earned: 0,
      startedAt: new Date().toISOString(), status: 'active',
    };
    u.investments.unshift(inv);
    addTx(u, { title: `Bought ${plan.name} ×${units}`, amount: -cost, category: 'invest', wallet: source, meta: { investmentId: inv.id } });
    notify(u, 'invest', 'Plan purchased', `${plan.name} ×${units} for ₹${cost}. Earns ₹${r2(plan.dailyRevenue * units)}/day for ${plan.days} days.`);
    const after = tierFor(u);
    if (after.id !== before) notify(u, 'account', 'Tier upgraded', `You are now ${after.name}!`);

    // multi-level referral commission
    let child = u;
    COMMISSION_RATES.forEach((rate, i) => {
      const parent = child.referredBy && db.users[child.referredBy];
      if (!parent) { child = {}; return; }
      const amt = r2(cost * rate);
      credit(parent, 'withdrawable', amt);
      addTx(parent, { title: `Level ${i + 1} commission`, amount: amt, category: 'commission', wallet: 'withdrawable', meta: { level: i + 1, from: u.id } });
      notify(parent, 'referral', 'Commission earned', `₹${amt} (${rate * 100}%) from a level ${i + 1} member's purchase.`);
      child = parent;
    });
    return { investment: inv, wallet: view(u) };
  });
}

// ---- daily check-in ----
function checkinStatus(u) {
  const tier = tierFor(u);
  const today = dayKey();
  return {
    reward: CHECKIN_BASE + tier.checkinBonus, base: CHECKIN_BASE, tierBonus: tier.checkinBonus,
    checkedInToday: u.lastCheckIn === today, streak: u.lastCheckIn === today || u.lastCheckIn === dayKey(Date.now() - 86400000) ? u.streak : 0,
  };
}
function getCheckin(id, who) { return withUser(id, who, checkinStatus); }
function checkin(id, who) {
  return withUser(id, who, (u) => {
    const s = checkinStatus(u);
    if (s.checkedInToday) throw new WalletError('You already checked in today');
    u.streak = s.streak + 1;
    u.lastCheckIn = dayKey();
    credit(u, 'withdrawable', s.reward);
    addTx(u, { title: 'Daily check-in', amount: s.reward, category: 'checkin', wallet: 'withdrawable' });
    notify(u, 'checkin', 'Check-in reward', `₹${s.reward} credited. ${u.streak}-day streak!`);
    return { reward: s.reward, ...checkinStatus(u), wallet: view(u) };
  });
}

// ---- lucky draw (one free spin per day, prize chosen server-side) ----
function getLucky(id, who) {
  return withUser(id, who, (u) => ({ canSpin: u.lastDraw !== dayKey(), prizes: LUCKY_PRIZES.map((p) => p.amount) }));
}
function spin(id, who) {
  return withUser(id, who, (u) => {
    if (u.lastDraw === dayKey()) throw new WalletError('You already used today\'s spin — come back tomorrow');
    const total = LUCKY_PRIZES.reduce((s, p) => s + p.weight, 0);
    let roll = crypto.randomInt(total);
    const prize = LUCKY_PRIZES.find((p) => (roll -= p.weight) < 0);
    u.lastDraw = dayKey();
    if (prize.amount > 0) {
      credit(u, 'withdrawable', prize.amount);
      addTx(u, { title: 'Lucky draw prize', amount: prize.amount, category: 'draw', wallet: 'withdrawable' });
      notify(u, 'draw', 'You won!', `Lucky draw prize of ₹${prize.amount} credited.`);
    } else {
      notify(u, 'draw', 'Lucky draw', 'No prize this time — try again tomorrow.');
    }
    return { prize: prize.amount, index: LUCKY_PRIZES.indexOf(prize), canSpin: false, wallet: view(u) };
  });
}

// ---- referrals ----
function getReferrals(id, who) {
  return withUser(id, who, (u, db) => {
    const lvl1 = Object.values(db.users).filter((x) => x.referredBy === u.id);
    const lvl2 = Object.values(db.users).filter((x) => lvl1.some((a) => a.id === x.referredBy));
    const lvl3 = Object.values(db.users).filter((x) => lvl2.some((a) => a.id === x.referredBy));
    const earned = [0, 0, 0];
    u.txs.filter((t) => t.category === 'commission').forEach((t) => { earned[t.meta.level - 1] += t.amount; });
    const mask = (n) => (n || 'Member').split(' ')[0].replace(/^(.).*$/, (_m, c) => c + '•••');
    const referrer = u.referredBy && db.users[u.referredBy];
    return {
      code: u.referralCode,
      referredBy: referrer ? mask(referrer.name) : null,
      levels: [lvl1, lvl2, lvl3].map((l, i) => ({
        level: i + 1, rate: COMMISSION_RATES[i], members: l.length, earned: r2(earned[i]),
      })),
      totalMembers: lvl1.length + lvl2.length + lvl3.length,
      totalCommission: r2(earned.reduce((a, b) => a + b, 0)),
      recent: lvl1.slice(-10).reverse().map((m) => ({ name: mask(m.name), joinedAt: m.createdAt, invested: m.totalInvested })),
    };
  });
}

function redeemReferral(id, who, rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) throw new WalletError('Enter a referral code', 'code');
  return withUser(id, who, (u, db) => {
    if (u.referredBy) throw new WalletError('You have already used a referral code');
    const ownerId = db.refCodes[code];
    if (!ownerId) throw new WalletError('Invalid referral code', 'code');
    if (ownerId === u.id) throw new WalletError('You cannot use your own code', 'code');
    // prevent cycles: the code owner must not be downline of this user
    for (let cur = db.users[ownerId], n = 0; cur && n < 50; cur = db.users[cur.referredBy], n++) {
      if (cur.referredBy === u.id) throw new WalletError('This code cannot be used', 'code');
    }
    u.referredBy = ownerId;
    const owner = db.users[ownerId];
    notify(u, 'referral', 'Referral linked', 'You joined using a referral code.');
    notify(owner, 'referral', 'New referral', `${(u.name || 'A member').split(' ')[0]} joined with your code.`);
    return { ok: true };
  });
}

// ---- notifications ----
function listNotifications(id, who) {
  return withUser(id, who, (u) => ({ notifications: u.notifications, unread: u.notifications.filter((n) => !n.read).length }));
}
function unreadCount(id, who) { return withUser(id, who, (u) => u.notifications.filter((n) => !n.read).length); }
function markRead(id, who, nid) {
  return withUser(id, who, (u) => {
    const n = u.notifications.find((x) => x.id === nid);
    if (!n) throw new WalletError('Notification not found', undefined, 404);
    n.read = true;
  });
}
function markAllRead(id, who) { return withUser(id, who, (u) => { u.notifications.forEach((n) => { n.read = true; }); }); }
function deleteNotification(id, who, nid) {
  return withUser(id, who, (u) => {
    const i = u.notifications.findIndex((x) => x.id === nid);
    if (i < 0) throw new WalletError('Notification not found', undefined, 404);
    u.notifications.splice(i, 1);
  });
}
function clearNotifications(id, who) { return withUser(id, who, (u) => { u.notifications = []; }); }
function getPrefs(id, who) { return withUser(id, who, (u) => u.prefs); }
function setPrefs(id, who, patch = {}) {
  return withUser(id, who, (u) => {
    for (const c of NOTIF_CATEGORIES) if (typeof patch[c] === 'boolean') u.prefs[c] = patch[c];
    return u.prefs;
  });
}

module.exports = {
  WalletError, CURRENCY, PLANS, TIERS, COMMISSION_RATES, NOTIF_CATEGORIES, MIN_TOPUP, MIN_WITHDRAW, CHECKIN_BASE, LUCKY_PRIZES,
  getWallet, listTransactions, topUp, withdraw,
  listMethods, addMethod, removeMethod, setDefaultMethod,
  listInvestments, invest, getCheckin, checkin, getLucky, spin,
  getReferrals, redeemReferral,
  listNotifications, unreadCount, markRead, markAllRead, deleteNotification, clearNotifications, getPrefs, setPrefs,
};
