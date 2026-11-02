import { isKnownIsolatedQaBackend } from '@/lib/qa/isolation';
import { qaPublicOrigin } from '@/lib/qa/publicOrigin';
import { createHash,randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createExecutionSessionToken } from '@/lib/execution/sessionToken';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { assertQaRecipientAllowed } from '@/lib/qa/email-guard';

/** Partner identity and price are frozen during pre-client-quote commercial approval.
 * A paid opening deposit creates Project 360 and enables issuance during Mobilisation.
 * Formal acceptance and the right to commence remain independent later gates.
 */
async function governedPartner(db:SupabaseClient,organisationId:string,projectId:string){
  const {data:project,error:projectError}=await db.from('projects')
    .select('id,quote_id,project_number,project_stage,start_date,due_date,created_by')
    .eq('organisation_id',organisationId).eq('id',projectId).single();
  if(projectError||!project?.quote_id)throw new Error('Project must inherit a governed accepted quotation.');
  const {data:quote}=await db.from('quotes').select('commercial_review_id')
    .eq('organisation_id',organisationId).eq('id',project.quote_id).single();
  if(!quote?.commercial_review_id)throw new Error('Approved quote commercial review is missing.');
  const {data:review}=await db.from('commercial_reviews').select('partner_quote_id,status,approved_at')
    .eq('organisation_id',organisationId).eq('id',quote.commercial_review_id).single();
  if(!review?.partner_quote_id || review.status!=='approved' || !review.approved_at)
    throw new Error('Approved commercial review must already identify the selected partner before client quotation.');
  const {data:partnerQuote}=await db.from('partner_quotes').select('id,lead_id,partner_id,price,currency,status,lead_time_days,delivery_commitment,commercial_assumptions,exclusions')
    .eq('organisation_id',organisationId).eq('id',review.partner_quote_id).single();
  if(!partnerQuote?.partner_id || !['received','selected'].includes(String(partnerQuote.status)))
    throw new Error('Approved commercial review must reference a valid received Partner quotation.');
  if(!Number.isFinite(Number(partnerQuote.price)) || Number(partnerQuote.price)<=0)
    throw new Error('Commercially approved partner price must be positive.');
  const {data:partner}=await db.from('partners')
    .select('id,company_name,contact_name,email,status,nda_signed')
    .eq('organisation_id',organisationId).eq('id',partnerQuote.partner_id).single();
  if(!partner||partner.status!=='approved'||!partner.nda_signed||!partner.email)
    throw new Error('Selected execution partner must be approved, NDA-signed and have an email.');
  const {data:agreement,error:agreementError}=await db.from('partner_execution_agreement_evidence')
    .select('id,signed_at,verified_at').eq('organisation_id',organisationId).eq('partner_id',partner.id)
    .eq('is_current',true).maybeSingle();
  if(agreementError || !agreement?.id || !agreement.signed_at || !agreement.verified_at ||
     new Date(agreement.signed_at).getTime()>new Date(agreement.verified_at).getTime())
    throw new Error('Current signed, independently verified Execution Partner Agreement is required before Work Order release.');
  if(process.env.VERCEL_ENV==='preview')assertQaRecipientAllowed(partner.email);
  return {project,partner,partnerQuote};
}

export async function ensureApprovedPartnerAssignment(
 db:SupabaseClient,organisationId:string,userId:string,projectId:string,scopeDocumentId:string
){
  if(process.env.VERCEL_ENV==='preview'&&!isKnownIsolatedQaBackend())throw new Error('Automatic partner work-order QA requires a genuinely isolated database.');
  const {project,partner}=await governedPartner(db,organisationId,projectId);
  if(!['mobilisation','ready_for_execution'].includes(String(project.project_stage)))
    throw new Error('Automatic Work Order issuance requires a financially released project in Mobilisation.');
  const {data:scope}=await db.from('documents').select('id,document_type,project_id,status,is_current_revision')
    .eq('organisation_id',organisationId).eq('id',scopeDocumentId).single();
  if(!scope||scope.project_id!==projectId||!['scope-of-work','statement-of-work'].includes(String(scope.document_type))||
     !scope.is_current_revision||!['approved','issued','published'].includes(String(scope.status)))
    throw new Error('Only current approved technical scope from the agreed quotation may support automatic Work Order issue.');
  const {data:existing,error:existingError}=await db.from('project_execution_assignments')
    .select('id,scope_document_id,partner_id,execution_state').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
  if(existingError)throw new Error(existingError.message);
  if(existing){
    if(existing.partner_id!==partner.id)throw new Error('Existing execution assignment is for a different partner.');
    if(existing.scope_document_id!==scopeDocumentId)throw new Error('Execution assignment uses a different already-approved scope revision. Governed change control is required.');
    return existing;
  }
  const {data:assignment,error}=await db.from('project_execution_assignments').insert({
    organisation_id:organisationId,project_id:projectId,partner_id:partner.id,
    scope_document_id:scopeDocumentId,partner_contact_name:partner.contact_name||null,
    // Project creation date is NOT permission to commence partner work.
    partner_contact_email:partner.email,planned_start_date:null,
    committed_due_date:project.due_date||null,reporting_cadence:'milestone',
    release_notes:'Controlled partner work order; milestone reporting required. No direct client contact.',
    created_by:userId,execution_state:'not_released',
  }).select('id,scope_document_id,partner_id,execution_state').single();
  if(error){
    if(error.code==='23505'){
      const {data:current}=await db.from('project_execution_assignments').select('id,scope_document_id,partner_id,execution_state')
        .eq('organisation_id',organisationId).eq('project_id',projectId).single();
      if(current?.partner_id===partner.id&&current?.scope_document_id===scopeDocumentId)return current;
    }
    throw new Error(error.message);
  }
  return assignment;
}

export async function releaseApprovedPartnerWorkOrder(
 db:SupabaseClient,organisationId:string,userId:string,projectId:string
){
  if(process.env.VERCEL_ENV==='preview'&&!isKnownIsolatedQaBackend())throw new Error('Automatic partner work-order QA requires a genuinely isolated database.');
  const {project,partner,partnerQuote}=await governedPartner(db,organisationId,projectId);
  if(!['mobilisation','ready_for_execution'].includes(String(project.project_stage)))
    throw new Error('Work Order issue is permitted only after verified advance, before execution begins.');
  const {data:finance,error:financeError}=await db.rpc('op_project_financial_gate',{p_project_id:projectId});
  // The historic finance gate can also authorise PO, credit and manual overrides.
  // Our agreed commercial lifecycle only releases an execution partner after
  // a positively paid opening deposit. Never accept these alternative bases.
  if(financeError || finance?.authorised!==true ||
     finance?.basis!=='deposit' ||
     !(Number(finance?.required)>0) ||
     !(Number(finance?.received)>=Number(finance?.required))) {
    throw new Error('Verified cleared opening deposit (not PO, credit or manual override) is required before partner work-order release.');
  }
  const {data:assignment,error:assignmentError}=await db.from('project_execution_assignments')
    .select('id,partner_id,scope_document_id,partner_contact_email,partner_contact_name,committed_due_date,execution_state,execution_cycle,released_at,release_reference')
    .eq('organisation_id',organisationId).eq('project_id',projectId).single();
  if(assignmentError||!assignment)throw new Error('Approved partner execution assignment is missing.');
  if(assignment.partner_id!==partner.id||!['not_released','awaiting_acknowledgement'].includes(assignment.execution_state))
    throw new Error('Work-order assignment is locked or does not match the commercial partner.');
  const {data:scope}=await db.from('documents').select('id,reference,revision_code,status,is_current_revision,document_type')
    .eq('organisation_id',organisationId).eq('project_id',projectId).eq('id',assignment.scope_document_id).single();
  if(!scope||!['scope-of-work','statement-of-work'].includes(String(scope.document_type))||!scope.is_current_revision||
     !['approved','issued','published'].includes(String(scope.status)))
    throw new Error('Current controlled technical scope is not approved for Work Order issue.');
  if(String(assignment.partner_contact_email).toLowerCase()!==String(partner.email).toLowerCase())
    throw new Error('Partner delivery address differs from approved vendor record.');

  // Immutable, explicitly priced Work Order; inherits the approved Partner quote.
  // A retry must NEVER choose a different Partner, price, currency or scope.
  const expectedReference=project.project_number+'/WO-01';
  const {data:existingWorkOrder,error:workOrderError}=await db.from('partner_work_orders')
    .select('id,partner_id,partner_quote_id,scope_document_id,reference,partner_price,currency,status')
    .eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
  if(workOrderError)throw new Error('Could not verify existing governed Work Order: '+workOrderError.message);
  if(existingWorkOrder){
    if(existingWorkOrder.partner_id!==partner.id||existingWorkOrder.partner_quote_id!==partnerQuote.id||
      existingWorkOrder.scope_document_id!==scope.id||existingWorkOrder.reference!==expectedReference||
      Number(existingWorkOrder.partner_price)!==Number(partnerQuote.price)||
      String(existingWorkOrder.currency).toUpperCase()!==String(partnerQuote.currency).trim().toUpperCase()||
      existingWorkOrder.status!=='issued')
      throw new Error('Issued Work Order differs from the approved commercial snapshot. An authorised variation is required.');
  }else{
    const {error:issuedError}=await db.from('partner_work_orders').insert({
      organisation_id:organisationId,project_id:projectId,assignment_id:assignment.id,
      partner_id:partner.id,partner_quote_id:partnerQuote.id,scope_document_id:scope.id,
      scope_reference:scope.reference,scope_revision_code:scope.revision_code||null,
      reference:expectedReference,partner_price:Number(partnerQuote.price),
      currency:String(partnerQuote.currency).trim().toUpperCase(),
      lead_time_days:partnerQuote.lead_time_days||null,
      delivery_commitment:partnerQuote.delivery_commitment||null,
      commercial_assumptions:partnerQuote.commercial_assumptions||null,
      exclusions:partnerQuote.exclusions||null,
      created_by:userId,
    });
    if(issuedError){
      if(issuedError.code!=='23505')throw new Error('Work Order could not be issued: '+issuedError.message);
      const {data:race}=await db.from('partner_work_orders').select('id,partner_id,partner_quote_id,scope_document_id,reference,partner_price,currency,status')
        .eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
      if(!race||race.partner_id!==partner.id||race.partner_quote_id!==partnerQuote.id||race.scope_document_id!==scope.id||
        race.reference!==expectedReference||Number(race.partner_price)!==Number(partnerQuote.price)||
        String(race.currency).toUpperCase()!==String(partnerQuote.currency).trim().toUpperCase()||race.status!=='issued')
        throw new Error('Concurrent Work Order conflict requires investigation.');
    }
  }
  // A formally accepted Work Order cannot be re-issued, re-priced, or re-invited.
  const {data:acceptance,error:acceptanceError}=await db.from('partner_work_order_acceptances')
    .select('id').eq('organisation_id',organisationId).eq('assignment_id',assignment.id).maybeSingle();
  if(acceptanceError)throw new Error('Work Order acceptance register is unavailable.');
  if(acceptance?.id)return {assignmentId:assignment.id,sessionId:'already-accepted',queuedId:'already-accepted'};

  // Fail before writing session tokens if a stable, trusted customer-facing origin is unavailable.
  const base=process.env.VERCEL_ENV==='preview'
    ? qaPublicOrigin()
    : (process.env.NEXT_PUBLIC_SITE_URL||'https://overflow-partner.vercel.app').replace(/\/$/,'');
  let sessionId='';
  const {error:expiredError}=await db.from('partner_execution_sessions')
    .update({status:'expired'}).eq('organisation_id',organisationId).eq('assignment_id',assignment.id)
    .in('status',['invited','opened','active']).lt('expires_at',new Date().toISOString());
  if(expiredError)throw new Error('Expired partner work-order token cleanup failed: '+expiredError.message);
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
    if(sessionError||!session){
      if(sessionError?.code==='23505'){
        const {data:raced}=await db.from('partner_execution_sessions').select('id')
          .eq('organisation_id',organisationId).eq('assignment_id',assignment.id)
          .in('status',['invited','opened','active']).gt('expires_at',new Date().toISOString())
          .order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(raced?.id)sessionId=raced.id;
      }
      if(!sessionId)throw new Error(sessionError?.message||'Secure execution session could not be created.');
    }else sessionId=session.id;
    if(session){
      const hash=createHash('sha256').update(createExecutionSessionToken(sessionId)).digest('hex');
      const {error:hashError}=await db.from('partner_execution_sessions').update({token_hash:hash})
        .eq('organisation_id',organisationId).eq('id',sessionId);
      if(hashError)throw new Error(hashError.message);
    }
  }
  const {error:releaseError}=await db.from('project_execution_assignments')
    .update({execution_state:'awaiting_acknowledgement',released_at:assignment.released_at||new Date().toISOString(),release_reference:expectedReference})
    .eq('organisation_id',organisationId).eq('id',assignment.id);
  if(releaseError)throw new Error(releaseError.message);
  const actionUrl=base+'/execution/'+createExecutionSessionToken(sessionId);
  const queued=await queueLifecycleEmail(db,{
    organisationId,scenario:'partner_work.released',recipientEmail:partner.email,
    recipientName:partner.contact_name||partner.company_name,actionUrl,
    payload:{reference:expectedReference,project:'Controlled engineering Work Order',
      dueDate:assignment.committed_due_date,scopeReference:scope.reference,
      partnerPrice:Number(partnerQuote.price),partnerCurrency:String(partnerQuote.currency).trim().toUpperCase()},
    entityType:'project',entityId:projectId,
    idempotencyKey:'auto:work-order:'+assignment.id+':cycle:'+String(assignment.execution_cycle||1),
    subject:'Work package released · '+project.project_number,
  });
  if(!queued)throw new Error('Partner work-order notification was suppressed; manual retry required.');
  return {assignmentId:assignment.id,sessionId,queuedId:queued};
}
