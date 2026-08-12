'use client';

import { useMemo, useState } from 'react';

function money(currency: string, amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export default function MarginSimulator({ cost, currency = 'GBP', defaultMarkup = 30 }: { cost: number; currency?: string; defaultMarkup?: number }) {
  const [markup, setMarkup] = useState(defaultMarkup);
  const [startPaymentPercent, setStartPaymentPercent] = useState('');
  const values = useMemo(() => {
    const subtotal = cost * (1 + markup / 100);
    const profit = subtotal - cost;
    const vat = subtotal * 0.2;
    const total = subtotal + vat;
    const startPercent = Number(startPaymentPercent || 0);
    const startPayment = total * startPercent / 100;
    return { subtotal, profit, vat, total, startPayment };
  }, [cost, markup, startPaymentPercent]);

  return <div style={{ display: 'grid', gap: 16 }}>
    <label>Markup %<input name="markup_percent" type="number" min="0" max="500" step="0.1" value={markup} onChange={(event) => setMarkup(Number(event.target.value || 0))} required /></label>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 }}>
      <div><p className="eyebrow">Partner cost</p><strong>{money(currency, cost)}</strong></div>
      <div><p className="eyebrow">Client subtotal</p><strong>{money(currency, values.subtotal)}</strong></div>
      <div><p className="eyebrow">Profit</p><strong>{money(currency, values.profit)}</strong></div>
      <div><p className="eyebrow">VAT · 20%</p><strong>{money(currency, values.vat)}</strong></div>
      <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: 12 }}><p className="eyebrow">Client total</p><strong style={{ fontSize: 24 }}>{money(currency, values.total)}</strong></div>
    </div>
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, display: 'grid', gap: 12 }}>
      <p style={{ margin: 0, color: 'var(--op-muted)' }}>Set the client payment term that will be carried into the controlled Client Quote. Project 360 will inherit it after written acceptance; it is not re-entered during mobilisation.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <label>Required start payment %<input name="start_payment_percent" type="number" min="0.01" max="100" step="0.01" value={startPaymentPercent} onChange={(event) => setStartPaymentPercent(event.target.value)} placeholder="e.g. 30" required /></label>
        <label>Payment terms (days)<input name="payment_terms_days" type="number" min="0" max="365" step="1" defaultValue="30" required /></label>
      </div>
      {Number(startPaymentPercent) > 0 ? <div><p className="eyebrow">Required to start after acceptance</p><strong>{money(currency, values.startPayment)}</strong><small style={{ display: 'block', marginTop: 4, color: 'var(--op-muted)' }}>Derived from the quoted client total; settlement must later be recorded as cleared in Payments.</small></div> : null}
    </div>
  </div>;
}