import React, { useEffect, useState } from 'react';
import { getPlans, getInvestments, invest } from './api.js';
import { notify } from '../../../packages/toast.jsx';
import { Sheet, Busy, Empty, money } from './ui.jsx';

export default function Invest({ wallet, refresh }) {
  const [tab, setTab] = useState('plans');
  const [plans, setPlans] = useState(null);
  const [mine, setMine] = useState(null);
  const [buying, setBuying] = useState(null);

  const loadMine = () => getInvestments().then((r) => setMine(r.investments)).catch((e) => notify(e.message, { type: 'error' }));
  useEffect(() => {
    getPlans().then((r) => setPlans(r.plans)).catch((e) => notify(e.message, { type: 'error' }));
    loadMine();
  }, []);

  const activeCount = (mine || []).filter((i) => i.status === 'active').length;

  return (
    <>
      <div className="welcome-bar">
        <div>
          <span className="eyebrow">Yield Instruments</span>
          <h2 className="page-title" style={{ margin: 0 }}>Investment plans</h2>
        </div>
        <div className="balance-pill">
          <span className="faint">Balance</span>
          <strong>{money(wallet.balance)}</strong>
        </div>
      </div>

      <div className="seg seg-wide">
        <button className={tab === 'plans' ? 'on' : ''} onClick={() => setTab('plans')}>Available plans</button>
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => { setTab('mine'); loadMine(); }}>
          My portfolio{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>

      {tab === 'plans' && (!plans ? <div className="page-loading"><span className="spinner" /></div> : (
        <div className="plan-list">
          {plans.map((p, idx) => {
            const featured = idx === 2 || idx === 3; // Silver & Gold highlighted
            return (
              <div key={p.id} className={`card plan ${featured ? 'plan-featured' : ''}`}>
                <div className="plan-head">
                  <div>
                    <span className="eyebrow">{p.days}-Day Fixed Term</span>
                    <h3>{p.name} Unit</h3>
                  </div>
                  <span className="badge badge-mint">+{p.roiPercent}% net return</span>
                </div>
                <div className="plan-grid">
                  <div className="plan-metric">
                    <span className="faint">Unit price</span>
                    <strong>{money(p.unitPrice)}</strong>
                  </div>
                  <div className="plan-metric">
                    <span className="faint">Daily revenue</span>
                    <strong className="pos-text">+{money(p.dailyRevenue)}</strong>
                  </div>
                  <div className="plan-metric">
                    <span className="faint">Cycle length</span>
                    <strong>{p.days} days</strong>
                  </div>
                  <div className="plan-metric">
                    <span className="faint">Total revenue</span>
                    <strong>{money(p.totalRevenue)}</strong>
                  </div>
                </div>
                <button className={`btn ${featured ? 'btn-accent' : 'btn-primary'} btn-block`} onClick={() => setBuying(p)}>
                  Allocate {money(p.unitPrice)}
                </button>
              </div>
            );
          })}
        </div>
      ))}

      {tab === 'mine' && (!mine ? <div className="page-loading"><span className="spinner" /></div> : mine.length === 0 ? (
        <Empty icon="trend" title="No active allocations" hint="Acquire an investment unit to begin earning daily INR revenue." />
      ) : (
        <div className="plan-list">
          {mine.map((i) => (
            <div key={i.id} className="card plan">
              <div className="plan-head">
                <div>
                  <span className="eyebrow">Started {new Date(i.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <h3>{i.name} <span className="faint">×{i.units}</span></h3>
                </div>
                <span className={`badge badge-${i.status === 'active' ? 'mint' : 'amber'}`}>
                  <span className="status-dot" />{i.status}
                </span>
              </div>
              <div>
                <div className="progress-header">
                  <span className="faint">Payout cycle progress</span>
                  <strong>{i.daysPaid} / {i.days} days</strong>
                </div>
                <div className="progress"><span style={{ width: `${Math.max(3, (i.daysPaid / i.days) * 100)}%` }} /></div>
              </div>
              <div className="plan-grid">
                <div className="plan-metric"><span className="faint">Capital deployed</span><strong>{money(i.invested)}</strong></div>
                <div className="plan-metric"><span className="faint">Daily yield</span><strong className="pos-text">+{money(i.dailyRevenue * i.units)}</strong></div>
                <div className="plan-metric"><span className="faint">Accrued to date</span><strong>{money(i.earned)}</strong></div>
                <div className="plan-metric"><span className="faint">Projected total</span><strong>{money(i.totalRevenue)}</strong></div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {buying && <BuySheet plan={buying} wallet={wallet} onClose={() => setBuying(null)}
        onDone={() => { refresh(); loadMine(); setTab('mine'); }} />}
    </>
  );
}

function BuySheet({ plan, wallet, onClose, onDone }) {
  const [units, setUnits] = useState(1);
  const [source, setSource] = useState('balance');
  const [busy, setBusy] = useState(false);
  const cost = plan.unitPrice * units;
  const avail = source === 'balance' ? wallet.balance : wallet.withdrawable;
  const short = cost > avail;

  async function buy() {
    setBusy(true);
    try {
      await invest(plan.id, units, source);
      notify(`${plan.name} ×${units} allocated.`, { type: 'success' });
      onDone(); onClose();
    } catch (ex) { notify(ex.message, { type: 'error' }); } finally { setBusy(false); }
  }
  return (
    <Sheet title={`Allocate ${plan.name}`} subtitle={`${plan.days}-day fixed daily revenue contract`} onClose={onClose}>
      <div className="buy-qty">
        <span>Number of units (max 10)</span>
        <div className="stepper">
          <button type="button" onClick={() => setUnits((u) => Math.max(1, u - 1))} aria-label="Decrease units">−</button>
          <strong>{units}</strong>
          <button type="button" onClick={() => setUnits((u) => Math.min(10, u + 1))} aria-label="Increase units">+</button>
        </div>
      </div>
      <ul className="plain-list">
        <li><span>Unit price</span><strong>{money(plan.unitPrice)}</strong></li>
        <li><span>Total allocation</span><strong>{money(cost)}</strong></li>
        <li><span>Daily revenue credited</span><strong className="pos-text">+{money(plan.dailyRevenue * units)} / day</strong></li>
        <li><span>Total {plan.days}-day payout</span><strong>{money(plan.totalRevenue * units)}</strong></li>
      </ul>
      <div className="field-label-row" style={{ marginTop: 16, marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>Debit from wallet</label>
      </div>
      <div className="seg seg-wide">
        <button type="button" className={source === 'balance' ? 'on' : ''} onClick={() => setSource('balance')}>
          Recharge ({money(wallet.balance)})
        </button>
        <button type="button" className={source === 'withdrawable' ? 'on' : ''} onClick={() => setSource('withdrawable')}>
          Withdrawal ({money(wallet.withdrawable)})
        </button>
      </div>
      {short && <p className="field-error" style={{ marginTop: 8 }}>Insufficient funds — {money(cost - avail)} additional balance required.</p>}
      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy || short} onClick={buy}>
        <Busy busy={busy} label="Allocating…">Confirm &amp; pay {money(cost)}</Busy>
      </button>
    </Sheet>
  );
}
