'use client';

import { useState } from 'react';

export default function CheckoutPaymentButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function startPayment() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/quote-payment/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (result.paid) { window.location.reload(); return; }
      if (!response.ok || !result.url) throw new Error(result.error || 'Checkout could not be opened.');
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checkout could not be opened.');
      setBusy(false);
    }
  }
  return <div style={{ marginTop: 18 }}>
    <button type="button" disabled={busy} onClick={startPayment} style={{ border: 0, borderRadius: 8, padding: '13px 18px', background: '#d74c2c', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
      {busy ? 'Opening secure checkout…' : 'Pay securely'}
    </button>
    {error ? <p role="alert" style={{ color: '#9b1c1c', marginTop: 10 }}>{error}</p> : null}
  </div>;
}
