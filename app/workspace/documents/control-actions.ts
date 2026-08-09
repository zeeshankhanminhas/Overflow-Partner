'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertRole, requireUserContext } from '@/lib/auth/context';

const controlRoles = ['owner','admin','engineering','commercial'] as const;
const ownerRoles = ['owner','admin'] as const;

function documentReturn(document:{lead_id:string|null;project_id:string|null}, params:Record<string,string>) {
  const base = document.project_id ? `/workspace/documents?project=${document.project_id}` : document.lead_id ? `/workspace/documents?lead=${document.lead_id}` : '/workspace/documents';
  const url = new URL(base,'https://overflow-partner.local');
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
  return `${url.pathname}${url.search}`;
}

function refresh(document:{lead_id:string|null;project_id:string|null}) {
  revalidatePath('/workspace/documents');
  if(document.project_id){revalidatePath(`/workspace/projects/${document.project_id}`);revalidatePath(`/workspace/projects/${document.project_id}/delivery`);}
  if(document.lead_id) revalidatePath(`/workspace/leads/${document.lead_id}`);
}

function nextRevision(version:unknown){return Math.max(1,Number(version||1)+1)}
function revisionCode(version:number){return `P${String(version).padStart(2,'0')}`}

export async function createDocumentRevisionAction(formData:FormData){
  const documentId=String(formData.get('document_id')||'');
  if(!documentId) redirect('/workspace/documents?error='+encodeURIComponent('A document is required to create a revision.'));
  let fallback='/workspace/documents';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...controlRoles]);
    const {data:document,error}=await supabase.from('documents').select('id,lead_id,project_id,quote_id,document_type,reference,title,status,version,governance_mode,independent_review_required,is_current_revision').eq('organisation_id',organisationId).eq('id',documentId).single();
    if(error||!document) throw new Error(error?.message||'Document could not be found.');
    fallback=documentReturn(document,{focus:`document-${document.id}`});
    if(String(document.status)==='draft' || String(document.status)==='changes_requested') throw new Error('Finish or update the current working revision instead of creating another draft.');
    if(document.is_current_revision===false || String(document.status)==='superseded') throw new Error('A new revision can only be created from the current revision.');

    const version=nextRevision(document.version);const revision=revisionCode(version);const now=new Date().toISOString();
    const {data:newDocument,error:insertError}=await supabase.from('documents').insert({
      organisation_id:organisationId,created_by:user.id,lead_id:document.lead_id,project_id:document.project_id,quote_id:document.quote_id,
      document_type:document.document_type,reference:document.reference,title:document.title,status:'draft',version,
      governance_mode:document.governance_mode,independent_review_required:document.independent_review_required,
      revision_code:revision,issue_purpose:'internal',control_state:'working',supersedes_document_id:document.id,is_current_revision:true,
    }).select('id,reference').single();
    if(insertError||!newDocument) throw new Error(insertError?.message||'New revision could not be created.');

    const {error:supersedeError}=await supabase.from('documents').update({status:'superseded',control_state:'superseded',is_current_revision:false,superseded_at:now,superseded_by:user.id,superseded_by_document_id:newDocument.id,updated_at:now}).eq('organisation_id',organisationId).eq('id',document.id);
    if(supersedeError){await supabase.from('documents').delete().eq('organisation_id',organisationId).eq('id',newDocument.id);throw new Error(supersedeError.message);}

    const entityType=document.project_id?'project':'lead';const entityId=document.project_id||document.lead_id;
    if(entityId) await supabase.from('activity_events').insert({organisation_id:organisationId,entity_type:entityType,entity_id:entityId,user_id:user.id,event_type:'document.revision_created',event_data:{previous_document_id:document.id,new_document_id:newDocument.id,reference:document.reference,revision_code:revision,version},old_value:{document_id:document.id,status:document.status,version:document.version},new_value:{document_id:newDocument.id,status:'draft',version,revision_code:revision}});
    refresh(document);
    redirect(documentReturn(document,{created:`Revision ${revision} created.`,focus:`document-${newDocument.id}`}));
  }catch(error){if(error&&typeof error==='object'&&'digest'in error)throw error;redirect(`${fallback}${fallback.includes('?')?'&':'?'}error=${encodeURIComponent(error instanceof Error?error.message:'Revision could not be created.')}`)}
}

export async function withdrawControlledDocumentAction(formData:FormData){
  const documentId=String(formData.get('document_id')||'');const reason=String(formData.get('reason')||'').trim();
  if(!documentId) redirect('/workspace/documents?error='+encodeURIComponent('A document is required.'));
  let fallback='/workspace/documents';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...ownerRoles]);
    const {data:document,error}=await supabase.from('documents').select('id,lead_id,project_id,reference,status,version,revision_code,is_current_revision').eq('organisation_id',organisationId).eq('id',documentId).single();
    if(error||!document)throw new Error(error?.message||'Document could not be found.');fallback=documentReturn(document,{focus:`document-${document.id}`});
    if(!reason)throw new Error('Record a withdrawal reason.');
    if(['superseded'].includes(String(document.status))||document.is_current_revision===false)throw new Error('Historical revisions cannot be withdrawn.');
    const now=new Date().toISOString();
    const {error:updateError}=await supabase.from('documents').update({control_state:'withdrawn',is_current_revision:false,withdrawn_at:now,withdrawn_by:user.id,updated_at:now}).eq('organisation_id',organisationId).eq('id',documentId);
    if(updateError)throw new Error(updateError.message);
    const entityType=document.project_id?'project':'lead';const entityId=document.project_id||document.lead_id;
    if(entityId)await supabase.from('activity_events').insert({organisation_id:organisationId,entity_type:entityType,entity_id:entityId,user_id:user.id,event_type:'document.withdrawn',event_data:{document_id:document.id,reference:document.reference,revision_code:document.revision_code||`v${document.version}`,reason,withdrawn_at:now},old_value:{status:document.status,control_state:'issued'},new_value:{control_state:'withdrawn'}});
    refresh(document);redirect(documentReturn(document,{updated:'Document withdrawn from current use.',focus:`document-${document.id}`}));
  }catch(error){if(error&&typeof error==='object'&&'digest'in error)throw error;redirect(`${fallback}${fallback.includes('?')?'&':'?'}error=${encodeURIComponent(error instanceof Error?error.message:'Document could not be withdrawn.')}`)}
}
