'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { cancelEntityReminders } from '@/lib/notifications/queue';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { createExecutionSessionToken } from '@/lib/execution/sessionToken';

const roles=['owner','admin','operator','engineering','commercial'] as const;
function required(formData:FormData,key:string){const value=String(formData.get(key)||'').trim();if(!value)throw new Error(`${key.replaceAll('_',' ')} is required.`);return value;}
function projectUrl(projectId:string,params:Record<string,string>){return `/workspace/projects/${projectId}?${new URLSearchParams(params).toString()}`;}
function refresh(projectId:string){revalidatePath(`/workspace/projects/${projectId}`);revalidatePath(`/workspace/projects/${projectId}/execution`);revalidatePath(`/workspace/projects/${projectId}/delivery`);revalidatePath('/workspace/projects');revalidatePath('/workspace/documents');}
function appUrl(){return (process.env.NEXT_PUBLIC_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||'https://overflow-partner.vercel.app').replace(/\/$/,'');}

export async function recordClientTransmittalAction(formData:FormData){
  const projectId=required(formData,'project_id');let destination=`/workspace/projects/${projectId}`;
  try{
    const recipientName=required(formData,'recipient_name');const deliveryMethod=required(formData,'delivery_method');
    const recipientEmail=String(formData.get('recipient_email')||'').trim();const note=String(formData.get('note')||'').trim();
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...roles]);
    const {data,error}=await supabase.rpc('op_record_client_transmittal_and_issue',{
      p_organisation_id:organisationId,p_user_id:user.id,p_project_id:projectId,p_recipient_name:recipientName,p_recipient_email:recipientEmail||null,p_delivery_method:deliveryMethod,p_note:note||null,
    });
    if(error)throw new Error(error.message);
    const {data:project}=await supabase.from('projects').select('project_number,title,due_date').eq('organisation_id',organisationId).eq('id',projectId).maybeSingle();
    const reference=String(data?.transmittal?.transmittal_reference||project?.project_number||'');
    if(recipientEmail){
      const payload={reference,project:project?.title,dueDate:project?.due_date};
      await queueLifecycleEmail(supabase,{organisationId,scenario:'client_delivery.issued',recipientEmail,recipientName,actionUrl:appUrl(),payload,entityType:'project',entityId:projectId,idempotencyKey:`client-delivery:issued:${reference||projectId}`}).catch(()=>null);
      await queueLifecycleEmail(supabase,{organisationId,scenario:'client_delivery.review_reminder',recipientEmail,recipientName,actionUrl:appUrl(),payload,entityType:'project',entityId:projectId,scheduledFor:new Date(Date.now()+3*24*60*60*1000).toISOString(),idempotencyKey:`client-delivery:review-reminder:${reference||projectId}`}).catch(()=>null);
    }
    refresh(projectId);
    destination=projectUrl(projectId,{advanced:'issued_to_client',updated:reference?`Client delivery ${reference} recorded.`:'Client delivery recorded.',focus:'record-next-action'});
  }catch(error){destination=projectUrl(projectId,{error:error instanceof Error?error.message:'Client delivery could not be recorded.',focus:'record-next-action'});}
  redirect(destination);
}

export async function recordClientReviewOutcomeAction(formData:FormData){
  const projectId=required(formData,'project_id');let destination=`/workspace/projects/${projectId}`;
  try{
    const outcome=required(formData,'outcome');const evidenceBasis=required(formData,'evidence_basis');const evidenceReference=required(formData,'evidence_reference');const comments=String(formData.get('comments')||'').trim();
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...roles]);
    const {data,error}=await supabase.rpc('op_record_client_review_outcome',{
      p_organisation_id:organisationId,p_user_id:user.id,p_project_id:projectId,p_outcome:outcome,p_evidence_basis:evidenceBasis,p_evidence_reference:evidenceReference,p_comments:comments||null,
    });
    if(error)throw new Error(error.message);
    await cancelEntityReminders(supabase,{organisationId,entityType:'project',entityId:projectId,categories:['reminder']}).catch(()=>0);
    const [{data:project},{data:lead}]=await Promise.all([
      supabase.from('projects').select('project_number,title,lead_id').eq('organisation_id',organisationId).eq('id',projectId).maybeSingle(),
      supabase.from('projects').select('lead_id').eq('organisation_id',organisationId).eq('id',projectId).maybeSingle(),
    ]);
    let client:null|{contact_name?:string|null;contact_email?:string|null;company_name?:string|null}=null;
    if(lead?.lead_id){const {data:clientRow}=await supabase.from('leads').select('contact_name,contact_email,company_name').eq('organisation_id',organisationId).eq('id',lead.lead_id).maybeSingle();client=clientRow;}
    if(client?.contact_email) await queueLifecycleEmail(supabase,{organisationId,scenario:'client_delivery.review_outcome',recipientEmail:client.contact_email,recipientName:client.contact_name,actionUrl:appUrl(),payload:{company:client.company_name,reference:project?.project_number,outcome,comments},entityType:'project',entityId:projectId,idempotencyKey:`client-review:outcome:${projectId}:${evidenceReference}`}).catch(()=>null);

    if(['changes_requested','rejected','changes_needed'].includes(outcome)){
      const {data:assignment}=await supabase.from('project_execution_assignments').select('id,partner_contact_name,partner_contact_email').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
      if(assignment?.partner_contact_email){
        const {data:session}=await supabase.from('partner_execution_sessions').select('id').eq('organisation_id',organisationId).eq('assignment_id',assignment.id).in('status',['invited','opened','active']).order('created_at',{ascending:false}).limit(1).maybeSingle();
        const partnerUrl=session?.id?`${appUrl()}/execution/${createExecutionSessionToken(session.id)}`:appUrl();
        await queueLifecycleEmail(supabase,{organisationId,scenario:'partner_work.action_required',recipientEmail:assignment.partner_contact_email,recipientName:assignment.partner_contact_name,actionUrl:partnerUrl,payload:{reference:project?.project_number,project:project?.title,message:comments||'Client changes have been requested.'},entityType:'project',entityId:projectId,idempotencyKey:`partner-work:client-changes:${projectId}:${evidenceReference}`}).catch(()=>null);
      }
    }
    refresh(projectId);
    const projectStage=String(data?.projectStage||'client_review');
    destination=projectUrl(projectId,{updated:`Client outcome recorded: ${outcome.replaceAll('_',' ')}.`,...(projectStage==='partner_correction'?{advanced:'partner_correction'}:{}),focus:'record-next-action'});
  }catch(error){destination=projectUrl(projectId,{error:error instanceof Error?error.message:'Client outcome could not be recorded.',focus:'record-next-action'});}
  redirect(destination);
}
