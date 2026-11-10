import React, { useCallback, useEffect, useState } from 'react';
import { captureTokenFromUrl, getToken, logout, getMe, getSummary, getUnreadCount } from './api.js';
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
const tabFromHash = () => {
  const [t, sub] = window.location.hash.replace('#/', '').split('/');
  return { tab: TABS.some((x) => x.id === t) ? t : 'home', sub: sub || undefined };
};

export default function App() {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [route, setRoute] = useState(tabFromHash);

  const refresh = useCallback(async () => {
    const [{ summary }, { unread: n }] = await Promise.all([getSummary(), getUnreadCount()]);
    setWallet(summary); setUnread(n);
  }, []);

  const go = useCallback((tab, sub) => {
    window.location.hash = `#/${tab}${sub ? '/' + sub : ''}`;
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    captureTokenFromUrl();
    if (!getToken()) { logout(); return; }
    Promise.all([getMe(), refresh()])
      .then(([me]) => setUser(me.user))
      .catch((err) => { setError(err.message); notify(err.message, { type: 'error' }); });
    const t = setInterval(() => refresh().catch(() => {}), 30000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!user || !wallet) {
    return <div className="shell"><div className="page-loading"><span className="spinner" /> {error || 'Loading your account…'}</div></div>;
  }

  const { tab, sub } = route;
  return (
    <div className="shell">
      <header className="topbar">
        <img src="/logo.svg" alt="eearny" className="topbar-logo" />
        <button className="icon-btn bell" aria-label="Notifications" onClick={() => go('notifications')}>
          <Icon name="bell" size={22} />
          {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </header>

      <main className="content">
        {tab === 'home' && <Home user={user} wallet={wallet} refresh={refresh} go={go} />}
        {tab === 'invest' && <Invest wallet={wallet} refresh={refresh} />}
        {tab === 'notifications' && <Notifications onChange={setUnread} />}
        {tab === 'account' && <Account key={sub || 'overview'} user={user} setUser={setUser} wallet={wallet} refresh={refresh} initialSub={sub} />}
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="nav-icon">
              <Icon name={t.icon} size={24} filled={tab === t.id} />
              {t.id === 'notifications' && unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
            </span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
