import React, { useCallback, useEffect, useState } from 'react';
import { captureTokenFromUrl, getToken, logout, getMe, getSummary, getUnreadCount, redeemReferral } from './api.js';
import { notify } from '../../../packages/toast.jsx';
import { Icon } from './ui.jsx';
import Home from './Home.jsx';
import Invest from './Invest.jsx';
import Notifications from './Notifications.jsx';
import Account from './Account.jsx';

const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'invest', label: 'Invest', icon: 'invest' },
  { id: 'notifications', label: 'Alerts', icon: 'bell' },
  { id: 'account', label: 'Account', icon: 'user' },
];
const parseRoute = () => {
  if (window.location.hash.startsWith('#/')) {
    const [t, sub] = window.location.hash.slice(2).split('/');
    if (TABS.some((x) => x.id === t)) return { tab: t, sub: sub || undefined };
  }
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const rel = window.location.pathname.slice(base.length).replace(/^\/+|\/+$/g, '');
  const [t, sub] = rel.split('/');
  return { tab: TABS.some((x) => x.id === t) ? t : 'home', sub: sub || undefined };
};

export default function App() {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [route, setRoute] = useState(parseRoute);

  const refresh = useCallback(async () => {
    const [{ summary }, { unread: n }] = await Promise.all([getSummary(), getUnreadCount()]);
    setWallet(summary); setUnread(n);
  }, []);

  const go = useCallback((tab, sub) => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
    const nextPath = tab === 'home' && !sub ? `${base}/` : `${base}/${tab}${sub ? '/' + sub : ''}`;
    window.history.pushState({}, '', nextPath);
    setRoute({ tab, sub: sub || undefined });
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onNav = () => setRoute(parseRoute());
    window.addEventListener('popstate', onNav);
    window.addEventListener('hashchange', onNav);
    return () => {
      window.removeEventListener('popstate', onNav);
      window.removeEventListener('hashchange', onNav);
    };
  }, []);

  useEffect(() => {
    captureTokenFromUrl();
    if (!getToken()) { logout(); return; }
    const pendingRef = sessionStorage.getItem('eearny_pending_ref');
    if (pendingRef) {
      sessionStorage.removeItem('eearny_pending_ref');
      redeemReferral(pendingRef).then(() => refresh()).catch(() => {});
    }
    Promise.all([getMe(), refresh()])
      .then(([me]) => setUser(me.user))
      .catch((err) => { setError(err.message); notify(err.message, { type: 'error' }); });
    const t = setInterval(() => refresh().catch(() => {}), 30000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!user || !wallet) {
    return (
      <div className="shell">
        <div className="page-loading">
          <span className="spinner" /> {error || 'Loading your portfolio…'}
        </div>
      </div>
    );
  }

  const { tab, sub } = route;
  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand-btn" onClick={() => go('home')} aria-label="eearny home">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="eearny" className="topbar-logo" />
        </button>
        <div className="topbar-right">
          <button className="icon-btn bell" aria-label="Notifications" onClick={() => go('notifications')}>
            <Icon name="bell" size={20} />
            {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button className="avatar-btn" onClick={() => go('account')} aria-label="Account">
            <span className="avatar">{(user.name || '?').trim().charAt(0).toUpperCase()}</span>
          </button>
        </div>
      </header>

      <main className="content">
        {tab === 'home' && <Home user={user} wallet={wallet} refresh={refresh} go={go} />}
        {tab === 'invest' && <Invest wallet={wallet} refresh={refresh} />}
        {tab === 'notifications' && <Notifications onChange={setUnread} />}
        {tab === 'account' && <Account key={sub || 'overview'} user={user} setUser={setUser} wallet={wallet} refresh={refresh} initialSub={sub} go={go} />}
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="nav-icon-pill">
              <Icon name={t.icon} size={21} filled={tab === t.id} />
              {t.id === 'notifications' && unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
            </span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
