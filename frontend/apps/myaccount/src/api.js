import { collectDevice } from '../../../packages/fingerprint.js';

const API_BASE = import.meta.env.VITE_ACCOUNT_API_URL || 'http://localhost:4002';
const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:4001';
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:5173';

const TOKEN_KEY = 'eearny_token';

// The auth app hands us the JWT via ?token=… — keep it, then clean the URL.
export function captureTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    params.delete('token');
    const clean = window.location.pathname + (params.toString() ? '?' + params : '');
    window.history.replaceState({}, '', clean);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// The sid claim inside our own JWT identifies "this device" in the session list.
export function getCurrentSid() {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1])).sid || null;
  } catch {
    return null;
  }
}

export function logout() {
  const token = getToken();
  // best-effort server-side revocation of this session
  if (token) {
    fetch(AUTH_API_BASE + '/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = AUTH_URL;
}

async function call(base, path, options = {}) {
  const token = getToken();
  if (!token) {
    logout();
    throw new Error('Not signed in');
  }
  const res = await fetch(base + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error('Session expired — please sign in again');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { field: data.field });
  return data;
}

const account = (path, options) => call(API_BASE, path, options);
const auth = (path, options) => call(AUTH_API_BASE, path, options);

export const getMe = () => account('/api/account/me');
export const getSummary = () => account('/api/account/summary');
export const getTransactions = () => account('/api/account/transactions');

export function updateProfile(patch) {
  return account('/api/account/me', { method: 'PATCH', body: JSON.stringify(patch) });
}

export function changePassword(currentPassword, newPassword) {
  return auth('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export const getSessions = () => auth('/api/auth/sessions');
export const revokeSession = (sid) =>
  auth(`/api/auth/sessions/${encodeURIComponent(sid)}`, { method: 'DELETE' });
export const revokeOtherSessions = () =>
  auth('/api/auth/sessions', { method: 'DELETE' });

// expose the fingerprint collector for the security panel
export { collectDevice };
