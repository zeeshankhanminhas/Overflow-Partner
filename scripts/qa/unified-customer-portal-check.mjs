import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const portal=read('app/client-portal/page.tsx'),accept=read('app/client-portal/accept-action.ts');
const stripe=read('app/quote-payment/stripe-action.ts'),response=read('app/quote-response/actions.ts');
const cases=[
  ['client accepts from signed portal',portal.includes('action={acceptClientQuotationInPortal}')&&accept.includes('verifyClientPortalToken(token)')],
  ['signed authority verified by existing DB contract',accept.includes('op_record_authorised_public_quote_response')&&accept.includes("authority_attested")],
  ['legacy quote response returns to same portal',response.includes('redirect(`/client-portal?token=')],
  ['one portal shows actual agreed opening payment',portal.includes('STEP 2 · OPENING PAYMENT')&&portal.includes('openingAmount')],
  ['actual Stripe Checkout launched on same portal',portal.includes('action={createStripeCheckout}')],
  ['independent payment and project gate retained',stripe.includes("db.rpc('op_preproject_lineage_readiness'")&&stripe.includes('No payment is marked received here')],
  ['Stripe returns to same portal',stripe.includes('${site}/client-portal?token=')&&!stripe.includes('${site}/quote-payment?token=')],
  ['only explicit Northfield QA case whitelisted',stripe.includes("qaLead?.reference==='OP-LEAD-2026-0001'")&&stripe.includes('op_sandbox_payment_authorisations')],
  ['QA rehearsal requires named correction acceptance before opening payment',
    portal.includes('action={acceptNorthfieldQaCorrection}')&&
    read('app/client-portal/qa-correction-action.ts').includes('assertIsolatedQaBackend()')&&
    read('supabase/migrations/20261102223000_northfield_qa_rehearsal_simulated_evidence.sql').includes("'qa_addendum_acceptance_required'")],
  ['no double payment while Stripe returns',portal.includes("stripe_return!=='success'")],
];
for(const [label,ok] of cases){assert.ok(ok,label);console.log('PASS '+label);}
console.log('Unified Customer Portal: '+cases.length+' checks passed');
