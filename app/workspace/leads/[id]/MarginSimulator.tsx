'use client';

import { useMemo, useState } from 'react';

function money(currency: string, amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export default function MarginSimulator({ cost, currency = 'GBP', defaultMarkup = 30 }: { cost: number; currency?: string; defaultMarkup?: number }) {
  const [markup, setMarkup] = useState(defaultMarkup);
  const values = useMemo(() => {
    const subtotal = cost * (1 + markup / 100);
    const profit = subtotal - cost;
    const vat = subtotal * 0.2;
    return { subtotal, profit, vat, total: subtotal + vat };
  }, [cost, markup]);

  return <div style={{ display: 'grid', gap: 16 }}>
    <label>Markup %<input name="markup_percent" type="number" min="0" max="500" step="0.1" value={markup} onChange={(event) => setMarkup(Number(event.target.value || 0))} required /></label>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 }}>
      <div><p className="eyebrow">Partner cost</p><strong>{money(currency, cost)}</strong></div>
      <div><p className="eyebrow">Client subtotal</p><strong>{money(currency, values.subtotal)}</strong></div>
      <div><p className="eyebrow">Profit</p><strong>{money(currency, values.profit)}</strong></div>
      <div><p className="eyebrow">VAT · 20%</p><strong>{money(currency, values.vat)}</strong></div>
      <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: 12 }}><p className="eyebrow">Client total</p><strong style={{ fontSize: 24 }}>{money(currency, values.total)}</strong></div>
    </div>
  </div>;
}
