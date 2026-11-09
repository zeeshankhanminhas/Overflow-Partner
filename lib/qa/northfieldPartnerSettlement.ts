import 'server-only';
import {assertRole,requireUserContext} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

export const PROJECT='b447f586-bf79-4839-be5e-1af607d9ca43';
export const ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
export const QUOTE='e3d90c52-b67a-4c78-8962-7bad0356501c';
export const PARTNER='4f6bdcc5-1ea0-4dce-aa39-2fbef0cd17fa';
export const PAYABLE='QA-PP-NORTHFIELD-WO01';
export const INVOICE='QA-SIM-INVOICE-NORTHFIELD-WO01';
export const TRANSFER='QA-SIM-NORTHFIELD-WO01';
export const BASE='/opos-next/projects/'+PROJECT+'/partner-settlement';

function assertNorthfield(id:string,org:string){
  assertIsolatedQaBackend();
  if(process.env.VERCEL_GIT_COMMIT_REF!=='qa/recovery-ui-client-gate-20261105'||
    id!==PROJECT||org!==ORG)throw new Error('This simulation is authorised only in the isolated Northfield QA branch.');
}
export async function getQaScenario(projectId:string){
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
