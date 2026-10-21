'use server';

import { redirect } from 'next/navigation';
import { randomUUID } from 'crypto';
import { classifyClientFeedback, type ClientFeedbackCategory } from '@/lib/lifecycle/voiceAgreedContract';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { cancelEntityReminders } from '@/lib/notifications/queue';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { createExecutionSessionToken } from '@/lib/execution/sessionToken';
import { buildDocumentAdapter } from '@/components/workspace/documents/documentAdapter';
import { createControlledPdf, pdfEmailAttachment } from '@/lib/notifications/controlledPdf';

const roles=['owner','admin','operator','engineering','commercial'] as const;
function required(formData:FormData,key:string){const value=String(formData.get(key)||'').trim();if(!value)throw new Error(`${key.replaceAll('_',' ')} is required.`);return value;}
function projectUrl(projectId:string,params:Record<string,string>){return `/workspace/projects/${projectId}?${new URLSearchParams(params).toString()}`;}
function refresh(projectId:string){revalidatePath(`/workspace/projects/${projectId}`);revalidatePath(`/workspace/projects/${projectId}/execution`);revalidatePath(`/workspace/projects/${projectId}/delivery`);revalidatePath('/workspace/projects');revalidatePath('/workspace/documents');}
function appUrl(){return (process.env.NEXT_PUBLIC_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||'https://overflow-partner.vercel.app').replace(/\/$/,'');}

export async function recordClientTransmittalAction(formData:FormData){
  const projectId=required(formData,'project_id');let destination=`/workspace/projects/${projectId}`;
  try{
    const recipientName=required(formData,'recipient_name');const recipientEmail=required(formData,'recipient_email').toLowerCase();const deliveryMethod=required(formData,'delivery_method');const note=String(formData.get('note')||'').trim();
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...roles]);
    const {data:project}=await supabase.from('projects').select('project_number,title,due_date,lead_id,quote_id,project_stage').eq('organisation_id',organisationId).eq('id',projectId).maybeSingle();
    if(project?.project_stage!=='ready_for_client_issue')throw new Error('Client delivery can only be issued from Ready for client issue.');
    const reference=String(project?.project_number||'');const payload={reference,project:project?.title,dueDate:project?.due_date};
    const {data:assignment}=await supabase.from('project_execution_assignments').select('id,execution_cycle').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
    const deliveryKey=`client-delivery:${projectId}:cycle:${assignment?.execution_cycle||1}`;
    const {data:handover}=await supabase.from('documents').select('id,reference,version,status').eq('organisation_id',organisationId).eq('project_id',projectId).eq('document_type','handover-pack').eq('is_current_revision',true).in('status',['issued','published']).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(!handover)throw new Error('An issued Handover Pack is required before client delivery.');
    const adapted=await buildDocumentAdapter(supabase,'handover-pack',{organisationId,projectId,caseId:project?.lead_id,quoteId:project?.quote_id});
    const handoverPdf=await createControlledPdf('Client Handover Pack',adapted);
    // CLIENT REVIEW ONLY: no signed URLs for editable partner source files at this stage.
    // Final editable engineering deliverables require verified 100% payment and a separate
    // explicit OPOS owner final-release decision. The existing handover PDF is read-only.
    const deliveryPayload={
      ...payload,
      heading:'Your controlled engineering review package',
      message:'Please review the attached controlled PDF. This is a review issue only; editable engineering source files will be made available separately after final settlement and Overflow Partner release approval.',
      actions:[],
      emailAttachments:[pdfEmailAttachment(`${handover.reference||reference}-R${handover.version||1}-Review-Handover-Pack.pdf`,handoverPdf)],
    };
    const queued=await queueLifecycleEmail(supabase,{organisationId,scenario:'client_delivery.issued',recipientEmail,recipientName,actionUrl:appUrl(),payload:deliveryPayload,entityType:'project',entityId:projectId,idempotencyKey:`${deliveryKey}:issued`});
    if(!queued)throw new Error('Client email could not be queued; the Project remains at Ready for client issue.');
    const {error}=await supabase.rpc('op_record_client_transmittal_and_issue',{p_organisation_id:organisationId,p_user_id:user.id,p_project_id:projectId,p_recipient_name:recipientName,p_recipient_email:recipientEmail,p_delivery_method:deliveryMethod,p_note:note||null});
    if(error)throw new Error(error.message);
    let communicationError='';
    try{
      await queueLifecycleEmail(supabase,{organisationId,scenario:'client_delivery.review_reminder',recipientEmail,recipientName,actionUrl:appUrl(),payload,entityType:'project',entityId:projectId,scheduledFor:new Date(Date.now()+3*24*60*60*1000).toISOString(),idempotencyKey:`${deliveryKey}:review-reminder`});
    }catch(emailError){communicationError=emailError instanceof Error?emailError.message:'Client notification could not be queued.';}
    refresh(projectId);
    destination=communicationError?projectUrl(projectId,{advanced:'issued_to_client',error:`Delivery was recorded, but the client email with the Handover Pack PDF could not be queued for ${recipientName} (${recipientEmail}): ${communicationError}`,focus:'record-next-action'}):projectUrl(projectId,{advanced:'issued_to_client',updated:`Client review-only email queued with the controlled PDF for ${recipientName} · ${recipientEmail}${reference?` · ${reference}`:''}`,focus:'record-next-action'});
  }catch(error){destination=projectUrl(projectId,{error:error instanceof Error?error.message:'Client delivery could not be recorded.',focus:'record-next-action'});}
  redirect(destination);
}

export async function recordClientReviewOutcomeAction(formData:FormData){
  const projectId=required(formData,'project_id');let destination=`/workspace/projects/${projectId}`;
  try{
    const outcome=required(formData,'outcome');const evidenceBasis=required(formData,'evidence_basis');const evidenceReference=required(formData,'evidence_reference');const comments=String(formData.get('comments')||'').trim();
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...roles]);
    const changesRequested=['changes_requested','rejected','changes_needed'].includes(outcome);
    const category=String(formData.get('feedback_category')||'in_scope_correction') as ClientFeedbackCategory;
    const isPartnerDefect=formData.get('partner_defect')==='true';
    let variationRecorded=false;
    if(changesRequested){
      if(!['in_scope_correction','revision','out_of_scope_change'].includes(category))throw new Error('Classify the feedback before recording it.');
      if(!comments)throw new Error('Provide all requested changes in one consolidated list with references.');
      if(isPartnerDefect&&category!=='in_scope_correction')throw new Error('A scope variation cannot be categorised as a partner defect.');
      if(category==='revision'||category==='out_of_scope_change'){
        const {data:existing,error:existingError}=await supabase.from('project_change_requests')
          .select('id,change_reference').eq('organisation_id',organisationId).eq('project_id',projectId)
          .eq('description',comments).in('status',['proposed','under_review','approved']).limit(1).maybeSingle();
        if(existingError)throw new Error(existingError.message);
        if(!existing){
          const reference='OP-CR-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+randomUUID().slice(0,8).toUpperCase();
          const {error:variationError}=await supabase.from('project_change_requests').insert({
            organisation_id:organisationId,project_id:projectId,change_reference:reference,
            description:comments,reason:category,scope_impact:'Await partner technical impact assessment',
            programme_impact:'Await programme assessment',commercial_impact:null,status:'proposed',requested_by:user.id,
          });
          if(variationError)throw new Error(variationError.message);
        }
        // A new requirement must never be sent for free partner correction or auto-accepted.
        refresh(projectId);
        destination=projectUrl(projectId,{updated:'Separate variation recorded. Technical, price and timeline approval are required before partner work.',focus:'record-next-action'});
        variationRecorded=true;
      }
      if(!variationRecorded){
      const {count,error:historyError}=await supabase.from('activity_events')
        .select('id',{count:'exact',head:true}).eq('organisation_id',organisationId).eq('entity_type','project')
        .eq('entity_id',projectId).eq('event_type','client.included_correction_round');
      if(historyError)throw new Error(historyError.message);
      const classification=classifyClientFeedback({
        category,correctionRoundsUsed:count||0,defectAgainstApprovedScope:isPartnerDefect,
      });
      if(classification==='correction_round_exhausted')throw new Error('The one included correction round is already used. Create a separately approved variation, or record evidence of a partner defect.');
      }
    }
    if(!variationRecorded){
    const {data,error}=await supabase.rpc('op_record_client_review_outcome',{p_organisation_id:organisationId,p_user_id:user.id,p_project_id:projectId,p_outcome:outcome,p_evidence_basis:evidenceBasis,p_evidence_reference:evidenceReference,p_comments:comments||null});
    if(error)throw new Error(error.message);
    if(changesRequested){
      const {error:classificationError}=await supabase.from('activity_events').insert({
        organisation_id:organisationId,user_id:user.id,entity_type:'project',entity_id:projectId,
        event_type:isPartnerDefect?'client.partner_defect_rework':'client.included_correction_round',
        event_data:{evidenceReference,feedbackCategory:category,partnerDefect:isPartnerDefect,comments},
      });
      if(classificationError)throw new Error('Client outcome recorded but correction-round classification needs operator reconciliation: '+classificationError.message);
    }
    await cancelEntityReminders(supabase,{organisationId,entityType:'project',entityId:projectId,categories:['reminder']}).catch(()=>0);
    const [{data:project},{data:lead}]=await Promise.all([supabase.from('projects').select('project_number,title,lead_id').eq('organisation_id',organisationId).eq('id',projectId).maybeSingle(),supabase.from('projects').select('lead_id').eq('organisation_id',organisationId).eq('id',projectId).maybeSingle()]);
    let client:null|{contact_name?:string|null;contact_email?:string|null;company_name?:string|null}=null;
    if(lead?.lead_id){const {data:clientRow}=await supabase.from('leads').select('contact_name,contact_email,company_name').eq('organisation_id',organisationId).eq('id',lead.lead_id).maybeSingle();client=clientRow;}
    if(client?.contact_email) await queueLifecycleEmail(supabase,{organisationId,scenario:'client_delivery.review_outcome',recipientEmail:client.contact_email,recipientName:client.contact_name,actionUrl:appUrl(),payload:{company:client.company_name,reference:project?.project_number,outcome,comments},entityType:'project',entityId:projectId,idempotencyKey:`client-review:outcome:${projectId}:${evidenceReference}`}).catch(()=>null);
    if(['changes_requested','rejected','changes_needed'].includes(outcome)){
      const {data:assignment}=await supabase.from('project_execution_assignments').select('id,partner_contact_name,partner_contact_email').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
      if(assignment?.partner_contact_email){const {data:session}=await supabase.from('partner_execution_sessions').select('id').eq('organisation_id',organisationId).eq('assignment_id',assignment.id).in('status',['invited','opened','active']).order('created_at',{ascending:false}).limit(1).maybeSingle();const partnerUrl=session?.id?`${appUrl()}/execution/${createExecutionSessionToken(session.id)}`:appUrl();await queueLifecycleEmail(supabase,{organisationId,scenario:'partner_work.action_required',recipientEmail:assignment.partner_contact_email,recipientName:assignment.partner_contact_name,actionUrl:partnerUrl,payload:{reference:project?.project_number,project:project?.title,message:comments||'Client changes have been requested.'},entityType:'project',entityId:projectId,idempotencyKey:`partner-work:client-changes:${projectId}:${evidenceReference}`}).catch(()=>null);}
    }
    refresh(projectId);const projectStage=String(data?.projectStage||'client_review');destination=projectUrl(projectId,{updated:`Client outcome recorded: ${outcome.replaceAll('_',' ')}.`,...(projectStage==='partner_correction'?{advanced:'partner_correction'}:{}),focus:'record-next-action'});
    }
  }catch(error){destination=projectUrl(projectId,{error:error instanceof Error?error.message:'Client outcome could not be recorded.',focus:'record-next-action'});}
  redirect(destination);
}
