import { createHash, randomBytes, randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';

/** Runs only on the trusted server after a submitted token-bound Step 2 intake.
 * No customer-selected partner, direct client contact, or client commercial data is passed.
 */
export type PartnerReferralResult = {
  status: 'queued' | 'already_issued' | 'manual_required' | 'failed';
  requestId?: string;
  reason?: string;
};

const activeStatuses = ['draft','invited','opened','in_progress','submitted','clarification_required','approved','approved_with_conditions'];
const baseUrl = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://overflow-partner.vercel.app').replace(/\/$/, '');

export async function autoReferSubmittedIntake(
  db: SupabaseClient,
  input: { organisationId:string; prospectId:string; sessionId:string; actorUserId:string; scopeSummary:string; projectType:string }
): Promise<PartnerReferralResult> {
  const { organisationId, prospectId, sessionId, actorUserId } = input;
  // Preview currently points at a shared OPOS project. Never auto-invite a real partner from an unisolated preview.
  if (process.env.VERCEL_ENV === 'preview' && process.env.OP_ISOLATED_QA_BACKEND !== 'true') {
    return {status:'manual_required',reason:'Partner automation is disabled on Preview until an isolated QA backend is configured.'};
  }
  // Important: validate the actual submission and ownership, not only the caller's assertions.
  const { data: session, error: sessionError } = await db.from('intake_sessions')
    .select('id,status,organisation_id,prospect_id').eq('id',sessionId).eq('organisation_id',organisationId)
    .eq('prospect_id',prospectId).single();
  if (sessionError || !session || session.status !== 'submitted') return {status:'failed',reason:'A submitted Step 2 intake is required.'};

  const { data:submission, error:submissionError } = await db.from('intake_submissions')
    .select('description,project_type').eq('organisation_id',organisationId).eq('intake_session_id',sessionId).maybeSingle();
  if (submissionError || !submission) return {status:'failed',reason:'Intake submission is not available.'};

  const { data: existing, error: existingError } = await db.from('partner_review_requests')
    .select('id,status').eq('organisation_id',organisationId).eq('prospect_id',prospectId)
    .in('status',activeStatuses).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(existingError) throw existingError;
  if(existing) return {status:'already_issued',requestId:existing.id};

  // Only unambiguous approved NDA-signed partners with an email can be auto-selected.
  const { data: partners, error: partnerError } = await db.from('partners')
    .select('id,company_name,contact_name,email').eq('organisation_id',organisationId)
    .eq('status','approved').eq('nda_signed',true).not('email','is',null).limit(2);
  if(partnerError) throw partnerError;
  if(!partners || partners.length !== 1 || !partners[0].email) {
    return {status:'manual_required',reason:!partners?.length
      ? 'No approved NDA-signed partner with an email is available.'
      : 'More than one eligible partner exists; choose an execution partner in OPOS.'};
  }
  const partner=partners[0];
  const token=randomBytes(32).toString('base64url');
  const tokenHash=createHash('sha256').update(token).digest('hex');
  const due=new Date(Date.now()+3*24*60*60*1000);
  const expiry=new Date(Date.now()+10*24*60*60*1000);
  const reference='OP-PR-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+randomUUID().replaceAll('-','').slice(0,6).toUpperCase();
  const { data: request, error: insertError } = await db.from('partner_review_requests').insert({
    organisation_id:organisationId,prospect_id:prospectId,intake_session_id:sessionId,partner_id:partner.id,
    token_hash:tokenHash,case_reference:reference,status:'invited',response_due_at:due.toISOString(),
    expires_at:expiry.toISOString(),scope_summary:submission.description,
    review_instructions:'Review feasibility, capacity, engineering hours, delivery timescale, risks, assumptions, exclusions and partner pricing. Request missing information through OPOS. Do not contact the end client or start work.',
    show_client_identity:false,show_commercial_identity:false,created_by:actorUserId,
  }).select('id').single();
  if(insertError) {
    if(insertError.code==='23505') {
      const {data:current}=await db.from('partner_review_requests').select('id').eq('organisation_id',organisationId)
        .eq('prospect_id',prospectId).in('status',activeStatuses).limit(1).maybeSingle();
      if(current) return {status:'already_issued',requestId:current.id};
    }
    throw insertError;
  }
  const requestId=request.id as string;
  try {
    const {data:files,error:filesError}=await db.from('intake_files')
      .select('id,original_filename').eq('organisation_id',organisationId).eq('intake_session_id',sessionId);
    if(filesError) throw filesError;
    if(files?.length) {
      const {error:attachmentError}=await db.from('partner_review_files').insert(files.map(file=>({
        organisation_id:organisationId,partner_review_request_id:requestId,intake_file_id:file.id,
        display_name:file.original_filename,created_by:actorUserId,
      })));
      if(attachmentError) throw attachmentError;
    }
    const notificationId=await queueLifecycleEmail(db,{
      organisationId,scenario:'partner_review.requested',recipientEmail:partner.email,
      recipientName:partner.contact_name||partner.company_name,
      actionUrl:baseUrl()+'/partner-review/'+token,
      payload:{reference,project:submission.project_type,dueDate:due.toLocaleDateString('en-GB')},
      entityType:'prospect',entityId:prospectId,
      idempotencyKey:'auto:partner-review:'+sessionId,
      subject:'Delivery review requested — '+reference,
    });
    if(!notificationId) throw new Error('Partner review notification was suppressed.');
    await db.from('prospects').update({next_action:'Await partner feasibility and commercial assessment'})
      .eq('organisation_id',organisationId).eq('id',prospectId);
    await db.from('activity_events').insert({organisation_id:organisationId,user_id:actorUserId,
      entity_type:'prospect',entity_id:prospectId,event_type:'partner_review_auto_referred',
      event_data:{intakeSessionId:sessionId,reviewId:requestId,partnerId:partner.id,reference,notificationId}});
    return {status:'queued',requestId};
  } catch(error) {
    // A failed handoff must never remain displayed as an invitation that was successfully sent.
    await db.from('partner_review_requests').update({status:'revoked',revoked_at:new Date().toISOString()})
      .eq('organisation_id',organisationId).eq('id',requestId);
    return {status:'failed',reason:error instanceof Error?error.message:'Partner referral could not be queued.'};
  }
}
