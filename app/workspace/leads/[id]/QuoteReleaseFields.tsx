'use client';

import { useState } from 'react';

type Props = {
  quoteReference: string;
  verifiedStripePayment?: { payment_intent_id: string; amount: number; currency: string; paid_at: string; livemode: boolean } | null;
};

export default function QuoteReleaseFields({ quoteReference, verifiedStripePayment }: Props) {
  const [releaseBasis, setReleaseBasis] = useState('payment');

  return <>
    {verifiedStripePayment ? <div className="vp-callout"><strong>Stripe payment verified</strong><p>{new Intl.NumberFormat('en-GB', { style: 'currency', currency: verifiedStripePayment.currency.toUpperCase() }).format(verifiedStripePayment.amount)} received {new Date(verifiedStripePayment.paid_at).toLocaleString('en-GB')} · {verifiedStripePayment.livemode ? 'live payment' : 'test payment'} · {verifiedStripePayment.payment_intent_id}</p><p>Project creation remains an internal release action. The verified payment proof will be matched when you submit below.</p></div> : <div className="vp-callout"><strong>Confirm the release condition in the issued Client Quote</strong><p>For card payments, use the payment verified by Stripe. For bank transfer, record only cleared funds. A purchase order or approved no-advance terms can also release Project 360.</p></div>}
    <label>Release condition
      <select name="release_basis" value={releaseBasis} onChange={(event) => setReleaseBasis(event.target.value)} required>
        <option value="payment">Opening payment received</option>
        <option value="purchase_order">Purchase order received</option>
        <option value="no_advance_payment">No advance payment due under the issued quote</option>
      </select>
    </label>
    {releaseBasis === 'payment' ? <div className="grid gap-4 md:grid-cols-2">
      <label>Payment method<select name="payment_method" required defaultValue={verifiedStripePayment ? 'card' : 'bank_transfer'}><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select></label>
      <label>Payment confirmed at<input name="payment_confirmed_at" type="datetime-local" required defaultValue={verifiedStripePayment ? new Date(verifiedStripePayment.paid_at).toISOString().slice(0,16) : undefined}/></label>
      <label className="md:col-span-2">Payment reference<input name="payment_reference" required placeholder="Cleared bank reference, receipt or transaction ID" defaultValue={verifiedStripePayment?.payment_intent_id}/></label>
    </div> : null}
    {releaseBasis === 'purchase_order' ? <>
      <label>Purchase order reference<input name="release_reference" required placeholder="Client PO number"/></label>
      <label>Release note<textarea name="release_note" rows={2} placeholder="Optional note about the purchase order"/></label>
    </> : null}
    {releaseBasis === 'no_advance_payment' ? <>
      <label>Issued quote reference<input name="release_reference" required defaultValue={`${quoteReference} · issued payment terms`}/></label>
      <label>Why no advance payment is due<textarea name="release_note" rows={3} required defaultValue="The issued Client Quote states that no advance payment is due. Project 360 will manage any later invoices and payments under the agreed terms."/></label>
    </> : null}
  </>;
}
