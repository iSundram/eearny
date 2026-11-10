import React, { useEffect } from 'react';

export const money = (n, opts = {}) =>
  '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2, ...opts }).format(n || 0);

export const timeAgo = (iso) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const P = {
  home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  homeFill: 'M12 3 2.5 11.2a.8.8 0 0 0 .5 1.4H5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-7.4h2a.8.8 0 0 0 .5-1.4z',
  invest: 'M4 19V9m6 10V5m6 14v-7m5 7H3',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9zm4 9.5a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8c0-3.5 3.1-6 7-6s7 2.5 7 6',
  plus: 'M12 5v14M5 12h14',
  arrowUp: 'M12 19V5m-6 6 6-6 6 6',
  arrowUpRight: 'M7 17 17 7M9 7h8v8',
  chevronRight: 'M9 6l6 6-6 6',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-6 9c0-3 2.7-5 6-5s6 2 6 5m2-9a3 3 0 1 0 0-6m1 9.2c2.5.4 5 2 5 4.8',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zm9 0v13m0-13c-2 0-4-.5-4-2.2S10 3 12 7zm0 0c2 0 4-.5 4-2.2S14 3 12 7z',
  percent: 'M19 5 5 19M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm9 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  close: 'M6 6l12 12M18 6 6 18',
  trash: 'M5 7h14M10 7V4h4v3m-8 0 1 13h10l1-13',
  card: 'M3 6h18v12H3zM3 10h18',
  bank: 'M3 10 12 4l9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  trend: 'M3 17l6-6 4 4 8-8m0 0h-5m5 0v5',
  shield: 'M12 3l7 3v6c0 4.5-3 7.9-7 9-4-1.1-7-4.5-7-9V6l7-3z',
  smartphone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm5 16h.01',
  monitor: 'M3 4h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm5 16h8m-4-4v4',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm-3.8 5.4L9 14l3 1.5L15 14l.8 6.4-3.8-2-3.8 2z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-2a7.5 7.5 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.7-1L15 3h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.7 1.7 1L11 21h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.3.9 2-3.4z',
};

export function Icon({ name, size = 22, filled = false, stroke = 1.85 }) {
  const d = filled && P[name + 'Fill'] ? P[name + 'Fill'] : P[name];
  const solid = filled && P[name + 'Fill'];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={solid ? 'currentColor' : 'none'}
      stroke={solid ? 'none' : 'currentColor'} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// Bottom sheet on mobile, centred dialog on larger screens.
export function Sheet({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="sheet-sub">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <div className="field">
      <div className="field-label-row">
        <label>{label}</label>
        {hint && <span className="field-hint">{hint}</span>}
      </div>
      {children}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

export function Busy({ busy, children, label = 'Working…' }) {
  return busy ? <><span className="spinner" /> {label}</> : children;
}

export function Empty({ icon = 'list', title, hint }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <strong>{title}</strong>
      {hint && <span className="faint">{hint}</span>}
    </div>
  );
}

export const CATEGORY_LABEL = {
  deposit: 'Top up', withdraw: 'Withdrawal', income: 'Revenue', invest: 'Investment',
  commission: 'Commission', checkin: 'Check-in', draw: 'Lucky draw',
};
