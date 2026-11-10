import React, { useState } from 'react';
import { addMethod } from './api.js';
import { notify } from '../../../packages/toast.jsx';
import { Field, Busy } from './ui.jsx';

export function MethodForm({ onAdded, onCancel }) {
  const [type, setType] = useState('upi');
  const [f, setF] = useState({ vpa: '', holder: '', accountNumber: '', ifsc: '' });
  const [err, setErr] = useState({ field: '', msg: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr({ field: '', msg: '' });
    try {
      const { method } = await addMethod({ type, ...f });
      notify('Payment method saved.', { type: 'success' });
      onAdded(method);
    } catch (ex) {
      setErr({ field: ex.field || '', msg: ex.message });
      notify(ex.message, { type: 'error' });
    } finally { setBusy(false); }
  }
  const e = (k) => (err.field === k ? err.msg : '');

  return (
    <form onSubmit={submit} className="method-form">
      <div className="seg">
        <button type="button" className={type === 'upi' ? 'on' : ''} onClick={() => setType('upi')}>UPI</button>
        <button type="button" className={type === 'bank' ? 'on' : ''} onClick={() => setType('bank')}>Bank account</button>
      </div>
      {type === 'upi' ? (
        <Field label="UPI ID" error={e('vpa')}>
          <input value={f.vpa} onChange={set('vpa')} placeholder="name@upi" autoCapitalize="none" />
        </Field>
      ) : (
        <>
          <Field label="Account holder" error={e('holder')}><input value={f.holder} onChange={set('holder')} /></Field>
          <Field label="Account number" error={e('accountNumber')}><input value={f.accountNumber} inputMode="numeric" onChange={set('accountNumber')} /></Field>
          <Field label="IFSC" error={e('ifsc')}><input value={f.ifsc} onChange={set('ifsc')} placeholder="HDFC0001234" /></Field>
        </>
      )}
      <div className="row-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
        <button className="btn btn-primary" disabled={busy}><Busy busy={busy} label="Saving…">Save method</Busy></button>
      </div>
    </form>
  );
}
