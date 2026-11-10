import React, { useEffect, useState } from 'react';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, clearNotifications,
} from './api.js';
import { notify } from '../../../packages/toast.jsx';
import { Empty, Icon, timeAgo } from './ui.jsx';

const ICON = { deposit: 'plus', withdraw: 'arrowUp', income: 'trend', invest: 'invest', referral: 'users', checkin: 'check', draw: 'gift', account: 'user' };

export default function Notifications({ onChange }) {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = () => getNotifications().then((r) => { setItems(r.notifications); onChange(r.unread); }).catch((e) => notify(e.message, { type: 'error' }));
  useEffect(() => { load(); }, []);

  const unread = (items || []).filter((n) => !n.read).length;
  const shown = (items || []).filter((n) => filter === 'all' || !n.read);
  const run = (fn) => async (...a) => { try { await fn(...a); await load(); } catch (e) { notify(e.message, { type: 'error' }); } };

  const open = run((n) => (n.read ? null : markNotificationRead(n.id)));
  const del = run((id) => deleteNotification(id));
  const readAll = run(() => markAllNotificationsRead());
  const clear = run(() => clearNotifications());

  return (
    <>
      <div className="title-row">
        <h2 className="page-title">Notifications</h2>
        <div className="title-actions">
          {unread > 0 && <button className="linklike" onClick={readAll}>Mark all read</button>}
          {items?.length > 0 && <button className="linklike danger" onClick={clear}>Clear all</button>}
        </div>
      </div>
      <div className="seg seg-wide">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
        <button className={filter === 'unread' ? 'on' : ''} onClick={() => setFilter('unread')}>Unread{unread ? ` (${unread})` : ''}</button>
      </div>
      {!items ? <div className="page-loading"><span className="spinner" /></div> : shown.length === 0 ? (
        <Empty icon="bell" title={filter === 'unread' ? 'All caught up' : 'No notifications yet'} hint="Top ups, revenue, referrals and more will show up here." />
      ) : (
        <ul className="notif-list">
          {shown.map((n) => (
            <li key={n.id} className={n.read ? '' : 'unread'} onClick={() => open(n)}>
              <span className={`notif-icon cat-${n.category}`}><Icon name={ICON[n.category] || 'bell'} size={20} /></span>
              <div className="notif-main">
                <strong>{n.title}</strong>
                <span className="muted">{n.body}</span>
                <span className="faint notif-time">{timeAgo(n.createdAt)}</span>
              </div>
              <button className="icon-btn" aria-label="Delete" onClick={(e) => { e.stopPropagation(); del(n.id); }}><Icon name="trash" size={18} /></button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
