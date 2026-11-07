import React, { useEffect, useState } from 'react';
import {
  captureTokenFromUrl, getToken, getCurrentSid, logout,
  getMe, getSummary, getTransactions, updateProfile,
  changePassword, getSessions, revokeSession, revokeOtherSessions, collectDevice,
} from './api.js';

const money = (n, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

export default function App() {
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    captureTokenFromUrl();
    if (!getToken()) { logout(); return; }
    Promise.all([getMe(), getSummary(), getTransactions()])
      .then(([me, sum, txs]) => {
        setUser(me.user);
        setSummary(sum.summary);
        setTransactions(txs.transactions);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (!user && !error) {
    return <div className="page"><div className="page-loading"><span className="spinner" /> Loading your account…</div></div>;
  }

  return (
    <div className="page">
      <header className="topbar">
        <img src="/logo.svg" alt="eearny" className="topbar-logo" />
        <div className="topbar-user">
          <span className="avatar">{(user?.name || '?').trim().charAt(0).toUpperCase()}</span>
          <span className="muted topbar-name">{user?.name}</span>
          <button className="btn btn-ghost btn-small" onClick={logout}>Sign out</button>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <h2 className="greeting">
        Welcome back, <em>{(user?.name || 'friend').split(' ')[0]}</em>
      </h2>

      {summary && (
        <section className="summary-grid">
          <SummaryCard label="Available balance" value={money(summary.balance, summary.currency)} tone="indigo" />
          <SummaryCard label="Total earned" value={money(summary.earned, summary.currency)} tone="mint" />
          <SummaryCard label="Pending rewards" value={money(summary.pending, summary.currency)} tone="amber" />
          <SummaryCard label="Withdrawn" value={money(summary.withdrawn, summary.currency)} tone="rose" />
        </section>
      )}

      <section className="lower-grid">
        <div className="card table-card">
          <h3>Recent activity</h3>
          <table>
            <thead>
              <tr><th>Description</th><th>Status</th><th className="num">Amount</th></tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="tx-title">{t.title}</div>
                    <div className="faint tx-date">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${t.status === 'paid' ? 'mint' : 'amber'}`}>{t.status}</span>
                  </td>
                  <td className={`num ${t.amount < 0 ? 'neg' : 'pos'}`}>
                    {t.amount < 0 ? '−' : '+'}{money(Math.abs(t.amount)).slice(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="stack">
          <ProfileCard user={user} onSaved={setUser} onError={setError} />
          <SecurityCard />
        </div>
      </section>
    </div>
  );
}

/* ---------- profile ---------- */

function ProfileCard({ user, onSaved, onError }) {
  const [nameDraft, setNameDraft] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => setNameDraft(user?.name || ''), [user?.name]);

  async function saveName(e) {
    e.preventDefault();
    setSavingName(true); setSavedNote(false); onError('');
    try {
      const { user: updated } = await updateProfile({ name: nameDraft });
      onSaved((u) => ({ ...u, name: updated.name }));
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2500);
    } catch (err) {
      onError(err.message);
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="card profile-card">
      <h3>Profile</h3>
      <p className="muted">{user?.email}</p>
      <form onSubmit={saveName}>
        <div className="field">
          <label htmlFor="display-name">Display name</label>
          <input id="display-name" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" disabled={savingName}>
          {savingName ? <><span className="spinner" /> Saving…</> : 'Save changes'}
        </button>
        {savedNote && <div className="alert alert-ok" style={{ marginTop: 12 }}>Profile updated.</div>}
      </form>
    </div>
  );
}

/* ---------- security: password + devices & sessions ---------- */

function SecurityCard() {
  return (
    <div className="card security-card">
      <h3>Security</h3>
      <PasswordForm />
      <SessionsPanel />
    </div>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [field, setField] = useState('');
  const [busy, setBusy] = useState(false);
  const [okNote, setOkNote] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError(''); setField(''); setOkNote('');
    if (form.next !== form.confirm) {
      setError('New passwords do not match'); setField('confirm'); return;
    }
    setBusy(true);
    try {
      const res = await changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      setOkNote(
        res.revokedOtherSessions > 0
          ? `Password changed — ${res.revokedOtherSessions} other session${res.revokedOtherSessions === 1 ? '' : 's'} signed out.`
          : 'Password changed.'
      );
    } catch (err) {
      setError(err.message); setField(err.field || '');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="pw-form">
      <h4>Change password</h4>
      {error && <div className="alert alert-error">{error}</div>}
      {okNote && <div className="alert alert-ok">{okNote}</div>}
      <div className="field">
        <label htmlFor="pw-current">Current password</label>
        <input id="pw-current" type="password" autoComplete="current-password" value={form.current}
          className={field === 'currentPassword' ? 'invalid' : ''}
          onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="pw-new">New password</label>
          <input id="pw-new" type="password" autoComplete="new-password" placeholder="8+ characters" value={form.next}
            className={field === 'newPassword' ? 'invalid' : ''}
            onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} />
        </div>
        <div className="field">
          <label htmlFor="pw-confirm">Confirm</label>
          <input id="pw-confirm" type="password" autoComplete="new-password" value={form.confirm}
            className={field === 'confirm' ? 'invalid' : ''}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />
        </div>
      </div>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? <><span className="spinner" /> Updating…</> : 'Update password'}
      </button>
    </form>
  );
}

function SessionsPanel() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');
  const currentSid = getCurrentSid();
  const thisDevice = collectDevice(); // for friendly labels on the current row

  async function refresh() {
    try {
      const { sessions: list } = await getSessions();
      setSessions(list);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function revokeOne(sid) {
    setError('');
    try {
      if (sid === currentSid) { logout(); return; }
      await revokeSession(sid);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function revokeOthers() {
    setError('');
    try {
      await revokeOtherSessions();
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const others = (sessions || []).filter((s) => s.sid !== currentSid).length;

  return (
    <div className="sessions-panel">
      <div className="sessions-head">
        <h4>Devices &amp; sessions</h4>
        {others > 0 && (
          <button className="linklike" onClick={revokeOthers}>
            Sign out {others} other session{others === 1 ? '' : 's'}
          </button>
        )}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {!sessions && <p className="faint">Loading sessions…</p>}
      {sessions && sessions.length === 0 && <p className="faint">No active sessions.</p>}
      <ul className="session-list">
        {sessions && sessions.map((s) => {
          const isCurrent = s.sid === currentSid;
          const label = isCurrent ? `${s.browser} · ${s.os} (this device)` : `${s.browser} · ${s.os}`;
          return (
            <li key={s.sid} className={isCurrent ? 'current' : ''}>
              <div className="session-main">
                <span className="session-label">{label}</span>
                {isCurrent && <span className="badge badge-mint">active now</span>}
                <span className="faint session-meta">
                  {s.deviceType === 'mobile' ? '📱' : '💻'} {s.screen || '—'} · {s.timezone || '—'}
                  {s.ip ? ` · IP ${s.ip}` : ''}
                </span>
                <span className="faint session-meta">
                  last seen {new Date(s.lastSeenAt).toLocaleString()} · fp {s.fingerprint || '—'}
                </span>
              </div>
              <button className="btn btn-ghost btn-small" onClick={() => revokeOne(s.sid)}>
                {isCurrent ? 'Sign out' : 'Revoke'}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="faint sessions-note">
        Each sign-in is fingerprinted (browser, OS, screen, timezone, language, canvas hash)
        so you can recognise and revoke any device. Revoking a session invalidates its token
        on every service immediately.
      </p>
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  return (
    <div className={`card summary-card tone-${tone}`}>
      <span className="summary-label">{label}</span>
      <span className="summary-value">{value}</span>
    </div>
  );
}
