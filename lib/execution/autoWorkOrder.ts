import { isKnownIsolatedQaBackend } from '@/lib/qa/isolation';
import { createHash,randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createExecutionSessionToken } from '@/lib/execution/sessionToken';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';

/** A single commercially selected partner inherits the approved project SOW.
 * No partner invitation is sent before financial authorisation and approved mobilisation.
 */
async function governedPartner(db:SupabaseClient,organisationId:string,projectId:string){
  const {data:project,error:projectError}=await db.from('projects')
    .select('id,quote_id,project_number,project_stage,start_date,due_date')
    .eq('organisation_id',organisationId).eq('id',projectId).single();
  if(projectError||!project?.quote_id)throw new Error('Project must inherit a governed accepted quotation.');
  const {data:quote}=await db.from('quotes').select('commercial_review_id')
    .eq('organisation_id',organisationId).eq('id',project.quote_id).single();
  if(!quote?.commercial_review_id)throw new Error('Approved quote commercial review is missing.');
  const {data:review}=await db.from('commercial_reviews').select('partner_quote_id')
    .eq('organisation_id',organisationId).eq('id',quote.commercial_review_id).single();
  if(!review?.partner_quote_id)throw new Error('Approved partner quotation is missing.');
  const {data:partnerQuote}=await db.from('partner_quotes').select('partner_id')
    .eq('organisation_id',organisationId).eq('id',review.partner_quote_id).single();
  if(!partnerQuote?.partner_id)throw new Error('Commercially selected execution partner is missing.');
  const {data:partner}=await db.from('partners')
    .select('id,company_name,contact_name,email,status,nda_signed')
    .eq('organisation_id',organisationId).eq('id',partnerQuote.partner_id).single();
  if(!partner||partner.status!=='approved'||!partner.nda_signed||!partner.email)
    throw new Error('Selected execution partner must be approved, NDA-signed and have an email.');
  return {project,partner};
}

export async function ensureApprovedPartnerAssignment(
 db:SupabaseClient,organisationId:string,userId:string,projectId:string,scopeDocumentId:string
){
  if(process.env.VERCEL_ENV==='preview'&&!isKnownIsolatedQaBackend())throw new Error('Automatic partner work-order QA requires a genuinely isolated database.');
  const {project,partner}=await governedPartner(db,organisationId,projectId);
  const {data:scope}=await db.from('documents').select('id,document_type,project_id,status,is_current_revision')
    .eq('organisation_id',organisationId).eq('id',scopeDocumentId).single();
  if(!scope||scope.project_id!==projectId||scope.document_type!=='statement-of-work'||
     !scope.is_current_revision||!['approved','issued','published'].includes(String(scope.status)))
    throw new Error('Only current approved Statement of Work may support automatic work order.');
  const {data:existing,error:existingError}=await db.from('project_execution_assignments')
    .select('id,scope_document_id,partner_id,execution_state').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
  if(existingError)throw new Error(existingError.message);
  if(existing){
    if(existing.partner_id!==partner.id)throw new Error('Existing execution assignment is for a different partner.');
    if(existing.scope_document_id!==scopeDocumentId)throw new Error('Execution assignment uses a different controlled SOW revision.');
    return existing;
  }
  const {data:assignment,error}=await db.from('project_execution_assignments').insert({
    organisation_id:organisationId,project_id:projectId,partner_id:partner.id,
    scope_document_id:scopeDocumentId,partner_contact_name:partner.contact_name||null,
    partner_contact_email:partner.email,planned_start_date:project.start_date||null,
    committed_due_date:project.due_date||null,reporting_cadence:'milestone',
    release_notes:'Controlled partner work order; milestone reporting required. No direct client contact.',
    created_by:userId,execution_state:'not_released',
  }).select('id,scope_document_id,partner_id,execution_state').single();
  if(error){
    if(error.code==='23505'){
      const {data:current}=await db.from('project_execution_assignments').select('id,scope_document_id,partner_id,execution_state')
        .eq('organisation_id',organisationId).eq('project_id',projectId).single();
      if(current?.partner_id===partner.id&&current.scope_document_id===scopeDocumentId)return current;
    }
    throw new Error(error.message);
  }
  return assignment;
}

export async function releaseApprovedPartnerWorkOrder(
 db:SupabaseClient,organisationId:string,userId:string,projectId:string
){
  if(process.env.VERCEL_ENV==='preview'&&!isKnownIsolatedQaBackend())throw new Error('Automatic partner work-order QA requires a genuinely isolated database.');
  const {project,partner}=await governedPartner(db,organisationId,projectId);
  if(project.project_stage!=='ready_for_execution')
    throw new Error('Mobilisation must complete before the Partner work order is released.');
  const {data:finance,error:financeError}=await db.rpc('op_project_financial_gate',{p_project_id:projectId});
  if(financeError||finance?.authorised!==true)throw new Error('Verified opening payment authority is required before partner release.');
  const {data:assignment,error:assignmentError}=await db.from('project_execution_assignments')
    .select('id,partner_id,scope_document_id,partner_contact_email,partner_contact_name,committed_due_date,execution_state,execution_cycle')
    .eq('organisation_id',organisationId).eq('project_id',projectId).single();
  if(assignmentError||!assignment)throw new Error('Approved partner execution assignment is missing.');
  if(assignment.partner_id!==partner.id||!['not_released','awaiting_acknowledgement'].includes(assignment.execution_state))
    throw new Error('Work-order assignment is locked or does not match the commercial partner.');
  const {data:scope}=await db.from('documents').select('id,status,is_current_revision,document_type')
    .eq('organisation_id',organisationId).eq('project_id',projectId).eq('id',assignment.scope_document_id).single();
  if(!scope||scope.document_type!=='statement-of-work'||!scope.is_current_revision||
     !['approved','issued','published'].includes(String(scope.status)))
    throw new Error('Current controlled SOW is not approved for partner release.');
  if(String(assignment.partner_contact_email).toLowerCase()!==String(partner.email).toLowerCase())
    throw new Error('Partner delivery address differs from approved vendor record.');

  let sessionId='';
  const {data:active,error:activeError}=await db.from('partner_execution_sessions')
    .select('id').eq('organisation_id',organisationId).eq('assignment_id',assignment.id)
    .in('status',['invited','opened','active']).gt('expires_at',new Date().toISOString())
    .order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(activeError)throw new Error(activeError.message);
  if(active?.id)sessionId=active.id;
  else {
    const placeholder=randomBytes(32).toString('base64url');
    const due=assignment.committed_due_date?
      new Date(String(assignment.committed_due_date)+'T23:59:59Z'):new Date();
    due.setUTCDate(due.getUTCDate()+30);
    const minimum=new Date(Date.now()+90*86400000);
    const expiresAt=due>minimum?due:minimum;
    const {data:session,error:sessionError}=await db.from('partner_execution_sessions').insert({
      organisation_id:organisationId,assignment_id:assignment.id,project_id:projectId,
      partner_id:partner.id,recipient_email:partner.email,
      token_hash:createHash('sha256').update(placeholder).digest('hex'),
      status:'invited',expires_at:expiresAt.toISOString(),created_by:userId,
    }).select('id').single();
    if(sessionError||!session)throw new Error(sessionError?.message||'Secure execution session could not be created.');
    sessionId=session.id;
    const hash=createHash('sha256').update(createExecutionSessionToken(sessionId)).digest('hex');
    const {error:hashError}=await db.from('partner_execution_sessions').update({token_hash:hash})
      .eq('organisation_id',organisationId).eq('id',sessionId);
    if(hashError)throw new Error(hashError.message);
  }
  const {error:releaseError}=await db.from('project_execution_assignments')
    .update({execution_state:'awaiting_acknowledgement',released_at:new Date().toISOString()})
    .eq('organisation_id',organisationId).eq('id',assignment.id);
  if(releaseError)throw new Error(releaseError.message);
  const base=process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_URL
    ? 'https://'+process.env.VERCEL_URL
    : (process.env.NEXT_PUBLIC_SITE_URL||'https://overflow-partner.vercel.app').replace(/\/$/,'');
  const actionUrl=base+'/execution/'+createExecutionSessionToken(sessionId);
  const queued=await queueLifecycleEmail(db,{
    organisationId,scenario:'partner_work.released',recipientEmail:partner.email,
    recipientName:partner.contact_name||partner.company_name,actionUrl,
    payload:{reference:project.project_number,project:'Controlled engineering work order',
      dueDate:assignment.committed_due_date},
    entityType:'project',entityId:projectId,
    idempotencyKey:'auto:work-order:'+assignment.id+':cycle:'+String(assignment.execution_cycle||1),
    subject:'Work package released · '+project.project_number,
  });
  if(!queued)throw new Error('Partner work-order notification was suppressed; manual retry required.');
  return {assignmentId:assignment.id,sessionId,queuedId:queued};
}
