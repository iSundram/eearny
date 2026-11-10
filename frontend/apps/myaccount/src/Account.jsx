import React, { useEffect, useState } from 'react';
import {
  getTransactions, getMethods, removeMethod, setDefaultMethod,
  getNotificationPrefs, setNotificationPrefs, logout,
} from './api.js';
import { notify } from '../../../packages/toast.jsx';
import { Icon, Sheet, Empty, money, CATEGORY_LABEL } from './ui.jsx';
import { MethodForm } from './Methods.jsx';
import { TopUpSheet } from './Home.jsx';
import { ProfileCard, SecurityCard } from './Security.jsx';

const SUBS = [
  ['overview', 'Overview'],
  ['transactions', 'Ledger'],
  ['payment', 'Payout methods'],
  ['settings', 'Settings'],
];

export default function Account({ user, setUser, wallet, refresh, initialSub = 'overview', go }) {
  const [sub, setSub] = useState(initialSub);
  const [topup, setTopup] = useState(false);
  const t = wallet.tier;

  return (
    <>
      <div className="profile-banner card">
        <div className="profile-head">
          <span className="avatar avatar-lg">{(user.name || '?').trim().charAt(0).toUpperCase()}</span>
          <div className="profile-meta">
            <div className="profile-name-row">
              <h2 className="profile-name">{user.name}</h2>
              <span className="badge badge-indigo">{t.name}</span>
            </div>
            <span className="muted profile-email">{user.email}</span>
          </div>
        </div>
        <button className="btn btn-ghost btn-small" onClick={logout}>Sign out</button>
      </div>

      <div className="subnav">
        {SUBS.map(([id, label]) => (
          <button key={id} className={sub === id ? 'on' : ''} onClick={() => { setSub(id); if (go) go('account', id === 'overview' ? undefined : id); }}>
            {label}
          </button>
        ))}
      </div>

      {sub === 'overview' && (
        <>
          <section className={`card tier tier-${t.id}`}>
            <div className="tier-top">
              <div>
                <span className="eyebrow">Membership Standing</span>
                <div className="tier-name">{t.name} Tier</div>
              </div>
              <span className="badge badge-amber"><Icon name="award" size={13} /> {t.perks[0]}</span>
            </div>
            <div>
              <div className="progress-header">
                <span className="faint">
                  {t.next ? `${money(t.next.remaining)} away from ${t.next.name}` : 'Highest tier unlocked'}
                </span>
                <strong>{money(t.totalInvested)} invested</strong>
              </div>
              <div className="progress"><span style={{ width: `${Math.max(4, t.progress * 100)}%` }} /></div>
            </div>
          </section>

          <section className="stat-grid">
            <div className="card stat">
              <span className="summary-label">Recharge balance</span>
              <span className="stat-value">{money(wallet.balance)}</span>
            </div>
            <div className="card stat">
              <span className="summary-label">Withdrawal balance</span>
              <span className="stat-value">{money(wallet.withdrawable)}</span>
            </div>
            <div className="card stat">
              <span className="summary-label">Lifetime deposits</span>
              <span className="stat-value">{money(wallet.totalTopup)}</span>
            </div>
            <div className="card stat">
              <span className="summary-label">Lifetime payouts</span>
              <span className="stat-value">{money(wallet.totalWithdrawn)}</span>
            </div>
          </section>

          <button className="btn btn-primary btn-block" onClick={() => setTopup(true)}>
            <Icon name="plus" size={17} /> Recharge account balance
          </button>

          <div className="menu card">
            <MenuRow icon="list" label="Transaction ledger" sub="Filter deposits, yields, and payouts" onClick={() => { setSub('transactions'); if (go) go('account', 'transactions'); }} />
            <MenuRow icon="card" label="Saved payment methods" sub="Manage UPI IDs and bank accounts" onClick={() => { setSub('payment'); if (go) go('account', 'payment'); }} />
            <MenuRow icon="bell" label="Notification preferences" sub="Control alerts by activity type" onClick={() => { setSub('settings'); if (go) go('account', 'settings'); }} />
            <MenuRow icon="shield" label="Profile &amp; device security" sub="Password and active session audit" onClick={() => { setSub('settings'); if (go) go('account', 'settings'); }} />
          </div>
        </>
      )}

      {sub === 'transactions' && <Transactions />}
      {sub === 'payment' && <Payment />}
      {sub === 'settings' && (
        <div className="stack">
          <NotifPrefs />
          <ProfileCard user={user} onSaved={setUser} onError={() => {}} />
          <SecurityCard />
        </div>
      )}

      {topup && <TopUpSheet onClose={() => setTopup(false)} onDone={refresh} />}
    </>
  );
}

function MenuRow({ icon, label, sub, onClick }) {
  return (
    <button className="menu-row" onClick={onClick}>
      <span className="menu-row-icon"><Icon name={icon} size={18} /></span>
      <div className="menu-row-text">
        <strong>{label}</strong>
        {sub && <span className="faint">{sub}</span>}
      </div>
      <span className="menu-row-chevron"><Icon name="chevronRight" size={17} /></span>
    </button>
  );
}

/* ---------- transactions ---------- */
const FILTERS = ['all', 'deposit', 'withdraw', 'invest', 'income', 'commission', 'checkin', 'draw'];

function Transactions() {
  const [cat, setCat] = useState('all');
  const [txs, setTxs] = useState(null);
  useEffect(() => { setTxs(null); getTransactions(cat).then((r) => setTxs(r.transactions)).catch((e) => notify(e.message, { type: 'error' })); }, [cat]);
  return (
    <div className="card pad">
      <div className="section-head">
        <div>
          <h3>Transaction ledger</h3>
          <p className="muted section-sub">Complete chronological record of credits and debits</p>
        </div>
      </div>
      <div className="chips scroll">{FILTERS.map((f) => (
        <button key={f} className={`chip ${cat === f ? 'on' : ''}`} onClick={() => setCat(f)}>
          {f === 'all' ? 'All entries' : CATEGORY_LABEL[f]}
        </button>
      ))}</div>
      {!txs ? <div className="page-loading"><span className="spinner" /></div> : txs.length === 0 ? (
        <Empty icon="list" title="No ledger entries" hint="Transactions matching this filter will appear here." />
      ) : (
        <ul className="tx-list">
          {txs.map((t) => (
            <li key={t.id}>
              <div>
                <div className="tx-title">{t.title}</div>
                <div className="faint tx-date">
                  {CATEGORY_LABEL[t.category]} · {new Date(t.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="tx-right">
                <span className={`num ${t.amount < 0 ? 'neg' : 'pos'}`}>
                  {t.amount < 0 ? '−' : '+'}{money(Math.abs(t.amount))}
                </span>
                <span className={`badge badge-${t.status === 'paid' ? 'mint' : 'amber'}`}>
                  <span className="status-dot" />{t.status === 'paid' ? 'settled' : 'processing'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- saved payment methods ---------- */
function Payment() {
  const [methods, setMethods] = useState(null);
  const [adding, setAdding] = useState(false);
  const load = () => getMethods().then((r) => setMethods(r.methods)).catch((e) => notify(e.message, { type: 'error' }));
  useEffect(() => { load(); }, []);
  const act = (fn, msg) => async () => { try { await fn(); notify(msg, { type: 'success' }); load(); } catch (e) { notify(e.message, { type: 'error' }); } };

  return (
    <div className="card pad">
      <div className="title-row" style={{ marginBottom: 12 }}>
        <div>
          <h3>Payout destinations</h3>
          <p className="muted section-sub">Verified UPI IDs and bank accounts for withdrawals</p>
        </div>
        <button className="btn btn-primary btn-small" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> Add method</button>
      </div>
      {!methods ? <div className="page-loading"><span className="spinner" /></div> : methods.length === 0 ? (
        <Empty icon="card" title="No payout methods saved" hint="Add a UPI ID or bank account to enable instant withdrawals." />
      ) : (
        <ul className="method-list">
          {methods.map((m) => (
            <li key={m.id}>
              <span className="notif-icon"><Icon name={m.type === 'upi' ? 'card' : 'bank'} size={18} /></span>
              <div className="notif-main">
                <strong>{m.label}</strong>
                <span className="faint">{m.type === 'bank' ? `${m.holder} · IFSC ${m.ifsc}` : 'Instant UPI settlement'}</span>
              </div>
              {m.isDefault ? <span className="badge badge-mint"><span className="status-dot" />Default</span>
                : <button className="linklike" onClick={act(() => setDefaultMethod(m.id), 'Default method updated.')}>Set default</button>}
              <button className="icon-btn" aria-label="Remove" onClick={act(() => removeMethod(m.id), 'Payment method removed.')}><Icon name="trash" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <Sheet title="Add payout destination" subtitle="Connect a UPI ID or Indian bank account (IMPS/NEFT)" onClose={() => setAdding(false)}>
          <MethodForm onAdded={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />
        </Sheet>
      )}
    </div>
  );
}

/* ---------- notification preferences ---------- */
const PREF_LABELS = {
  deposit: ['Top ups', 'When funds are credited to your recharge balance'],
  withdraw: ['Withdrawals', 'Payout initiation and bank settlement updates'],
  income: ['Daily revenue', 'Automated investment yield payouts'],
  invest: ['Investments', 'Plan allocations and maturity completions'],
  referral: ['Referrals & commission', 'New network signups and tier commissions'],
  checkin: ['Daily check-in', 'Attendance streak rewards'],
  draw: ['Lucky draw', 'Daily wheel outcomes'],
  account: ['Account & security', 'Payout method updates and tier upgrades'],
};

function NotifPrefs() {
  const [prefs, setPrefs] = useState(null);
  useEffect(() => { getNotificationPrefs().then((r) => setPrefs(r.prefs)).catch(() => {}); }, []);
  async function toggle(k) {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    try { await setNotificationPrefs({ [k]: next[k] }); }
    catch (e) { setPrefs(prefs); notify(e.message, { type: 'error' }); }
  }
  return (
    <div className="card pad">
      <div className="section-head">
        <div>
          <h3>Notification channels</h3>
          <p className="muted section-sub">Select which account events generate in-app alerts</p>
        </div>
      </div>
      {!prefs ? <div className="page-loading"><span className="spinner" /></div> : (
        <ul className="pref-list">
          {Object.entries(PREF_LABELS).map(([k, [title, hint]]) => (
            <li key={k}>
              <div><strong>{title}</strong><div className="faint">{hint}</div></div>
              <button role="switch" aria-checked={!!prefs[k]} className={`switch ${prefs[k] ? 'on' : ''}`} onClick={() => toggle(k)} aria-label={title}><span /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
