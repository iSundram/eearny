// eearny shared notification toasts.
// Usage:  notify('Profile updated.', { type: 'success' })   // anywhere in the app
//         <ToastHost />                                     // rendered once at the root
// Default behaviour: bottom-left panel, auto-dismiss after 8s with a draining
// progress bar, manual dismiss via the ✕ button.
import React, { useEffect, useState } from 'react';

let listeners = [];
let seq = 0;

export function notify(message, { type = 'info', duration = 8000 } = {}) {
  const toast = { id: ++seq, message, type, duration };
  listeners.forEach((l) => l(toast));
}

export function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const onToast = (t) => setToasts((list) => [...list, t]);
    listeners.push(onToast);
    return () => {
      listeners = listeners.filter((l) => l !== onToast);
    };
  }, []);

  function dismiss(id) {
    setToasts((list) => list.filter((t) => t.id !== id));
  }

  if (!toasts.length) return null;
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`toast toast-${toast.type}`} role="status">
      <span className="toast-msg">{toast.message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="Dismiss notification">
        ✕
      </button>
      <div className="toast-progress" style={{ animationDuration: `${toast.duration}ms` }} />
    </div>
  );
}
