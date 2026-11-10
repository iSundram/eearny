import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  topUp, withdraw, getMethods, getReferrals, redeemReferral, getCheckin, doCheckin,
  getLucky, spinLucky, getConfig,
} from './api.js';
import { notify } from '../../../packages/toast.jsx';
import { Icon, Sheet, Field, Busy, money } from './ui.jsx';
import { MethodForm } from './Methods.jsx';

export default function Home({ user, wallet, refresh, go }) {
  const [sheet, setSheet] = useState(null);
  const close = useCallback(() => setSheet(null), []);
  const done = () => { refresh(); };

  return (
    <>
      <h2 className="greeting">Hi, <em>{(user.name || 'friend').split(' ')[0]}</em></h2>

      <section className="hero card">
        <span className="hero-label">Balance</span>
        <span className="hero-value">{money(wallet.balance)}</span>
        <div className="hero-actions">
          <button className="btn btn-accent" onClick={() => setSheet('topup')}><Icon name="plus" size={18} /> Top up</button>
          <button className="btn btn-ghost" onClick={() => setSheet('withdraw')}><Icon name="arrowUp" size={18} /> Withdraw</button>
        </div>
      </section>

      <section className="stat-grid">
        <div className="card stat tone-mint">
          <span className="summary-label">Product income</span>
          <span className="stat-value">{money(wallet.productIncome)}</span>
          <span className="faint stat-sub">{money(wallet.dailyIncome)}/day · {wallet.activeInvestments} active</span>
        </div>
        <div className="card stat tone-indigo">
          <span className="summary-label">Withdrawal balance</span>
          <span className="stat-value">{money(wallet.withdrawable)}</span>
          <span className="faint stat-sub">Ready to withdraw</span>
        </div>
      </section>

      <section className="quick-grid">
        <Quick icon="users" label="My referrals" onClick={() => setSheet('referrals')} />
        <Quick icon="check" label="Daily check-in" badge="₹5" onClick={() => setSheet('checkin')} />
        <Quick icon="gift" label="Lucky draw" onClick={() => setSheet('lucky')} />
        <Quick icon="percent" label="Commission rates" onClick={() => setSheet('rates')} />
        <Quick icon="trend" label="Invest" onClick={() => go('invest')} />
        <Quick icon="list" label="Transactions" onClick={() => go('account', 'transactions')} />
      </section>

      {sheet === 'topup' && <TopUpSheet onClose={close} onDone={done} />}
      {sheet === 'withdraw' && <WithdrawSheet wallet={wallet} onClose={close} onDone={done} />}
      {sheet === 'referrals' && <ReferralsSheet onClose={close} />}
      {sheet === 'checkin' && <CheckinSheet onClose={close} onDone={done} />}
      {sheet === 'lucky' && <LuckySheet onClose={close} onDone={done} />}
      {sheet === 'rates' && <RatesSheet onClose={close} />}
    </>
  );
}

function Quick({ icon, label, badge, onClick }) {
  return (
    <button className="quick" onClick={onClick}>
      <span className="quick-icon"><Icon name={icon} size={22} /></span>
      <span className="quick-label">{label}</span>
      {badge && <span className="quick-badge">{badge}</span>}
    </button>
  );
}

/* ---------- top up ---------- */
const PRESETS = [500, 1000, 2000, 5000, 10000];

export function TopUpSheet({ onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [methods, setMethods] = useState([]);
  const [methodId, setMethodId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { getMethods().then(({ methods: m }) => { setMethods(m); setMethodId(m.find((x) => x.isDefault)?.id || ''); }).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await topUp(Number(amount), methodId || undefined);
      notify(`${money(Number(amount))} added to your balance.`, { type: 'success' });
      onDone(); onClose();
    } catch (ex) { setErr(ex.message); notify(ex.message, { type: 'error' }); } finally { setBusy(false); }
  }
  return (
    <Sheet title="Top up" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Amount (₹)" error={err}>
          <input type="number" min="1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Min ₹100" autoFocus />
        </Field>
        <div className="chips">{PRESETS.map((p) => <button type="button" key={p} className="chip" onClick={() => setAmount(String(p))}>{money(p)}</button>)}</div>
        <Field label="Pay with">
          <select value={methodId} onChange={(e) => setMethodId(e.target.value)}>
            <option value="">UPI (new payment)</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <p className="faint note">Demo mode: payments are simulated — funds are credited instantly with no real gateway.</p>
        <button className="btn btn-primary btn-block" disabled={busy || !amount}><Busy busy={busy} label="Processing…">Add {amount ? money(Number(amount)) : 'money'}</Busy></button>
      </form>
    </Sheet>
  );
}

/* ---------- withdraw ---------- */
function WithdrawSheet({ wallet, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [methods, setMethods] = useState(null);
  const [methodId, setMethodId] = useState('');
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => getMethods().then(({ methods: m }) => { setMethods(m); setMethodId((cur) => cur || m.find((x) => x.isDefault)?.id || m[0]?.id || ''); });
  useEffect(() => { load().catch(() => setMethods([])); }, []);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await withdraw(Number(amount), methodId);
      notify(`Withdrawal of ${money(Number(amount))} requested.`, { type: 'success' });
      onDone(); onClose();
    } catch (ex) { setErr(ex.message); notify(ex.message, { type: 'error' }); } finally { setBusy(false); }
  }

  if (!methods) return <Sheet title="Withdraw" onClose={onClose}><div className="page-loading"><span className="spinner" /></div></Sheet>;
  if (adding || methods.length === 0) {
    return (
      <Sheet title="Add a payout method" onClose={onClose}>
        <p className="muted note">Save a UPI ID or bank account to receive withdrawals.</p>
        <MethodForm onAdded={(m) => { setMethodId(m.id); setAdding(false); load(); }} onCancel={methods.length ? () => setAdding(false) : undefined} />
      </Sheet>
    );
  }
  return (
    <Sheet title="Withdraw" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="avail">Withdrawal balance <strong>{money(wallet.withdrawable)}</strong></div>
        <Field label="Amount (₹)" error={err}>
          <input type="number" min="1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Min ₹200" autoFocus />
        </Field>
        <div className="chips"><button type="button" className="chip" onClick={() => setAmount(String(Math.floor(wallet.withdrawable)))}>Max</button></div>
        <Field label="Send to">
          <select value={methodId} onChange={(e) => setMethodId(e.target.value)}>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <button type="button" className="linklike" onClick={() => setAdding(true)}>+ Add another method</button>
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy || !amount}><Busy busy={busy} label="Requesting…">Withdraw</Busy></button>
      </form>
    </Sheet>
  );
}

/* ---------- referrals ---------- */
function ReferralsSheet({ onClose }) {
  const [data, setData] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => getReferrals().then(setData).catch((e) => notify(e.message, { type: 'error' }));
  useEffect(() => { load(); }, []);

  const link = data ? `${window.location.origin}/?ref=${data.code}` : '';
  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); notify(`${what} copied.`, { type: 'success' }); }
    catch { notify('Copy failed — select and copy manually.', { type: 'error' }); }
  }
  async function share() {
    if (navigator.share) { try { await navigator.share({ title: 'eearny', text: `Join eearny with my code ${data.code}`, url: link }); return; } catch { return; } }
    copy(`Join eearny with my code ${data.code}: ${link}`, 'Invite');
  }
  async function redeem(e) {
    e.preventDefault(); setBusy(true);
    try { await redeemReferral(code); notify('Referral code applied.', { type: 'success' }); setCode(''); load(); }
    catch (ex) { notify(ex.message, { type: 'error' }); } finally { setBusy(false); }
  }

  return (
    <Sheet title="My referrals" onClose={onClose}>
      {!data ? <div className="page-loading"><span className="spinner" /></div> : (
        <>
          <div className="refcode">
            <span className="faint">Your referral code</span>
            <strong>{data.code}</strong>
            <div className="row-actions">
              <button className="btn btn-ghost btn-small" onClick={() => copy(data.code, 'Code')}><Icon name="copy" size={16} /> Copy code</button>
              <button className="btn btn-accent btn-small" onClick={share}>Share invite</button>
            </div>
          </div>
          <div className="stat-grid">
            <div className="card stat"><span className="summary-label">Team members</span><span className="stat-value">{data.totalMembers}</span></div>
            <div className="card stat"><span className="summary-label">Commission earned</span><span className="stat-value">{money(data.totalCommission)}</span></div>
          </div>
          <table className="mini">
            <thead><tr><th>Level</th><th>Rate</th><th>Members</th><th className="num">Earned</th></tr></thead>
            <tbody>{data.levels.map((l) => (
              <tr key={l.level}><td>Level {l.level}</td><td>{l.rate * 100}%</td><td>{l.members}</td><td className="num">{money(l.earned)}</td></tr>
            ))}</tbody>
          </table>
          {data.recent.length > 0 && (
            <>
              <h4 className="sub-h">Recent members</h4>
              <ul className="plain-list">{data.recent.map((m, i) => (
                <li key={i}><span>{m.name}</span><span className="faint">invested {money(m.invested)}</span></li>
              ))}</ul>
            </>
          )}
          {data.referredBy ? (
            <p className="faint note">You joined via {data.referredBy}.</p>
          ) : (
            <form onSubmit={redeem} className="redeem">
              <Field label="Have a referral code?">
                <div className="inline-field">
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="EEXXXXXX" />
                  <button className="btn btn-primary" disabled={busy || !code}><Busy busy={busy} label="">Apply</Busy></button>
                </div>
              </Field>
            </form>
          )}
        </>
      )}
    </Sheet>
  );
}

/* ---------- daily check-in ---------- */
function CheckinSheet({ onClose, onDone }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getCheckin().then(setS).catch((e) => notify(e.message, { type: 'error' })); }, []);
  async function claim() {
    setBusy(true);
    try {
      const r = await doCheckin();
      setS(r); notify(`${money(r.reward)} check-in reward claimed!`, { type: 'success' }); onDone();
    } catch (ex) { notify(ex.message, { type: 'error' }); } finally { setBusy(false); }
  }
  return (
    <Sheet title="Daily check-in" onClose={onClose}>
      {!s ? <div className="page-loading"><span className="spinner" /></div> : (
        <div className="center-col">
          <div className="big-reward">{money(s.reward)}</div>
          <p className="muted">{s.checkedInToday ? 'You\'ve checked in today. Come back tomorrow!' : 'Claim your free reward for today.'}</p>
          <p className="faint note">Base ₹{s.base}{s.tierBonus ? ` + ₹${s.tierBonus} tier bonus` : ''} · Streak: {s.streak} day{s.streak === 1 ? '' : 's'}</p>
          <button className="btn btn-accent btn-block" disabled={busy || s.checkedInToday} onClick={claim}>
            <Busy busy={busy}>{s.checkedInToday ? 'Checked in ✓' : 'Check in now'}</Busy>
          </button>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- lucky draw ---------- */
function LuckySheet({ onClose, onDone }) {
  const [s, setS] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [rot, setRot] = useState(0);
  const [result, setResult] = useState(null);
  const timer = useRef();
  useEffect(() => { getLucky().then(setS).catch((e) => notify(e.message, { type: 'error' })); return () => clearTimeout(timer.current); }, []);

  async function spin() {
    setSpinning(true); setResult(null);
    try {
      const r = await spinLucky();
      const n = s.prizes.length, seg = 360 / n;
      setRot((cur) => cur + 360 * 5 + (360 - (cur % 360)) - (r.index * seg + seg / 2));
      timer.current = setTimeout(() => {
        setResult(r.prize); setS((x) => ({ ...x, canSpin: false })); setSpinning(false); onDone();
        notify(r.prize ? `You won ${money(r.prize)}!` : 'No prize this time. Try again tomorrow!', { type: r.prize ? 'success' : undefined });
      }, 3200);
    } catch (ex) { setSpinning(false); notify(ex.message, { type: 'error' }); }
  }

  const n = s?.prizes.length || 0;
  const colors = ['#EEF0FA', '#E9F3ED', '#F9F1E2', '#F8ECEC'];
  const grad = n ? `conic-gradient(${s.prizes.map((_, i) => `${colors[i % 4]} ${(i * 100) / n}% ${((i + 1) * 100) / n}%`).join(',')})` : 'none';
  return (
    <Sheet title="Lucky draw" onClose={onClose}>
      {!s ? <div className="page-loading"><span className="spinner" /></div> : (
        <div className="center-col">
          <div className="wheel-wrap">
            <div className="wheel-pin" />
            <div className="wheel" style={{ background: grad, transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 3.2s cubic-bezier(.17,.67,.2,1)' : 'none' }}>
              {s.prizes.map((p, i) => (
                <span key={i} className="wheel-label" style={{ transform: `rotate(${(i + .5) * (360 / n)}deg) translateY(-92px)` }}>{p ? `₹${p}` : '✕'}</span>
              ))}
            </div>
          </div>
          {result !== null && <div className="big-reward">{result ? `+${money(result)}` : 'Better luck next time'}</div>}
          <p className="faint note">One free spin every day. Prizes from ₹1 to ₹100 are added to your withdrawal balance.</p>
          <button className="btn btn-accent btn-block" disabled={spinning || !s.canSpin} onClick={spin}>
            <Busy busy={spinning} label="Spinning…">{s.canSpin ? 'Spin now' : 'Come back tomorrow'}</Busy>
          </button>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- commission rates ---------- */
function RatesSheet({ onClose }) {
  const [cfg, setCfg] = useState(null);
  useEffect(() => { getConfig().then(setCfg).catch(() => {}); }, []);
  return (
    <Sheet title="Commission rates" onClose={onClose}>
      {!cfg ? <div className="page-loading"><span className="spinner" /></div> : (
        <>
          <p className="muted note">Earn a percentage every time someone in your team buys an investment plan. Commission goes straight to your withdrawal balance.</p>
          <ul className="rate-list">
            {cfg.commissionRates.map((r, i) => (
              <li key={i}><span className="rate-level">Level {i + 1}</span><span className="muted">{['Direct invites', 'Invited by your invites', 'Third generation'][i]}</span><strong>{r * 100}%</strong></li>
            ))}
          </ul>
          <p className="faint note">Example: a level-1 member buys ₹10,000 → you earn {money(10000 * cfg.commissionRates[0])}.</p>
        </>
      )}
    </Sheet>
  );
}
