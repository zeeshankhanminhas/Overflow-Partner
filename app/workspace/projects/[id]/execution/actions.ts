'use server';

import { createHash, randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { createExecutionSessionToken } from '@/lib/execution/sessionToken';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';

const roles = ['owner','admin','operator','engineering','commercial'] as const;
const cadenceValues = ['milestone','daily','every_2_business_days','weekly','on_change'] as const;

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) || '').trim();
  if (!value) throw new Error(`${key.replaceAll('_',' ')} is required.`);
  return value;
}
function executionUrl(projectId: string, params: Record<string,string>) { return `/workspace/projects/${projectId}/execution?${new URLSearchParams(params).toString()}`; }
function refresh(projectId: string) { revalidatePath(`/workspace/projects/${projectId}`); revalidatePath(`/workspace/projects/${projectId}/execution`); revalidatePath(`/workspace/projects/${projectId}/delivery`); revalidatePath('/workspace/projects'); }
async function audit(supabase:any, organisationId:string, userId:string, projectId:string, eventType:string, eventData:Record<string,unknown>) { await supabase.from('activity_events').insert({ organisation_id:organisationId,entity_type:'project',entity_id:projectId,user_id:userId,event_type:eventType,event_data:eventData }); }

async function commercialPartnerForProject(supabase:any, organisationId:string, projectId:string) {
  const { data: project, error: projectError } = await supabase.from('projects').select('id,quote_id,due_date,project_number,title').eq('organisation_id',organisationId).eq('id',projectId).single();
  if(projectError||!project) throw new Error(projectError?.message||'Project not found.');
  if(!project.quote_id) throw new Error('Accepted Quote linkage is required before Partner execution can be configured.');
  const { data: quote, error: quoteError } = await supabase.from('quotes').select('commercial_review_id').eq('organisation_id',organisationId).eq('id',project.quote_id).single();
  if(quoteError||!quote?.commercial_review_id) throw new Error('Commercial Review linkage is missing from the accepted Quote.');
  const { data: review, error: reviewError } = await supabase.from('commercial_reviews').select('partner_quote_id').eq('organisation_id',organisationId).eq('id',quote.commercial_review_id).single();
  if(reviewError||!review?.partner_quote_id) throw new Error('Governed Partner pricing is missing from the accepted commercial position.');
  const { data: partnerQuote, error: partnerQuoteError } = await supabase.from('partner_quotes').select('partner_id').eq('organisation_id',organisationId).eq('id',review.partner_quote_id).single();
  if(partnerQuoteError||!partnerQuote?.partner_id) throw new Error('Commercially selected Execution Partner could not be resolved.');
  return { project, partnerId:String(partnerQuote.partner_id) };
}

export async function saveExecutionAssignmentAction(formData: FormData) {
  const projectId = required(formData, 'project_id');
  let destination = `/workspace/projects/${projectId}/execution`;
  try {
    const suppliedPartnerId = required(formData, 'partner_id');
    const scopeDocumentId = required(formData, 'scope_document_id');
    const contactEmail = required(formData, 'partner_contact_email').toLowerCase();
    const cadence = String(formData.get('reporting_cadence') || 'milestone');
    if (!cadenceValues.includes(cadence as (typeof cadenceValues)[number])) throw new Error('Invalid reporting cadence.');
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, [...roles]);
    const { project, partnerId } = await commercialPartnerForProject(supabase,organisationId,projectId);
    if(suppliedPartnerId!==partnerId) throw new Error('Execution Partner must match the Partner approved in the accepted commercial position.');
    const [{data:partner,error:partnerError},{data:scope,error:scopeError}]=await Promise.all([
      supabase.from('partners').select('id,company_name,status,nda_signed').eq('organisation_id',organisationId).eq('id',partnerId).single(),
      supabase.from('documents').select('id,project_id,document_type,status,is_current_revision').eq('organisation_id',organisationId).eq('id',scopeDocumentId).single(),
    ]);
    if(partnerError||!partner) throw new Error(partnerError?.message||'Execution Partner not found.');
    if(partner.status!=='approved'||!partner.nda_signed) throw new Error('The commercially selected Execution Partner must remain approved and NDA-ready.');
    if(scopeError||!scope||scope.project_id!==projectId||!['scope-of-work','statement-of-work'].includes(String(scope.document_type))||!['approved','issued','published'].includes(String(scope.status))||!scope.is_current_revision) throw new Error('Select the current approved Scope of Work or Statement of Work as the controlled execution scope.');
    const payload={organisation_id:organisationId,project_id:projectId,partner_id:partnerId,scope_document_id:scopeDocumentId,partner_contact_name:String(formData.get('partner_contact_name')||'').trim()||null,partner_contact_email:contactEmail,planned_start_date:String(formData.get('planned_start_date')||'')||null,committed_due_date:String(formData.get('committed_due_date')||'')||project.due_date||null,reporting_cadence:cadence,release_notes:String(formData.get('release_notes')||'').trim()||null,created_by:user.id};
    const {data:existing,error:existingError}=await supabase.from('project_execution_assignments').select('id,execution_state').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
    if(existingError) throw new Error(existingError.message);
    if(existing){
      if(!['not_released','awaiting_acknowledgement'].includes(String(existing.execution_state))) throw new Error('Execution has already commenced. Partner identity and controlled release basis are now locked.');
      const {error}=await supabase.from('project_execution_assignments').update(payload).eq('organisation_id',organisationId).eq('id',existing.id);if(error)throw new Error(error.message);
      await audit(supabase,organisationId,user.id,projectId,'partner_execution.assignment_updated',{assignmentId:existing.id,partnerId,scopeDocumentId,canonicalLifecycle:true});
    }else{
      const {data:assignment,error}=await supabase.from('project_execution_assignments').insert(payload).select('id').single();if(error||!assignment)throw new Error(error?.message||'Execution assignment could not be created.');
      await audit(supabase,organisationId,user.id,projectId,'partner_execution.assignment_created',{assignmentId:assignment.id,partnerId,scopeDocumentId,canonicalLifecycle:true});
    }
    refresh(projectId);destination=executionUrl(projectId,{success:'Controlled Partner execution assignment saved.'});
  }catch(error){destination=executionUrl(projectId,{error:error instanceof Error?error.message:'Execution assignment could not be saved.'});}
  redirect(destination);
}

export async function generateExecutionLinkAction(formData: FormData) {
  const projectId=required(formData,'project_id');let destination=`/workspace/projects/${projectId}/execution`;
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...roles]);
    const {data:assignment,error:assignmentError}=await supabase.from('project_execution_assignments').select('id,project_id,partner_id,partner_contact_name,partner_contact_email,scope_document_id,execution_state,committed_due_date').eq('organisation_id',organisationId).eq('project_id',projectId).single();
    if(assignmentError||!assignment)throw new Error(assignmentError?.message||'Create the controlled execution assignment first.');
    if(!assignment.scope_document_id)throw new Error('Controlled execution scope is required before Partner release.');
    if(['closed','cancelled'].includes(String(assignment.execution_state)))throw new Error('This execution assignment is no longer active.');
    const {data:project}=await supabase.from('projects').select('project_number,title').eq('organisation_id',organisationId).eq('id',projectId).maybeSingle();
    const {data:partner}=await supabase.from('partners').select('company_name,contact_name').eq('organisation_id',organisationId).eq('id',assignment.partner_id).maybeSingle();
    const placeholderToken=randomBytes(32).toString('base64url');const placeholderHash=createHash('sha256').update(placeholderToken).digest('hex');
    const due=assignment.committed_due_date?new Date(`${assignment.committed_due_date}T23:59:59Z`):new Date();const minimumExpiry=new Date(Date.now()+90*24*60*60*1000);due.setUTCDate(due.getUTCDate()+30);const expiresAt=due.getTime()>minimumExpiry.getTime()?due:minimumExpiry;
    await supabase.from('partner_execution_sessions').update({status:'revoked'}).eq('organisation_id',organisationId).eq('assignment_id',assignment.id).in('status',['invited','opened','active']);
    const {data:session,error:sessionError}=await supabase.from('partner_execution_sessions').insert({organisation_id:organisationId,assignment_id:assignment.id,project_id:projectId,partner_id:assignment.partner_id,recipient_email:assignment.partner_contact_email,token_hash:placeholderHash,status:'invited',expires_at:expiresAt.toISOString(),created_by:user.id}).select('id').single();
    if(sessionError||!session)throw new Error(sessionError?.message||'Secure execution session could not be created.');
    const signedToken=createExecutionSessionToken(session.id);const signedHash=createHash('sha256').update(signedToken).digest('hex');
    const {error:tokenError}=await supabase.from('partner_execution_sessions').update({token_hash:signedHash}).eq('id',session.id);if(tokenError)throw new Error(tokenError.message);
    const now=new Date().toISOString();const {error:releaseError}=await supabase.from('project_execution_assignments').update({execution_state:assignment.execution_state==='not_released'?'awaiting_acknowledgement':assignment.execution_state,released_at:now}).eq('organisation_id',organisationId).eq('id',assignment.id);if(releaseError)throw new Error(releaseError.message);
    await audit(supabase,organisationId,user.id,projectId,'partner_execution.secure_link_issued',{assignmentId:assignment.id,sessionId:session.id,recipientEmail:assignment.partner_contact_email,scopeDocumentId:assignment.scope_document_id,expiresAt:expiresAt.toISOString(),canonicalLifecycle:true,reopenableSignedLink:true});
    const baseUrl=(process.env.NEXT_PUBLIC_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||'https://overflow-partner.vercel.app').replace(/\/$/,'');const link=`${baseUrl}/execution/${signedToken}`;
    await queueLifecycleEmail(supabase,{organisationId,scenario:'partner_work.released',recipientEmail:assignment.partner_contact_email,recipientName:assignment.partner_contact_name||partner?.contact_name||partner?.company_name,actionUrl:link,payload:{company:partner?.company_name,reference:project?.project_number,project:project?.title,dueDate:assignment.committed_due_date},entityType:'project',entityId:projectId,idempotencyKey:`partner-work:released:${session.id}`,subject:`Work package released · ${project?.project_number||'Overflow Partner'}`}).catch(()=>null);
    refresh(projectId);destination=executionUrl(projectId,{success:'Secure Partner Execution link generated and email queued.',execution_link:link});
  }catch(error){destination=executionUrl(projectId,{error:error instanceof Error?error.message:'Execution link could not be generated.'});}
  redirect(destination);
}

export async function resolveExecutionExceptionAction(formData:FormData){
  const projectId=required(formData,'project_id');let destination=`/workspace/projects/${projectId}/execution`;
  try{
    const exceptionId=required(formData,'exception_id');const resolutionNote=required(formData,'resolution_note');
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...roles]);
    const {error}=await supabase.rpc('op_resolve_partner_execution_exception',{p_organisation_id:organisationId,p_user_id:user.id,p_exception_id:exceptionId,p_resolution_note:resolutionNote});
    if(error)throw new Error(error.message);refresh(projectId);destination=executionUrl(projectId,{success:'Execution exception resolved and recorded in the Project audit.'});
  }catch(error){destination=executionUrl(projectId,{error:error instanceof Error?error.message:'Execution exception could not be resolved.'});}
  redirect(destination);
}
