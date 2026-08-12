'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';

const roles = ['owner','admin','operator','engineering','commercial'] as const;

type DeliveryVerb =
  | 'start_work'
  | 'mark_blocked'
  | 'resolve_blocker'
  | 'submit_internal_review'
  | 'approve_internally'
  | 'request_partner_correction'
  | 'send_to_client'
  | 'record_client_acceptance'
  | 'complete_delivery';

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) || '').trim();
  if (!value) throw new Error(`${key.replaceAll('_',' ')} is required.`);
  return value;
}

function deliveryUrl(projectId: string, params: Record<string,string>) {
  return `/workspace/projects/${projectId}/delivery?${new URLSearchParams(params).toString()}`;
}

function refresh(projectId: string) {
  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath(`/workspace/projects/${projectId}/delivery`);
  revalidatePath(`/workspace/projects/${projectId}/execution`);
  revalidatePath('/workspace/projects');
}

async function audit(supabase:any, organisationId:string, userId:string, projectId:string, eventType:string, eventData:Record<string,unknown>) {
  await supabase.from('activity_events').insert({ organisation_id:organisationId,entity_type:'project',entity_id:projectId,user_id:userId,event_type:eventType,event_data:eventData });
}

function transitionFor(item:any, verb:DeliveryVerb) {
  const status=String(item.status||'not_started');
  const internal=String(item.internal_review_status||'not_required');
  const client=String(item.client_review_status||'not_required');

  switch(verb){
    case 'start_work':
      if(status!=='not_started') throw new Error('Only not-started delivery work can be started.');
      return {status:'in_progress',internal_review_status:internal,client_review_status:client,completed_at:null};
    case 'mark_blocked':
      if(!['not_started','in_progress'].includes(status)) throw new Error('Only active delivery work can be marked blocked.');
      return {status:'blocked',internal_review_status:internal,client_review_status:client,completed_at:null};
    case 'resolve_blocker':
      if(status!=='blocked') throw new Error('This delivery item is not blocked.');
      return {status:'in_progress',internal_review_status:internal,client_review_status:client,completed_at:null};
    case 'submit_internal_review':
      if(status!=='in_progress') throw new Error('Only work in progress can be submitted for Internal Review.');
      if(internal==='not_required') throw new Error('Internal Review is not required for this delivery item.');
      return {status:'internal_review',internal_review_status:'pending',client_review_status:client,completed_at:null};
    case 'approve_internally':
      if(status!=='internal_review'||internal!=='pending') throw new Error('This item is not awaiting Internal Review approval.');
      return {status:'ready_to_issue',internal_review_status:'approved',client_review_status:client,completed_at:null};
    case 'request_partner_correction':
      if(!['internal_review','client_review'].includes(status)) throw new Error('Partner correction can only be requested from a review state.');
      return {
        status:'in_progress',
        internal_review_status:status==='internal_review'?'changes_required':internal,
        client_review_status:status==='client_review'?'changes_required':client,
        completed_at:null,
      };
    case 'send_to_client':
      if(!['ready_to_issue','in_progress'].includes(status)) throw new Error('This delivery item is not ready for client issue.');
      if(status==='in_progress'&&internal!=='not_required') throw new Error('Complete Internal Review before client issue.');
      if(client==='not_required') throw new Error('Client Review is not required for this delivery item.');
      return {status:'client_review',internal_review_status:internal,client_review_status:'pending',completed_at:null};
    case 'record_client_acceptance':
      if(status!=='client_review'||client!=='pending') throw new Error('This item is not awaiting Client acceptance.');
      return {status:'complete',internal_review_status:internal,client_review_status:'accepted',completed_at:new Date().toISOString()};
    case 'complete_delivery':
      if(status==='in_progress'&&internal==='not_required'&&client==='not_required') return {status:'complete',internal_review_status:internal,client_review_status:client,completed_at:new Date().toISOString()};
      if(status==='ready_to_issue'&&client==='not_required') return {status:'complete',internal_review_status:internal,client_review_status:client,completed_at:new Date().toISOString()};
      throw new Error('Required review must be completed before this delivery item can be completed.');
  }
}

export async function actOnProjectDeliveryItemAction(formData:FormData){
  const projectId=required(formData,'project_id');
  const itemId=required(formData,'item_id');
  const verb=required(formData,'delivery_action') as DeliveryVerb;
  let destination=`/workspace/projects/${projectId}/delivery`;
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();
    assertRole(profile.role,[...roles]);
    const {data:item,error:readError}=await supabase.from('project_delivery_items')
      .select('id,project_id,title,status,internal_review_status,client_review_status')
      .eq('organisation_id',organisationId).eq('id',itemId).single();
    if(readError||!item) throw new Error(readError?.message||'Delivery item not found.');
    if(item.project_id!==projectId) throw new Error('Delivery item does not belong to this Project.');
    const allowedVerbs:DeliveryVerb[]=['start_work','mark_blocked','resolve_blocker','submit_internal_review','approve_internally','request_partner_correction','send_to_client','record_client_acceptance','complete_delivery'];
    if(!allowedVerbs.includes(verb)) throw new Error('Unsupported delivery action.');
    const updates=transitionFor(item,verb);
    const {error}=await supabase.from('project_delivery_items').update(updates).eq('organisation_id',organisationId).eq('id',itemId);
    if(error) throw new Error(error.message);
    await audit(supabase,organisationId,user.id,projectId,'delivery_item_actioned',{
      deliveryItemId:itemId,title:item.title,action:verb,fromStatus:item.status,toStatus:updates.status,
      internalReview:updates.internal_review_status,clientReview:updates.client_review_status,
    });
    refresh(projectId);
    destination=deliveryUrl(projectId,{updated:'Delivery action recorded.',focus:`delivery-item-${itemId}`});
  }catch(error){
    destination=deliveryUrl(projectId,{error:error instanceof Error?error.message:'Delivery action could not be completed.',focus:`delivery-item-${itemId}`});
  }
  redirect(destination);
}
