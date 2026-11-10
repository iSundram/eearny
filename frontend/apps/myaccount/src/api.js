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
export const getTransactions = (category = 'all') => account(`/api/account/transactions?category=${category}`);

export function updateProfile(patch) {
  return account('/api/account/me', { method: 'PATCH', body: JSON.stringify(patch) });
}

const j = (method, body) => ({ method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

export const getConfig = () => account('/api/account/config');
export const topUp = (amount, methodId) => account('/api/account/topup', j('POST', { amount, methodId }));
export const withdraw = (amount, methodId) => account('/api/account/withdraw', j('POST', { amount, methodId }));

export const getMethods = () => account('/api/account/methods');
export const addMethod = (m) => account('/api/account/methods', j('POST', m));
export const removeMethod = (id) => account(`/api/account/methods/${id}`, j('DELETE'));
export const setDefaultMethod = (id) => account(`/api/account/methods/${id}/default`, j('POST'));

export const getPlans = () => account('/api/account/plans');
export const getInvestments = () => account('/api/account/investments');
export const invest = (planId, units, source) => account('/api/account/invest', j('POST', { planId, units, source }));

export const getCheckin = () => account('/api/account/checkin');
export const doCheckin = () => account('/api/account/checkin', j('POST'));
export const getLucky = () => account('/api/account/lucky');
export const spinLucky = () => account('/api/account/lucky/spin', j('POST'));

export const getReferrals = () => account('/api/account/referrals');
export const redeemReferral = (code) => account('/api/account/referrals/redeem', j('POST', { code }));

export const getNotifications = () => account('/api/account/notifications');
export const getUnreadCount = () => account('/api/account/notifications/unread-count');
export const markNotificationRead = (id) => account(`/api/account/notifications/${id}/read`, j('POST'));
export const markAllNotificationsRead = () => account('/api/account/notifications/read-all', j('POST'));
export const deleteNotification = (id) => account(`/api/account/notifications/${id}`, j('DELETE'));
export const clearNotifications = () => account('/api/account/notifications', j('DELETE'));
export const getNotificationPrefs = () => account('/api/account/notification-prefs');
export const setNotificationPrefs = (p) => account('/api/account/notification-prefs', j('PUT', p));

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
