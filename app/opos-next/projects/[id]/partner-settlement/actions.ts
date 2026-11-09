'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {assertRole,requireUserContext} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

const PROJECT='b447f586-bf79-4839-be5e-1af607d9ca43';
const ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
const QUOTE='e3d90c52-b67a-4c78-8962-7bad0356501c';
const PARTNER='4f6bdcc5-1ea0-4dce-aa39-2fbef0cd17fa';
const PAYABLE='QA-PP-NORTHFIELD-WO01';
const INVOICE='QA-SIM-INVOICE-NORTHFIELD-WO01';
const TRANSFER='QA-SIM-NORTHFIELD-WO01';
const BASE='/opos-next/projects/'+PROJECT+'/partner-settlement';

function assertNorthfield(id:string,org:string){
  assertIsolatedQaBackend();
  if(process.env.VERCEL_GIT_COMMIT_REF!=='qa/recovery-ui-client-gate-20261105'||
    id!==PROJECT||org!==ORG)throw new Error('This simulation is authorised only in the isolated Northfield QA branch.');
}
async function scenario(projectId:string){
  const ctx=await requireUserContext('/opos-next');
  assertRole(ctx.profile.role,['owner','admin']);
  assertNorthfield(projectId,ctx.organisationId);
  const {supabase,organisationId,user}=ctx;
  const [{data:project,error:projectError},{data:assignment,error:assignmentError},{data:status,error:statusError}]=await Promise.all([
    supabase.from('projects').select('id,project_stage,project_number').eq('organisation_id',organisationId).eq('id',projectId).maybeSingle(),
    supabase.from('project_execution_assignments').select('id,partner_id,execution_cycle').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle(),
    supabase.rpc('op_project_voice_final_release_status',{p_organisation_id:organisationId,p_project_id:projectId,p_user_id:user.id}),
  ]);
  if(projectError||!project||!['completion','closed'].includes(project.project_stage))throw new Error('Northfield must have completed engineering delivery.');
  if(assignmentError||!assignment||assignment.partner_id!==PARTNER)throw new Error('Selected Execution Partner assignment mismatch.');
  if(statusError||!status?.clientAccepted||!status?.finalPaid||!status?.ownerApproved)
    throw new Error('Client acceptance, verified final payment and separate owner release are all required.');
  const {data:wo,error:workOrderError}=await supabase.from('partner_work_orders')
    .select('id,reference,partner_quote_id,partner_price,currency,status').eq('organisation_id',organisationId)
    .eq('project_id',projectId).eq('assignment_id',assignment.id).maybeSingle();
  if(workOrderError||!wo||wo.partner_quote_id!==QUOTE||wo.reference!=='OP-PRJ-2026-0002/WO-01'||
    Number(wo.partner_price)!==1200||wo.currency!=='GBP'||wo.status!=='issued')
    throw new Error('Authorised Work Order does not match the £1,200 QA cost basis.');
  const {data:quote,error:quoteError}=await supabase.from('partner_quotes')
    .select('id,price,currency,status').eq('organisation_id',organisationId).eq('id',QUOTE).maybeSingle();
  if(quoteError||!quote||quote.status!=='selected'||Number(quote.price)!==1200||quote.currency!=='GBP')
    throw new Error('Selected partner quotation has changed.');
  const {data:submission,error:submissionError}=await supabase.from('partner_delivery_submissions')
    .select('id,review_status,execution_cycle').eq('organisation_id',organisationId).eq('project_id',projectId)
    .eq('assignment_id',assignment.id).eq('execution_cycle',assignment.execution_cycle||1)
    .eq('review_status','accepted').order('submitted_at',{ascending:false}).limit(1).maybeSingle();
  if(submissionError||!submission)throw new Error('Accepted current-cycle R01 engineering delivery is required.');
  const {data:files,error:filesError}=await supabase.from('partner_delivery_submission_files')
    .select('id,storage_path,storage_bucket').eq('organisation_id',organisationId)
    .eq('project_id',projectId).eq('submission_id',submission.id);
  if(filesError||!files?.length||files.some(f=>!f.storage_path||!f.storage_bucket))
    throw new Error('Accepted partner file manifest is incomplete.');
  const {data:handover,error:handoverError}=await supabase.from('documents')
    .select('id,status,issued_at,approved_at').eq('organisation_id',organisationId).eq('project_id',projectId)
    .eq('document_type','handover-pack').eq('is_current_revision',true).maybeSingle();
  if(handoverError||!handover?.issued_at||!handover.approved_at||!['issued','published'].includes(handover.status))
    throw new Error('Current controlled final Handover Pack must be issued.');
  const {data:payables,error:payablesError}=await supabase.from('partner_payables')
    .select('id,invoice_reference,payable_number,status,total,amount_paid,partner_id,partner_quote_id,currency,evidence_confirmed')
    .eq('organisation_id',organisationId).eq('project_id',projectId);
  if(payablesError)throw new Error('Partner liability register is unavailable.');
  if((payables||[]).some(p=>p.payable_number!==PAYABLE || p.partner_quote_id!==QUOTE ||
    p.partner_id!==PARTNER||p.invoice_reference!==INVOICE||Number(p.total)!==1200||p.currency!=='GBP'))
    throw new Error('Another payable already exists. Stop and reconcile the actual partner liability.');
  if((payables||[]).length>1)throw new Error('Multiple partner payables require independent review.');
  const payable=payables?.[0]||null;
  const {data:payments,error:paymentsError}=await supabase.from('partner_payments')
    .select('id,payment_method,reference,status,amount').eq('organisation_id',organisationId).eq('project_id',projectId);
  if(paymentsError)throw new Error('Partner payment evidence cannot be verified.');
  if((payments||[]).some(p=>p.payment_method!=='qa_simulated_bank_transfer'||
    p.reference!==TRANSFER||Number(p.amount)!==1200))
    throw new Error('Non-synthetic partner payment evidence exists. Stop before simulating.');
  return {...ctx,project,wo,quote,submission,payable,payments:payments||[],status};
}
function refresh(){
 revalidatePath(BASE);
 revalidatePath('/opos-next/projects/'+PROJECT);
 revalidatePath('/opos-next/finance');
 revalidatePath('/workspace/payments');
}
async function execute(step:'create'|'approve'|'simulate'|'close',formData:FormData){
 let result='';
 try{
  const id=String(formData.get('project_id')||'');
  if(id!==PROJECT)throw new Error('Unrecognised QA project.');
  const x=await scenario(id);
  const {supabase,organisationId,user,payable,payments,project}=x;
  if(step==='create'){
   if(payable)throw new Error('QA payable already exists: '+payable.payable_number);
   const {error}=await supabase.from('partner_payables').insert({
    organisation_id:organisationId,project_id:PROJECT,partner_id:PARTNER,partner_quote_id:QUOTE,
    payable_number:PAYABLE,invoice_reference:INVOICE,status:'received',
    description:'QA synthetic supplier invoice fixture for selected Work Order. NOT a real invoice.',
    subtotal:1200,vat:0,total:1200,amount_paid:0,currency:'GBP',
    evidence_confirmed:false,created_by:user.id
   });
   if(error)throw new Error(error.message);
   result='QA fixture payable recorded as RECEIVED. No supplier invoice or payment was created outside QA.';
  }else if(step==='approve'){
   if(!payable||payable.status!=='received')throw new Error('Received QA payable required.');
   if(formData.get('confirm_evidence')!=='yes')throw new Error('Explicit evidence review confirmation required.');
   const {data,error}=await supabase.from('partner_payables').update({
     status:'approved',evidence_confirmed:true,approved_by:user.id,approved_at:new Date().toISOString()
   }).eq('organisation_id',organisationId).eq('id',payable.id).eq('status','received')
    .select('id').maybeSingle();
   if(error||!data)throw new Error('Partner payable approval failed: '+(error?.message||'state changed'));
   result='QA payable approved against the accepted R01 delivery and Work Order. No bank transfer made.';
  }else if(step==='simulate'){
   if(!payable||payable.status!=='approved'||payable.evidence_confirmed!==true||
      Number(payable.amount_paid)!==0||payments.length)
     throw new Error('Approved unpaid QA payable and no prior payment evidence required.');
   if(formData.get('confirm_simulation')!=='yes'||
      String(formData.get('confirmation')||'').trim()!=='SIMULATE')
     throw new Error('Confirm that this is a synthetic settlement with NO real money sent.');
   const {error}=await supabase.from('partner_payments').insert({
    organisation_id:organisationId,payable_id:payable.id,project_id:PROJECT,
    amount:1200,currency:'GBP',payment_method:'qa_simulated_bank_transfer',
    status:'cleared',reference:TRANSFER,paid_at:new Date().toISOString(),recorded_by:user.id
   });
   if(error)throw new Error('QA simulation rejected: '+error.message);
   result='QA-SIM settlement recorded. The QA ledger exercises the real reconciliation triggers; NO bank payment was sent.';
  }else{
   if(project.project_stage!=='completion')throw new Error('Project is not at the completion gate.');
   if(payments.length!==1||payments[0].payment_method!=='qa_simulated_bank_transfer'||
      payable?.status!=='paid'||Number(payable.amount_paid)!==1200)
     throw new Error('QA simulated settlement must reconcile before closure.');
   if(formData.get('confirm_closure')!=='yes')throw new Error('Explicit QA project closure confirmation required.');
   const {data:ready,error:readyError}=await supabase.rpc('op_project_stage_readiness',{p_project_id:PROJECT});
   if(readyError||ready?.ready!==true)
      throw new Error('Project closure is blocked: '+String(ready?.reasons?.join('; ')||readyError?.message||'Governed checks incomplete.'));
   const {error}=await supabase.rpc('op_advance_project_stage',{
     p_project_id:PROJECT,p_target_stage:'closed',p_actor_id:user.id,
     p_note:'Northfield QA-only lifecycle closure. Partner settlement is QA-SIM and is not a real bank transfer.'
   });
   if(error)throw new Error('Canonical closure rejected: '+error.message);
   result='Northfield QA project closed through the governed transition. Partner transfer was simulated, not real.';
  }
 }catch(e){const err=e instanceof Error?e.message:'QA settlement was not saved';redirect(BASE+'?error='+encodeURIComponent(err));}
 refresh();redirect(BASE+'?updated='+encodeURIComponent(result));
}
export async function createQaPartnerPayable(formData:FormData){return execute('create',formData);}
export async function approveQaPartnerPayable(formData:FormData){return execute('approve',formData);}
export async function simulateQaPartnerPayment(formData:FormData){return execute('simulate',formData);}
export async function closeQaNorthfieldProject(formData:FormData){return execute('close',formData);}
