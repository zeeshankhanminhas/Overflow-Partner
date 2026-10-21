'use client';

import { useState } from 'react';
import { openingPayment, finalBalance } from '@/lib/lifecycle/voiceAgreedContract';

export default function QuoteIssueContractFields({total,currency}:{total:number;currency:string}) {
  const [basis,setBasis]=useState<'deposit'|'payment'>('deposit');
  const deposit=total>0?openingPayment(total):0;
  const opening=basis==='deposit'?deposit:total;
  const money=(amount:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(amount);
  return <fieldset className="stack" style={{border:'1px solid var(--op-line)',borderRadius:10,padding:16}}>
    <legend>Agreed payment and commercial release</legend>
    <p>Standard terms: 30% opening payment after quotation acceptance, with the remaining 70% verified before final engineering handover. No project can start without the verified opening payment.</p>
    <label>Opening payment
      <select name="contract_release_basis" required value={basis} onChange={event=>setBasis(event.target.value as 'deposit'|'payment')}>
        <option value="deposit">30% advance · remaining balance before final handover</option>
        <option value="payment">100% advance · only if specifically agreed</option>
      </select>
    </label>
    <input type="hidden" name="contract_opening_amount" value={opening.toFixed(2)} />
    <div className="vp-facts">
      <div className="vp-fact"><small>Opening payment due</small><strong>{money(opening)}</strong></div>
      <div className="vp-fact"><small>Balance before final release</small><strong>{money(finalBalance(total,opening))}</strong></div>
    </div>
    <p>These amounts and the named authorised signatory will be frozen to the issued quotation revision and included in its controlled PDF. No purchase-order-only or no-advance project release for new quotes.</p>
  </fieldset>;
}
