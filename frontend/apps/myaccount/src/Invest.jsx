import React, { useEffect, useState } from 'react';
import { getPlans, getInvestments, invest } from './api.js';
import { notify } from '../../../packages/toast.jsx';
import { Sheet, Busy, Empty, Icon, money } from './ui.jsx';

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

  return (
    <>
      <h2 className="page-title">Invest</h2>
      <div className="seg seg-wide">
        <button className={tab === 'plans' ? 'on' : ''} onClick={() => setTab('plans')}>Plans</button>
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => { setTab('mine'); loadMine(); }}>My investments{mine?.some((i) => i.status === 'active') ? ` (${mine.filter((i) => i.status === 'active').length})` : ''}</button>
      </div>

      {tab === 'plans' && (!plans ? <div className="page-loading"><span className="spinner" /></div> : (
        <div className="plan-list">
          {plans.map((p) => (
            <div key={p.id} className="card plan">
              <div className="plan-head">
                <h3>{p.name}</h3>
                <span className="badge badge-mint">+{p.roiPercent}% return</span>
              </div>
              <div className="plan-grid">
                <div><span className="faint">Unit price</span><strong>{money(p.unitPrice)}</strong></div>
                <div><span className="faint">Daily revenue</span><strong>{money(p.dailyRevenue)}</strong></div>
                <div><span className="faint">Duration</span><strong>{p.days} days</strong></div>
                <div><span className="faint">Total revenue</span><strong>{money(p.totalRevenue)}</strong></div>
              </div>
              <button className="btn btn-primary btn-block" onClick={() => setBuying(p)}>Buy now</button>
            </div>
          ))}
        </div>
      ))}

      {tab === 'mine' && (!mine ? <div className="page-loading"><span className="spinner" /></div> : mine.length === 0 ? (
        <Empty icon="trend" title="No investments yet" hint="Buy a plan to start earning daily revenue." />
      ) : (
        <div className="plan-list">
          {mine.map((i) => (
            <div key={i.id} className="card plan">
              <div className="plan-head">
                <h3>{i.name} <span className="faint">×{i.units}</span></h3>
                <span className={`badge badge-${i.status === 'active' ? 'mint' : 'amber'}`}>{i.status}</span>
              </div>
              <div className="progress"><span style={{ width: `${(i.daysPaid / i.days) * 100}%` }} /></div>
              <div className="faint progress-text">{i.daysPaid} of {i.days} days paid</div>
              <div className="plan-grid">
                <div><span className="faint">Invested</span><strong>{money(i.invested)}</strong></div>
                <div><span className="faint">Daily revenue</span><strong>{money(i.dailyRevenue * i.units)}</strong></div>
                <div><span className="faint">Earned so far</span><strong>{money(i.earned)}</strong></div>
                <div><span className="faint">Total revenue</span><strong>{money(i.totalRevenue)}</strong></div>
              </div>
              <div className="faint progress-text">Started {new Date(i.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
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
      notify(`${plan.name} ×${units} purchased.`, { type: 'success' });
      onDone(); onClose();
    } catch (ex) { notify(ex.message, { type: 'error' }); } finally { setBusy(false); }
  }
  return (
    <Sheet title={`Buy ${plan.name}`} onClose={onClose}>
      <div className="buy-qty">
        <span>Units</span>
        <div className="stepper">
          <button onClick={() => setUnits((u) => Math.max(1, u - 1))} aria-label="Fewer">−</button>
          <strong>{units}</strong>
          <button onClick={() => setUnits((u) => Math.min(10, u + 1))} aria-label="More">+</button>
        </div>
      </div>
      <ul className="plain-list">
        <li><span>Unit price</span><strong>{money(plan.unitPrice)}</strong></li>
        <li><span>Total cost</span><strong>{money(cost)}</strong></li>
        <li><span>Daily revenue</span><strong>{money(plan.dailyRevenue * units)}</strong></li>
        <li><span>Revenue over {plan.days} days</span><strong>{money(plan.totalRevenue * units)}</strong></li>
      </ul>
      <div className="seg seg-wide" style={{ marginTop: 14 }}>
        <button className={source === 'balance' ? 'on' : ''} onClick={() => setSource('balance')}>Balance {money(wallet.balance)}</button>
        <button className={source === 'withdrawable' ? 'on' : ''} onClick={() => setSource('withdrawable')}>Withdrawal {money(wallet.withdrawable)}</button>
      </div>
      {short && <p className="field-error" style={{ marginTop: 10 }}>Not enough funds — {money(cost - avail)} short. Top up from Home.</p>}
      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy || short} onClick={buy}>
        <Busy busy={busy} label="Purchasing…">Pay {money(cost)}</Busy>
      </button>
    </Sheet>
  );
}
