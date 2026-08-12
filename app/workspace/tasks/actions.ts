'use server';

import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { recordActivity } from '@/lib/repositories/activity';

const roles=['owner','admin','operator','engineering','commercial','business_development'] as const;
const transitions={
  start:{from:['open','blocked'],to:'in_progress'},
  complete:{from:['open','in_progress','blocked'],to:'completed'},
  block:{from:['open','in_progress'],to:'blocked'},
} as const;

export async function actOnTaskAction(formData:FormData){
  const taskId=String(formData.get('task_id')||'').trim();
  const action=String(formData.get('task_action')||'').trim() as keyof typeof transitions;
  if(!taskId||!transitions[action])throw new Error('Invalid task action.');
  const {supabase,user,profile,organisationId}=await requireUserContext();
  assertRole(profile.role,[...roles]);
  const {data:task,error:readError}=await supabase.from('tasks').select('id,title,status,entity_type,entity_id').eq('organisation_id',organisationId).eq('id',taskId).single();
  if(readError||!task)throw new Error(readError?.message||'Task not found.');
  const transition=transitions[action];
  if(!(transition.from as readonly string[]).includes(String(task.status)))throw new Error(`Task cannot ${action} from its current state.`);
  const now=new Date().toISOString();
  const {error}=await supabase.from('tasks').update({status:transition.to,completed_at:transition.to==='completed'?now:null}).eq('organisation_id',organisationId).eq('id',taskId);
  if(error)throw new Error(error.message);
  await recordActivity(supabase,{organisationId,entityType:'task',entityId:taskId,userId:user.id,eventType:`task.${action}`,newValue:{status:transition.to,sourceEntityType:task.entity_type,sourceEntityId:task.entity_id}});
  revalidatePath('/workspace/tasks');revalidatePath('/workspace');
  if(task.entity_type==='project'&&task.entity_id)revalidatePath(`/workspace/projects/${task.entity_id}`);
  if(task.entity_type==='lead'&&task.entity_id)revalidatePath(`/workspace/leads/${task.entity_id}`);
}
