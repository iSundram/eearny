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

const SUBS = [['overview', 'Overview'], ['transactions', 'Transactions'], ['payment', 'Payment'], ['settings', 'Settings']];

export default function Account({ user, setUser, wallet, refresh, initialSub = 'overview' }) {
  const [sub, setSub] = useState(initialSub);
  const [topup, setTopup] = useState(false);
  const t = wallet.tier;

  return (
    <>
      <div className="profile-head">
        <span className="avatar avatar-lg">{(user.name || '?').trim().charAt(0).toUpperCase()}</span>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>{user.name}</h2>
          <span className="muted">{user.email}</span>
        </div>
      </div>

      <div className="subnav">
        {SUBS.map(([id, label]) => <button key={id} className={sub === id ? 'on' : ''} onClick={() => setSub(id)}>{label}</button>)}
      </div>

      {sub === 'overview' && (
        <>
          <section className={`card tier tier-${t.id}`}>
            <div className="tier-top">
              <div><span className="summary-label">Account tier</span><div className="tier-name">{t.name}</div></div>
              <span className="badge badge-amber">{t.perks[0]}</span>
            </div>
            <div className="progress"><span style={{ width: `${t.progress * 100}%` }} /></div>
            <div className="faint progress-text">
              {t.next ? `Invest ${money(t.next.remaining)} more to reach ${t.next.name}` : 'Top tier reached 🎉'} · Invested {money(t.totalInvested)}
            </div>
          </section>

          <section className="stat-grid">
            <div className="card stat tone-indigo"><span className="summary-label">Balance</span><span className="stat-value">{money(wallet.balance)}</span></div>
            <div className="card stat tone-mint"><span className="summary-label">Withdrawal balance</span><span className="stat-value">{money(wallet.withdrawable)}</span></div>
            <div className="card stat"><span className="summary-label">Total top-ups</span><span className="stat-value">{money(wallet.totalTopup)}</span></div>
            <div className="card stat"><span className="summary-label">Total withdrawn</span><span className="stat-value">{money(wallet.totalWithdrawn)}</span></div>
          </section>

          <button className="btn btn-accent btn-block" onClick={() => setTopup(true)}><Icon name="plus" size={18} /> Recharge</button>

          <div className="menu card">
            <MenuRow icon="list" label="Transactions" onClick={() => setSub('transactions')} />
            <MenuRow icon="card" label="Saved payment methods" onClick={() => setSub('payment')} />
            <MenuRow icon="bell" label="Notification settings" onClick={() => setSub('settings')} />
            <MenuRow icon="settings" label="Profile & security" onClick={() => setSub('settings')} />
          </div>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 16 }} onClick={logout}>Sign out</button>
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

function MenuRow({ icon, label, onClick }) {
  return <button className="menu-row" onClick={onClick}><Icon name={icon} size={20} /><span>{label}</span><span className="faint">›</span></button>;
}

/* ---------- transactions ---------- */
const FILTERS = ['all', 'deposit', 'withdraw', 'invest', 'income', 'commission', 'checkin', 'draw'];

function Transactions() {
  const [cat, setCat] = useState('all');
  const [txs, setTxs] = useState(null);
  useEffect(() => { setTxs(null); getTransactions(cat).then((r) => setTxs(r.transactions)).catch((e) => notify(e.message, { type: 'error' })); }, [cat]);
  return (
    <div className="card pad">
      <div className="chips scroll">{FILTERS.map((f) => (
        <button key={f} className={`chip ${cat === f ? 'on' : ''}`} onClick={() => setCat(f)}>{f === 'all' ? 'All' : CATEGORY_LABEL[f]}</button>
      ))}</div>
      {!txs ? <div className="page-loading"><span className="spinner" /></div> : txs.length === 0 ? (
        <Empty icon="list" title="No transactions" hint="Your activity will appear here." />
      ) : (
        <ul className="tx-list">
          {txs.map((t) => (
            <li key={t.id}>
              <div>
                <div className="tx-title">{t.title}</div>
                <div className="faint tx-date">{CATEGORY_LABEL[t.category]} · {new Date(t.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div className="tx-right">
                <span className={`num ${t.amount < 0 ? 'neg' : 'pos'}`}>{t.amount < 0 ? '−' : '+'}{money(Math.abs(t.amount))}</span>
                <span className={`badge badge-${t.status === 'paid' ? 'mint' : 'amber'}`}>{t.status === 'paid' ? 'completed' : 'processing'}</span>
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
      <div className="title-row"><h3>Saved payment methods</h3><button className="btn btn-primary btn-small" onClick={() => setAdding(true)}>+ Add</button></div>
      {!methods ? <div className="page-loading"><span className="spinner" /></div> : methods.length === 0 ? (
        <Empty icon="card" title="No saved methods" hint="Add a UPI ID or bank account for withdrawals." />
      ) : (
        <ul className="method-list">
          {methods.map((m) => (
            <li key={m.id}>
              <span className="notif-icon"><Icon name={m.type === 'upi' ? 'card' : 'bank'} size={20} /></span>
              <div className="notif-main">
                <strong>{m.label}</strong>
                <span className="faint">{m.type === 'bank' ? `${m.holder} · ${m.ifsc}` : 'UPI'}</span>
              </div>
              {m.isDefault ? <span className="badge badge-mint">default</span>
                : <button className="linklike" onClick={act(() => setDefaultMethod(m.id), 'Default method updated.')}>Make default</button>}
              <button className="icon-btn" aria-label="Remove" onClick={act(() => removeMethod(m.id), 'Payment method removed.')}><Icon name="trash" size={18} /></button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <Sheet title="Add payment method" onClose={() => setAdding(false)}>
          <MethodForm onAdded={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />
        </Sheet>
      )}
    </div>
  );
}

/* ---------- notification preferences ---------- */
const PREF_LABELS = {
  deposit: ['Top ups', 'When money is added to your balance'],
  withdraw: ['Withdrawals', 'Requests and completions'],
  income: ['Revenue', 'Daily plan revenue credited'],
  invest: ['Investments', 'Purchases and completed plans'],
  referral: ['Referrals & commission', 'New team members and commissions'],
  checkin: ['Daily check-in', 'Check-in rewards'],
  draw: ['Lucky draw', 'Spin results'],
  account: ['Account', 'Payment methods and tier changes'],
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
      <h3 style={{ marginBottom: 6 }}>Notification settings</h3>
      <p className="faint note" style={{ marginTop: 0 }}>Choose which activity creates notifications.</p>
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
