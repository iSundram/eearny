import React, { useEffect, useState } from 'react';
import { login, register, forgotPassword, resetPassword, continueToMyAccount } from './api.js';

// Path-based routing (works on Cloudflare Pages via public/_redirects):
//   /        → sign in (step 1: email · step 2: password)
//   /signup  → create account (single step)
//   /forgot  → reset password request
//   /?reset=…→ choose a new password
// Trailing slashes are tolerated so /signup/ works the same as /signup.
const path = window.location.pathname.replace(/\/+$/, '') || '/';

export default function App() {
  useEffect(() => {
    const titles = {
      '/': 'Sign in — eearny',
      '/signup': 'Create account — eearny',
      '/forgot': 'Reset password — eearny',
    };
    if (titles[path]) document.title = titles[path];
  }, []);

  let view = <LoginFlow />;
  if (path === '/signup') view = <SignupPage />;
  else if (path === '/forgot') view = <ForgotPage />;
  else if (path !== '/') view = <RedirectHome />;

  return (
    <div className="auth-page">
      <div className="auth-glow" aria-hidden="true" />
      {new URLSearchParams(window.location.search).get('reset') && path === '/' ? (
        <ResetView token={new URLSearchParams(window.location.search).get('reset') || ''} />
      ) : (
        view
      )}
    </div>
  );
}

function RedirectHome() {
  useEffect(() => { window.location.replace('/'); }, []);
  return null;
}

/* ---------- sign in: step 1 (email) → step 2 (password) ---------- */

function LoginFlow() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');

  return step === 1 ? (
    <form className="card auth-card" onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
      <h2 className="auth-title">Sign in to eearny</h2>
      <p className="muted auth-sub">Enter your email to continue.</p>
      <Field id="email" label="Email" type="email" placeholder="you@example.com" autoComplete="email"
        value={email} onChange={setEmail} autoFocus />
      <button className="btn btn-accent btn-block" disabled={!email.trim()}>
        Continue <span className="btn-arrow">→</span>
      </button>
      <div className="auth-links split">
        <a href="/signup/">Create an account</a>
        <a href="/forgot/">Forgot password?</a>
      </div>
      <div className="card-foot"><img src="/logo.svg" alt="eearny" /></div>
    </form>
  ) : (
    <PasswordStep email={email} onNotYou={() => { setEmail(''); setStep(1); }} />
  );
}

function PasswordStep({ email, onNotYou }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { token } = await login(email, password);
      continueToMyAccount(token);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={submit}>
      <h2 className="auth-title">Welcome back</h2>
      <p className="muted auth-sub">Good to see you again — enter your password.</p>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="email-chip">
        <span className="email-chip-address">{email}</span>
        <button type="button" className="linklike" onClick={onNotYou}>Not you?</button>
      </div>
      <Field id="password" label="Password" type="password" placeholder="Your password"
        autoComplete="current-password" value={password} onChange={setPassword} autoFocus />
      <button className="btn btn-accent btn-block" disabled={busy || !password}>
        {busy ? <><span className="spinner" /> Signing in…</> : 'Sign in'}
      </button>
      <div className="auth-links">
        <a href="/forgot/">Forgot password?</a>
      </div>
      <div className="card-foot"><img src="/logo.svg" alt="eearny" /></div>
    </form>
  );
}

/* ---------- /signup ---------- */

function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [field, setField] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(''); setField('');
    try {
      const { token } = await register(form.name, form.email, form.password);
      continueToMyAccount(token);
    } catch (err) {
      setError(err.message); setField(err.field || ''); setBusy(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={submit}>
      <h2 className="auth-title">Create your account</h2>
      <p className="muted auth-sub">Set up in seconds.</p>
      {error && <div className="alert alert-error">{error}</div>}
      <Field id="name" label="Full name" placeholder="Ada Lovelace" autoComplete="name"
        value={form.name} invalid={field === 'name'}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
      <Field id="email" label="Email" type="email" placeholder="you@example.com" autoComplete="email"
        value={form.email} invalid={field === 'email'}
        onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
      <Field id="password" label="Password" type="password" placeholder="At least 8 characters" autoComplete="new-password"
        value={form.password} invalid={field === 'password'}
        onChange={(v) => setForm((f) => ({ ...f, password: v }))} />
      <button className="btn btn-accent btn-block" disabled={busy}>
        {busy ? <><span className="spinner" /> Creating account…</> : 'Create account'}
      </button>
      <div className="auth-links">
        <a href="/">Already have an account? Sign in</a>
      </div>
      <div className="card-foot"><img src="/logo.svg" alt="eearny" /></div>
    </form>
  );
}

/* ---------- /forgot ---------- */

function ForgotPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [field, setField] = useState('');
  const [busy, setBusy] = useState(false);
  const [devLink, setDevLink] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(''); setField(''); setDevLink('');
    try {
      const data = await forgotPassword(email);
      // dev: no mailer is configured, so the reset link is shown directly
      setDevLink(data.resetUrl || '');
    } catch (err) {
      setError(err.message); setField(err.field || '');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={submit}>
      <h2 className="auth-title">Reset your password</h2>
      <p className="muted auth-sub">Enter the email you signed up with.</p>
      {error && <div className="alert alert-error">{error}</div>}
      {devLink && (
        <div className="alert alert-ok">
          Reset link ready (dev mode — no mailer configured):{' '}
          <a href={devLink}>open reset page</a>
        </div>
      )}
      <Field id="email" label="Email" type="email" placeholder="you@example.com" autoComplete="email"
        value={email} invalid={field === 'email'} onChange={setEmail} />
      <button className="btn btn-accent btn-block" disabled={busy}>
        {busy ? <><span className="spinner" /> Sending…</> : 'Send reset link'}
      </button>
      <div className="auth-links">
        <a href="/">← Back to sign in</a>
      </div>
      <div className="card-foot"><img src="/logo.svg" alt="eearny" /></div>
    </form>
  );
}

/* ---------- /?reset=… ---------- */

function ResetView({ token }) {
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [field, setField] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState({}, '', window.location.pathname);
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match'); setField('confirm'); return;
    }
    setBusy(true); setError(''); setField('');
    try {
      await resetPassword(token, form.password);
      setDone(true);
    } catch (err) {
      setError(err.message); setField(err.field || '');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="card auth-card">
        <h2 className="auth-title">Reset your password</h2>
        <div className="alert alert-error">This reset link is missing its token.</div>
        <div className="auth-links"><a href="/">← Back to sign in</a></div>
        <div className="card-foot"><img src="/logo.svg" alt="eearny" /></div>
      </div>
    );
  }

  return (
    <form className="card auth-card" onSubmit={submit}>
      <h2 className="auth-title">Choose a new password</h2>
      {done ? (
        <>
          <div className="alert alert-ok">Password updated — all devices were signed out.</div>
          <a className="btn btn-accent btn-block" href="/">Sign in with your new password</a>
        </>
      ) : (
        <>
          {error && <div className="alert alert-error">{error}</div>}
          <Field id="password" label="New password" type="password" placeholder="At least 8 characters" autoComplete="new-password"
            value={form.password} invalid={field === 'password'}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))} />
          <Field id="confirm" label="Confirm new password" type="password" placeholder="Repeat it" autoComplete="new-password"
            value={form.confirm} invalid={field === 'confirm'}
            onChange={(v) => setForm((f) => ({ ...f, confirm: v }))} />
          <button className="btn btn-accent btn-block" disabled={busy}>
            {busy ? <><span className="spinner" /> Saving…</> : 'Set new password'}
          </button>
          <p className="faint auth-sub" style={{ marginTop: 14 }}>All devices will be signed out after the reset.</p>
        </>
      )}
      <div className="card-foot"><img src="/logo.svg" alt="eearny" /></div>
    </form>
  );
}

/* ---------- shared field ---------- */

function Field({ id, label, type = 'text', placeholder, autoComplete, value, invalid, onChange, autoFocus }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={invalid ? 'invalid' : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
