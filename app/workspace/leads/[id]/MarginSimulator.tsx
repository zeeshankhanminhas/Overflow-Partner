'use client';

import { useMemo, useState } from 'react';

function money(currency: string, amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

/** 33% is a gross-margin default, not a 33% markup. The governed server
 * currently accepts markup_percent, so derive that field from target margin.
 */
export default function MarginSimulator({ cost, currency = 'GBP', defaultMargin = 33 }: { cost:number; currency?:string; defaultMargin?:number }) {
  const [margin, setMargin] = useState(defaultMargin);
  const values = useMemo(() => {
    const acceptedMargin = Math.min(85,Math.max(0,margin));
    const markup = acceptedMargin/(100-acceptedMargin)*100;
    const subtotal= cost/(1-acceptedMargin/100);
    const profit=subtotal-cost;
    const vat=subtotal*0.2;
    return { markup,subtotal,profit,vat,total:subtotal+vat };
  },[cost,margin]);

  return <section className="commercial-decision-surface" aria-label="Pricing decision">
    <div className="commercial-decision-surface__heading">
      <div><p className="eyebrow">Pricing & margin</p><h3>Set the client price</h3><p>Default 33% gross margin on partner cost. You may adjust the percentage for this commercial decision; the underlying partner cost is unchanged.</p></div>
      <label className="commercial-decision-surface__input">Target gross margin %
        <input type="number" min="0" max="85" step="0.1" value={margin} onChange={(event)=>setMargin(Number(event.target.value||0))} required/>
      </label>
      <input type="hidden" name="markup_percent" value={Number(values.markup.toFixed(4))} />
    </div>
    <div className="commercial-decision-surface__metrics">
      <div><p className="eyebrow">Partner cost</p><strong>{money(currency,cost)}</strong><small>Delivery cost</small></div>
      <div><p className="eyebrow">Client price</p><strong>{money(currency,values.subtotal)}</strong><small>Before VAT</small></div>
      <div><p className="eyebrow">Gross margin</p><strong>{money(currency,values.profit)}</strong><small>{margin.toFixed(1)}% of selling price</small></div>
      <div><p className="eyebrow">VAT · 20%</p><strong>{money(currency,values.vat)}</strong><small>Subject to applicable tax treatment</small></div>
      <div className="commercial-decision-surface__total"><p className="eyebrow">Client total</p><strong>{money(currency,values.total)}</strong><small>Including illustrative VAT</small></div>
    </div>
    <p className="commercial-decision-surface__note">33% gross margin means a markup of about 49.25% over partner cost. Adjusting this field recalculates the required markup sent to the commercial approval system.</p>
  </section>;
}
