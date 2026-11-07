import { collectDevice } from '../../../packages/fingerprint.js';

const API_BASE = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:4001';
const MYACCOUNT_URL = import.meta.env.VITE_MYACCOUNT_URL || 'http://localhost:5174';

async function call(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.field = data.field;
    throw err;
  }
  return data;
}

export function login(email, password) {
  return call('/api/auth/login', { email, password, device: collectDevice() });
}

export function register(name, email, password) {
  return call('/api/auth/register', { name, email, password, device: collectDevice() });
}

export function forgotPassword(email) {
  return call('/api/auth/forgot-password', { email });
}

export function resetPassword(token, password) {
  return call('/api/auth/reset-password', { token, password });
}

export function continueToMyAccount(token) {
  window.location.href = `${MYACCOUNT_URL}/?token=${encodeURIComponent(token)}`;
}
