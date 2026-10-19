'use client';

import { useState } from 'react';

export default function QuoteIssueContractFields({total,currency}:{total:number;currency:string}) {
  const [basis,setBasis]=useState('');
  const full=basis==='payment';
  return <fieldset className="stack" style={{border:'1px solid #d7d7d7',borderRadius:10,padding:16}}>
    <legend>Contractual commercial release condition</legend>
    <p>Choose the condition that will appear in this issued quote and its secure Client Portal. It cannot be changed without a new quote revision.</p>
    <label>Release condition
      <select name="contract_release_basis" required value={basis} onChange={event=>setBasis(event.target.value)}>
        <option value="" disabled>Select the agreed contractual basis</option>
        <option value="payment">Full advance required before project release</option>
        <option value="purchase_order">Approved purchase order authorises project release</option>
        <option value="no_advance_payment">No advance due under this contract</option>
      </select>
    </label>
    <input type="hidden" name="contract_opening_amount" value={full?total:0}/>
    <p>Opening amount: {full?new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(total):'No upfront charge'}. Deposit and approved-credit terms require further controls and cannot be issued through this form yet.</p>
    <p>The named recipient above must be authorised to accept the quotation on behalf of the client.</p>
  </fieldset>;
}
