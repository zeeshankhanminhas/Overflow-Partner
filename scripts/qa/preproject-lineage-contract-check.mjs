import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const sql=read('supabase/migrations/20261102183000_qa_preproject_lineage_and_checkout_gate.sql');
const checkout=read('app/quote-payment/stripe-action.ts');
const paymentPage=read('app/quote-payment/page.tsx');
const clientPortal=read('app/client-portal/page.tsx');
const operatorReadiness=read('app/opos-next/qa-readiness/page.tsx');

const checks=[
  ['Project insert is guarded at the database level',
    sql.includes('before insert on public.projects')&&
    sql.includes('execute function public.op_guard_project_prequotation_lineage()')],
  ['Approval lineage inherits the original approved commercial review',
    sql.includes('v_q.commercial_review_id')&&sql.includes("status::text='approved'")&&
    sql.includes('approved_at<=v_q.issued_at')],
  ['Partner identity, received quotation and prices are frozen',
    sql.includes('v_cr.partner_quote_id')&&sql.includes("status::text in ('received','selected')")&&
    sql.includes('v_cr.cost_price is distinct from v_pq.price')&&
    sql.includes('v_cr.client_price is distinct from v_q.subtotal')],
  ['Approved, NDA-ready partner is required before opening payment',
    sql.includes("status::text='approved' and nda_signed=true")],
  ['Approved technical intake and controlled requirements are pre-quotation',
    sql.includes('v_pq.technical_intake_id')&&
    sql.includes("d.document_type='client-requirements'")&&
    sql.includes('d.approved_at<=v_q.issued_at')],
  ['Technical assessment must be approved before commercial quotation',
    sql.includes('v_pq.partner_review_response_id')&&
    sql.includes("decision.decision='approved'")&&
    sql.includes('decision.approved_at<=v_q.issued_at')],
  ['Preflight is service-role-only, not callable by anonymous clients',
    sql.includes('revoke all on function public.op_preproject_lineage_readiness(uuid,uuid)')&&
    sql.includes('to service_role')],
  ['No retroactive data backfill, fabricated approvals or fixture rewriting',
    !/\bupdate\s+(?:public\.)?(?:commercial_reviews|partner_quotes|technical_intakes|partners|projects)\b/i.test(sql)&&
    !/\binsert\s+into\s+(?:public\.)?(?:commercial_reviews|partner_quotes|technical_intakes|partners|projects)\b/i.test(sql)],
  ['Server-side Stripe Checkout fails closed before payment request',
    checkout.includes("db.rpc('op_preproject_lineage_readiness'")&&
    checkout.includes('lineage?.ready!==true')&&
    checkout.indexOf('lineage?.ready!==true')<checkout.indexOf("fetch('https://api.stripe.com/v1/checkout/sessions'")],
  ['Unpaid payment page blocks both card and bank details when lineage is missing',
    paymentPage.includes('if(!confirmed && !settlementPending && !stripeReturnPending)')&&
    paymentPage.includes("db.rpc('op_preproject_lineage_readiness'")&&
    paymentPage.includes("return unavailable('Project readiness verification pending'")],
  ['Client portal does not show Continue to payment on missing lineage',
    clientPortal.includes("db.rpc('op_preproject_lineage_readiness'")&&
    clientPortal.includes('openingPaymentPending && preprojectReady')&&
    clientPortal.includes('openingPaymentPending&&!preprojectReady')],
  ['Operator readiness shows concrete missing governance evidence',
    operatorReadiness.includes("db.rpc('op_preproject_lineage_readiness'")&&
    operatorReadiness.includes("Pre-project technical and commercial lineage")],
];
for(const [name,passed] of checks){
  assert.ok(passed,name);
  console.log('PASS '+name);
}
console.log('OPOS preproject controls passed: '+checks.length+' source-contract assertions; live Stripe payment was NOT initiated.');
