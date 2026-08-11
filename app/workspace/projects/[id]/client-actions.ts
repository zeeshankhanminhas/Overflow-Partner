'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';

const roles=['owner','admin','operator','engineering','commercial'] as const;
function required(formData:FormData,key:string){const value=String(formData.get(key)||'').trim();if(!value)throw new Error(`${key.replaceAll('_',' ')} is required.`);return value;}
function projectUrl(projectId:string,params:Record<string,string>){return `/workspace/projects/${projectId}?${new URLSearchParams(params).toString()}`;}
function refresh(projectId:string){revalidatePath(`/workspace/projects/${projectId}`);revalidatePath(`/workspace/projects/${projectId}/execution`);revalidatePath(`/workspace/projects/${projectId}/delivery`);revalidatePath('/workspace/projects');revalidatePath('/workspace/documents');}

export async function recordClientTransmittalAction(formData:FormData){
  const projectId=required(formData,'project_id');let destination=`/workspace/projects/${projectId}`;
  try{
    const recipientName=required(formData,'recipient_name');const deliveryMethod=required(formData,'delivery_method');
    const recipientEmail=String(formData.get('recipient_email')||'').trim();const note=String(formData.get('note')||'').trim();
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...roles]);
    const {data,error}=await supabase.rpc('op_record_client_transmittal_and_issue',{
      p_organisation_id:organisationId,p_user_id:user.id,p_project_id:projectId,p_recipient_name:recipientName,p_recipient_email:recipientEmail||null,p_delivery_method:deliveryMethod,p_note:note||null,
    });
    if(error)throw new Error(error.message);refresh(projectId);
    const reference=String(data?.transmittal?.transmittal_reference||'');
    destination=projectUrl(projectId,{advanced:'issued_to_client',updated:reference?`Client transmittal ${reference} recorded.`:'Controlled client transmittal recorded.',focus:'record-next-action'});
  }catch(error){destination=projectUrl(projectId,{error:error instanceof Error?error.message:'Client transmittal could not be recorded.',focus:'record-next-action'});}
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
    if(error)throw new Error(error.message);refresh(projectId);
    const projectStage=String(data?.projectStage||'client_review');
    destination=projectUrl(projectId,{updated:`Client Review outcome recorded: ${outcome.replaceAll('_',' ')}.`,...(projectStage==='partner_correction'?{advanced:'partner_correction'}:{}),focus:'record-next-action'});
  }catch(error){destination=projectUrl(projectId,{error:error instanceof Error?error.message:'Client Review outcome could not be recorded.',focus:'record-next-action'});}
  redirect(destination);
}
