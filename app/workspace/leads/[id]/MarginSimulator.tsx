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
    const marginPercent = subtotal > 0 ? (profit / subtotal) * 100 : 0;
    const vat = subtotal * 0.2;
    return { subtotal, profit, marginPercent, vat, total: subtotal + vat };
  }, [cost, markup]);

  return <section className="commercial-decision-surface" aria-label="Pricing decision">
    <div className="commercial-decision-surface__heading">
      <div><p className="eyebrow">Pricing & margin</p><h3>Set the client price</h3><p>Partner cost stays fixed. Adjust the markup to see the resulting selling price and gross margin before approval.</p></div>
      <label className="commercial-decision-surface__input">Markup %<input name="markup_percent" type="number" min="0" max="500" step="0.1" value={markup} onChange={(event) => setMarkup(Number(event.target.value || 0))} required /></label>
    </div>
    <div className="commercial-decision-surface__metrics">
      <div><p className="eyebrow">Partner cost</p><strong>{money(currency, cost)}</strong><small>Delivery cost</small></div>
      <div><p className="eyebrow">Client price</p><strong>{money(currency, values.subtotal)}</strong><small>Before VAT</small></div>
      <div><p className="eyebrow">Gross margin</p><strong>{money(currency, values.profit)}</strong><small>{values.marginPercent.toFixed(1)}% margin</small></div>
      <div><p className="eyebrow">VAT · 20%</p><strong>{money(currency, values.vat)}</strong><small>Tax added to invoice</small></div>
      <div className="commercial-decision-surface__total"><p className="eyebrow">Client total</p><strong>{money(currency, values.total)}</strong><small>Including VAT</small></div>
    </div>
    <p className="commercial-decision-surface__note">Markup and margin are intentionally shown separately. Approval should be based on the commercial margin, not markup alone.</p>
  </section>;
}
