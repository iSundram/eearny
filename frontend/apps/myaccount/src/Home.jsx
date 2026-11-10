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

  const firstName = (user.name || 'Member').split(' ')[0];

  return (
    <>
      <div className="welcome-bar">
        <div>
          <span className="eyebrow">Portfolio Overview</span>
          <h2 className="greeting">Welcome back, <em>{firstName}</em></h2>
        </div>
        <button className="tier-pill" onClick={() => go('account', 'overview')}>
          <Icon name="award" size={15} />
          <span>{wallet.tier.name} Tier</span>
        </button>
      </div>

      {/* Primary Focal Anchor: Obsidian Vault Card */}
      <section className="vault-card">
        <div className="vault-glow" aria-hidden="true" />
        <div className="vault-top">
          <div>
            <span className="vault-label">Available Balance</span>
            <div className="vault-value">{money(wallet.balance)}</div>
          </div>
          <span className="vault-currency">INR · Instant</span>
        </div>
        <div className="vault-divider" />
        <div className="vault-actions">
          <button className="btn btn-vault-primary" onClick={() => setSheet('topup')}>
            <Icon name="plus" size={17} /> Top up balance
          </button>
          <button className="btn btn-vault-secondary" onClick={() => setSheet('withdraw')}>
            <Icon name="arrowUpRight" size={17} /> Withdraw funds
          </button>
        </div>
      </section>

      {/* Secondary Bento Pair: Product Income & Withdrawal Balance */}
      <section className="bento-grid">
        <div className="card bento-card" onClick={() => go('invest')} role="button" tabIndex={0}>
          <div className="bento-head">
            <span className="bento-icon tone-mint-bg"><Icon name="trend" size={18} /></span>
            <span className="badge badge-mint">+{money(wallet.dailyIncome)}/day</span>
          </div>
          <span className="summary-label">Product income</span>
          <span className="bento-value">{money(wallet.productIncome)}</span>
          <span className="faint stat-sub">
            {wallet.activeInvestments} active plan{wallet.activeInvestments === 1 ? '' : 's'}
          </span>
        </div>

        <div className="card bento-card" onClick={() => setSheet('withdraw')} role="button" tabIndex={0}>
          <div className="bento-head">
            <span className="bento-icon tone-indigo-bg"><Icon name="arrowUpRight" size={18} /></span>
            <span className="badge badge-indigo">Liquid</span>
          </div>
          <span className="summary-label">Withdrawal balance</span>
          <span className="bento-value">{money(wallet.withdrawable)}</span>
          <span className="faint stat-sub">Settled &amp; ready to payout</span>
        </div>
      </section>

      {/* Structured Action Hub */}
      <div className="section-header-row">
        <h3 className="section-heading">Rewards &amp; Network</h3>
        <span className="faint section-caption">Daily perks &amp; referral tiers</span>
      </div>

      <section className="action-grid">
        <ActionTile
          icon="check"
          tone="mint"
          label="Daily check-in"
          sub="Claim daily reward"
          badge="₹5+"
          onClick={() => setSheet('checkin')}
        />
        <ActionTile
          icon="gift"
          tone="amber"
          label="Lucky draw"
          sub="Daily prize wheel"
          badge="Free spin"
          onClick={() => setSheet('lucky')}
        />
        <ActionTile
          icon="users"
          tone="indigo"
          label="My referrals"
          sub="Invite &amp; track team"
          onClick={() => setSheet('referrals')}
        />
        <ActionTile
          icon="percent"
          tone="indigo"
          label="Commission rates"
          sub="10% · 5% · 2% structure"
          onClick={() => setSheet('rates')}
        />
        <ActionTile
          icon="trend"
          tone="mint"
          label="Investment plans"
          sub="View fixed-return units"
          onClick={() => go('invest')}
        />
        <ActionTile
          icon="list"
          tone="neutral"
          label="Ledger activity"
          sub="All credits &amp; payouts"
          onClick={() => go('account', 'transactions')}
        />
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

function ActionTile({ icon, tone = 'indigo', label, sub, badge, onClick }) {
  return (
    <button className="action-tile" onClick={onClick}>
      <div className="action-tile-top">
        <span className={`action-tile-icon tone-${tone}-bg`}><Icon name={icon} size={19} /></span>
        {badge ? <span className={`badge badge-${tone}`}>{badge}</span> : <span className="tile-arrow"><Icon name="chevronRight" size={16} /></span>}
      </div>
      <div className="action-tile-Text">
        <span className="action-tile-label">{label}</span>
        {sub && <span className="action-tile-sub">{sub}</span>}
      </div>
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
    <Sheet title="Top up balance" subtitle="Instant INR deposit to your recharge wallet" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Amount (INR)" hint="Min ₹100" error={err}>
          <input type="number" min="1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount in ₹" autoFocus />
        </Field>
        <div className="chips">
          {PRESETS.map((p) => (
            <button type="button" key={p} className={`chip ${Number(amount) === p ? 'on' : ''}`} onClick={() => setAmount(String(p))}>
              {money(p)}
            </button>
          ))}
        </div>
        <Field label="Payment source">
          <select value={methodId} onChange={(e) => setMethodId(e.target.value)}>
            <option value="">UPI Instant Transfer</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <p className="faint note">Funds are credited immediately with zero deposit fees.</p>
        <button className="btn btn-primary btn-block" disabled={busy || !amount}>
          <Busy busy={busy} label="Processing…">Deposit {amount ? money(Number(amount)) : 'funds'}</Busy>
        </button>
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

  if (!methods) return <Sheet title="Withdraw funds" onClose={onClose}><div className="page-loading"><span className="spinner" /></div></Sheet>;
  if (adding || methods.length === 0) {
    return (
      <Sheet title="Add payout destination" subtitle="Save a UPI ID or bank account to receive withdrawals" onClose={onClose}>
        <MethodForm onAdded={(m) => { setMethodId(m.id); setAdding(false); load(); }} onCancel={methods.length ? () => setAdding(false) : undefined} />
      </Sheet>
    );
  }
  return (
    <Sheet title="Withdraw funds" subtitle="Transfer settled earnings to your bank or UPI" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="avail-banner">
          <span>Available to withdraw</span>
          <strong>{money(wallet.withdrawable)}</strong>
        </div>
        <Field label="Withdrawal amount (INR)" hint="Min ₹200" error={err}>
          <input type="number" min="1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" autoFocus />
        </Field>
        <div className="chips">
          <button type="button" className="chip" onClick={() => setAmount(String(Math.floor(wallet.withdrawable)))}>
            Withdraw Max ({money(Math.floor(wallet.withdrawable))})
          </button>
        </div>
        <Field label="Destination account" hint={<button type="button" className="linklike" onClick={() => setAdding(true)}>+ Add new</button>}>
          <select value={methodId} onChange={(e) => setMethodId(e.target.value)}>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy || !amount}>
          <Busy busy={busy} label="Submitting…">Confirm withdrawal</Busy>
        </button>
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

  const link = data ? `${window.location.origin}/signup/?ref=${data.code}` : '';
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
    <Sheet title="Referral network" subtitle="Multi-tier commission program across 3 levels" onClose={onClose}>
      {!data ? <div className="page-loading"><span className="spinner" /></div> : (
        <>
          <div className="refcode-box">
            <div>
              <span className="eyebrow">Personal Invite Code</span>
              <strong className="refcode-value">{data.code}</strong>
            </div>
            <div className="row-actions">
              <button className="btn btn-ghost btn-small" onClick={() => copy(data.code, 'Code')}><Icon name="copy" size={15} /> Copy</button>
              <button className="btn btn-accent btn-small" onClick={share}>Share link</button>
            </div>
          </div>
          <div className="stat-grid">
            <div className="card stat"><span className="summary-label">Network size</span><span className="stat-value">{data.totalMembers}</span></div>
            <div className="card stat"><span className="summary-label">Total commission</span><span className="stat-value">{money(data.totalCommission)}</span></div>
          </div>
          <table className="mini">
            <thead><tr><th>Tier</th><th>Commission</th><th>Members</th><th className="num">Earned</th></tr></thead>
            <tbody>{data.levels.map((l) => (
              <tr key={l.level}><td>Level {l.level}</td><td><span className="badge badge-indigo">{l.rate * 100}%</span></td><td>{l.members}</td><td className="num">{money(l.earned)}</td></tr>
            ))}</tbody>
          </table>
          {data.recent.length > 0 && (
            <>
              <h4 className="sub-h">Recent direct referrals</h4>
              <ul className="plain-list">{data.recent.map((m, i) => (
                <li key={i}><span>{m.name}</span><span className="faint">Invested {money(m.invested)}</span></li>
              ))}</ul>
            </>
          )}
          {data.referredBy ? (
            <p className="faint note">Referred by member {data.referredBy}.</p>
          ) : (
            <form onSubmit={redeem} className="redeem">
              <Field label="Link inviter code">
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
      setS(r); notify(`${money(r.reward)} check-in reward claimed.`, { type: 'success' }); onDone();
    } catch (ex) { notify(ex.message, { type: 'error' }); } finally { setBusy(false); }
  }
  return (
    <Sheet title="Daily attendance" subtitle="Check in once every calendar day (IST) for instant rewards" onClose={onClose}>
      {!s ? <div className="page-loading"><span className="spinner" /></div> : (
        <div className="reward-showcase">
          <span className="reward-badge"><Icon name="check" size={20} /></span>
          <div className="big-reward">{money(s.reward)}</div>
          <p className="muted">
            {s.checkedInToday
              ? 'Today\'s attendance reward has been credited to your withdrawal wallet.'
              : 'Available to claim right now — credited directly to your withdrawal balance.'}
          </p>
          <div className="reward-meta-pills">
            <span className="badge badge-indigo">Base ₹{s.base}{s.tierBonus ? ` + ₹${s.tierBonus} tier` : ''}</span>
            <span className="badge badge-mint">{s.streak} day streak</span>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy || s.checkedInToday} onClick={claim}>
            <Busy busy={busy}>{s.checkedInToday ? 'Claimed for today' : 'Claim daily reward'}</Busy>
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
        notify(r.prize ? `You won ${money(r.prize)} in the daily draw.` : 'No prize this round — try again tomorrow.', { type: r.prize ? 'success' : undefined });
      }, 3200);
    } catch (ex) { setSpinning(false); notify(ex.message, { type: 'error' }); }
  }

  const n = s?.prizes.length || 0;
  const colors = ['#F4F5FB', '#EBF5F0', '#FBF5EA', '#FAEEEE'];
  const grad = n ? `conic-gradient(${s.prizes.map((_, i) => `${colors[i % 4]} ${(i * 100) / n}% ${((i + 1) * 100) / n}%`).join(',')})` : 'none';
  return (
    <Sheet title="Daily lucky draw" subtitle="One complimentary spin per day — prizes up to ₹100" onClose={onClose}>
      {!s ? <div className="page-loading"><span className="spinner" /></div> : (
        <div className="center-col">
          <div className="wheel-wrap">
            <div className="wheel-pin" />
            <div className="wheel" style={{ background: grad, transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 3.2s cubic-bezier(.17,.67,.2,1)' : 'none' }}>
              {s.prizes.map((p, i) => (
                <span key={i} className="wheel-label" style={{ transform: `rotate(${(i + .5) * (360 / n)}deg) translateY(-88px)` }}>
                  {p ? `₹${p}` : '₹0'}
                </span>
              ))}
              <div className="wheel-center" />
            </div>
          </div>
          {result !== null && (
            <div className="big-reward">{result ? `+${money(result)}` : 'No prize today'}</div>
          )}
          <p className="faint note">All winnings are credited immediately to your liquid withdrawal balance.</p>
          <button className="btn btn-primary btn-block" disabled={spinning || !s.canSpin} onClick={spin}>
            <Busy busy={spinning} label="Spinning wheel…">{s.canSpin ? 'Spin the wheel' : 'Used today — returns tomorrow'}</Busy>
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
    <Sheet title="Commission structure" subtitle="Automatic instant payouts when your network invests" onClose={onClose}>
      {!cfg ? <div className="page-loading"><span className="spinner" /></div> : (
        <>
          <ul className="rate-list">
            {cfg.commissionRates.map((r, i) => (
              <li key={i}>
                <div>
                  <span className="rate-level">Level {i + 1}</span>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {['Direct invites (1st generation)', 'Secondary invites (2nd generation)', 'Extended network (3rd generation)'][i]}
                  </div>
                </div>
                <strong>{r * 100}%</strong>
              </li>
            ))}
          </ul>
          <div className="avail-banner" style={{ marginTop: 14 }}>
            <span>Example: ₹10,000 Level-1 purchase</span>
            <strong>+{money(10000 * cfg.commissionRates[0])}</strong>
          </div>
        </>
      )}
    </Sheet>
  );
}
