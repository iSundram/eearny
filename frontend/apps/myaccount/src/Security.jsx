import React, { useEffect, useState } from 'react';
import {
  getCurrentSid, logout, updateProfile, changePassword,
  getSessions, revokeSession, revokeOtherSessions, collectDevice,
} from './api.js';
import { notify } from '../../../packages/toast.jsx';
import { Icon } from './ui.jsx';

/* ---------- profile ---------- */

export function ProfileCard({ user, onSaved, onError }) {
  const [nameDraft, setNameDraft] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => setNameDraft(user?.name || ''), [user?.name]);

  async function saveName(e) {
    e.preventDefault();
    setSavingName(true); onError('');
    try {
      const { user: updated } = await updateProfile({ name: nameDraft });
      onSaved((u) => ({ ...u, name: updated.name }));
      notify('Profile updated.', { type: 'success' });
    } catch (err) {
      onError(err.message);
      notify(err.message, { type: 'error' });
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="card profile-card">
      <div className="section-head">
        <div>
          <h3>Profile details</h3>
          <p className="muted section-sub">{user?.email}</p>
        </div>
      </div>
      <form onSubmit={saveName}>
        <div className="field">
          <label htmlFor="display-name">Display name</label>
          <input id="display-name" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={savingName}>
          {savingName ? <><span className="spinner" /> Saving…</> : 'Save changes'}
        </button>
      </form>
    </div>
  );
}

/* ---------- security: password + devices & sessions ---------- */

export function SecurityCard() {
  return (
    <div className="card security-card">
      <div className="section-head">
        <div>
          <h3>Security &amp; sessions</h3>
          <p className="muted section-sub">Manage credentials and active device authorizations</p>
        </div>
      </div>
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

  async function submit(e) {
    e.preventDefault();
    setError(''); setField('');
    if (form.next !== form.confirm) {
      setError('New passwords do not match'); setField('confirm');
      notify('New passwords do not match', { type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const res = await changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      notify(
        res.revokedOtherSessions > 0
          ? `Password changed — ${res.revokedOtherSessions} other session${res.revokedOtherSessions === 1 ? '' : 's'} signed out.`
          : 'Password changed.',
        { type: 'success' }
      );
    } catch (err) {
      setError(err.message); setField(err.field || '');
      notify(err.message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="pw-form">
      <h4>Change password</h4>
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
      {error && <div className="field-error" style={{ marginBottom: 12 }}>{error}</div>}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? <><span className="spinner" /> Updating…</> : 'Update password'}
      </button>
    </form>
  );
}

function SessionsPanel() {
  const [sessions, setSessions] = useState(null);
  const currentSid = getCurrentSid();
  collectDevice();

  async function refresh() {
    try {
      const { sessions: list } = await getSessions();
      setSessions(list);
    } catch (err) {
      notify(err.message, { type: 'error' });
    }
  }

  useEffect(() => { refresh(); }, []);

  async function revokeOne(sid) {
    try {
      if (sid === currentSid) { logout(); return; }
      await revokeSession(sid);
      notify('Session revoked — that device is signed out.', { type: 'success' });
      refresh();
    } catch (err) {
      notify(err.message, { type: 'error' });
    }
  }

  async function revokeOthers() {
    try {
      const res = await revokeOtherSessions();
      notify(`Signed out ${res.revoked} other session${res.revoked === 1 ? '' : 's'}.`, { type: 'success' });
      refresh();
    } catch (err) {
      notify(err.message, { type: 'error' });
    }
  }

  const others = (sessions || []).filter((s) => s.sid !== currentSid).length;

  return (
    <div className="sessions-panel">
      <div className="sessions-head">
        <h4>Active devices</h4>
        {others > 0 && (
          <button className="linklike" onClick={revokeOthers}>
            Sign out {others} other session{others === 1 ? '' : 's'}
          </button>
        )}
      </div>
      {!sessions && <p className="faint">Loading sessions…</p>}
      {sessions && sessions.length === 0 && <p className="faint">No active sessions.</p>}
      <ul className="session-list">
        {sessions && sessions.map((s) => {
          const isCurrent = s.sid === currentSid;
          const label = isCurrent ? `${s.browser} · ${s.os} (this device)` : `${s.browser} · ${s.os}`;
          return (
            <li key={s.sid} className={isCurrent ? 'current' : ''}>
              <div className="session-device-icon">
                <Icon name={s.deviceType === 'mobile' ? 'smartphone' : 'monitor'} size={18} />
              </div>
              <div className="session-main">
                <div className="session-label-row">
                  <span className="session-label">{label}</span>
                  {isCurrent && <span className="badge badge-mint"><span className="status-dot" />Active now</span>}
                </div>
                <span className="faint session-meta">
                  {s.screen || '—'} · {s.timezone || '—'}
                  {s.ip ? ` · IP ${s.ip}` : ''}
                </span>
                <span className="faint session-meta">
                  Last active {new Date(s.lastSeenAt).toLocaleString()} · ID {s.fingerprint || '—'}
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
        Every sign-in is fingerprinted across browser, OS, display, timezone, and canvas signature so you can audit and revoke access immediately.
      </p>
    </div>
  );
}
