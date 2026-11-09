import 'server-only';
import {createClient as createAdminClient} from '@supabase/supabase-js';
import {getQaScenario,PROJECT,ORG} from '@/lib/qa/northfieldPartnerSettlement';
import type {SupabaseClient} from '@supabase/supabase-js';

export const CLOSEOUT_BUCKET='opos-qa-controlled-closeout';
export const CLOSEOUT_BASE='/opos-next/projects/'+PROJECT+'/closeout-evidence';
export const DEPOSIT_INVOICE='QA-OPEN-NORTHFIELD-0002';
export const INVOICE_DOC='QA-NORTHFIELD-INVOICE-EVIDENCE-R01';
export const QUOTE_ID='c5b894db-ccdd-47e2-a58a-c38005bcaa99';
export const FINAL_INVOICE='OP-FINAL-OP-PRJ-2026-0002-R01';

export function qaAdmin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('QA private document access is unavailable.');
 return createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function getCloseoutEvidence(id:string){
 if(id!==PROJECT)throw new Error('Northfield QA only');
 const x=await getQaScenario(id);
 if(x.organisationId!==ORG)throw new Error('Wrong QA organisation');
 const db=qaAdmin();
 const [commercial,invoiceList,documentList]=await Promise.all([
  db.from('quote_payment_confirmations').select('id,amount,currency,payment_method,payment_reference,confirmed_at')
    .eq('organisation_id',ORG).eq('quote_id',QUOTE_ID).limit(5),
  x.supabase.from('invoices').select('id,invoice_number,invoice_type,status,total,amount_paid,subtotal,vat,external_reference,issued_at')
    .eq('organisation_id',ORG).eq('project_id',PROJECT),
  x.supabase.from('documents').select('id,reference,document_type,status,revision_code,storage_path,approved_at,issued_at,signed_by,independent_review_required')
    .eq('organisation_id',ORG).eq('project_id',PROJECT).eq('is_current_revision',true)
    .in('document_type',['completion-report','invoice'])
 ]);
 if(commercial.error||invoiceList.error||documentList.error)throw new Error('Closeout accounting or controlled document records are unavailable.');
 const receipt=(commercial.data||[]).find(c=>Number(c.amount)===644.78&&c.currency==='GBP'&&c.payment_method==='stripe');
 if(!receipt||commercial.data?.length!==1)throw new Error('A unique independently verified opening payment is required.');
 const {data:stripe,error:stripeError}=await db.from('quote_stripe_payment_events').select('stripe_session_id,amount_total,livemode,stripe_payment_status')
   .eq('organisation_id',ORG).eq('quote_id',QUOTE_ID).eq('stripe_session_id',receipt.payment_reference).limit(3);
 if(stripeError||stripe?.length!==1||stripe[0].amount_total!==64478||stripe[0].livemode!==false||stripe[0].stripe_payment_status!=='paid')
  throw new Error('Opening receipt is not matched to one paid Stripe sandbox confirmation.');
 const invoices=invoiceList.data||[];
 const final=invoices.find(i=>i.invoice_number===FINAL_INVOICE&&i.invoice_type==='final');
 if(!final||final.status!=='paid'||Number(final.total)!==1504.47||Number(final.amount_paid)!==1504.47)
   throw new Error('Paid final invoice evidence is unavailable.');
 const deposit=invoices.find(i=>i.invoice_number===DEPOSIT_INVOICE&&i.invoice_type==='deposit')||null;
 if(invoices.some(i=>![DEPOSIT_INVOICE,FINAL_INVOICE].includes(i.invoice_number)))
   throw new Error('Other Northfield invoices require manual reconciliation; automatic QA preparation is blocked.');
 if(deposit&&(deposit.status!=='paid'||Number(deposit.total)!==644.78||Number(deposit.amount_paid)!==644.78||
   deposit.external_reference!==receipt.payment_reference))
   throw new Error('Historical opening invoice does not match the original paid quote receipt.');
 const documents=documentList.data||[];
 return {...x,db,receipt,final,deposit,documents,
  invoiceDoc:documents.find(d=>d.document_type==='invoice')||null,
  completionDoc:documents.find(d=>d.document_type==='completion-report')||null,
  billingReady:!!deposit&&Math.abs(Number(final.total)+Number(deposit.total)-2149.25)<0.001};
}
