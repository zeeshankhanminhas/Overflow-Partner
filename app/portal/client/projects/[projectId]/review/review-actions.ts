'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

function safe(id:string,key:'error'|'updated',message:string){
 return '/portal/client/projects/'+id+'/review?'+new URLSearchParams({[key]:message.slice(0,260)}).toString();
}
export async function recordProtectedClientDecisionAction(form:FormData){
 const projectId=String(form.get('project_id')||'').trim();
 if(!/^[0-9a-f-]{36}$/i.test(projectId))throw new Error('Invalid controlled project reference.');
 let message='The review decision was not recorded.';
 try{
  assertIsolatedQaBackend();
  if(form.get('confirmed')!=='yes')throw new Error('Confirm your authority to decide on this revision.');
  const outcome=String(form.get('outcome')||'').trim();
  const comments=String(form.get('comments')||'').trim();
  if(!['accepted','accepted_with_comments','changes_requested','rejected'].includes(outcome))
   throw new Error('Select a valid review outcome.');
  if(outcome!=='accepted'&&comments.length<12)throw new Error('Please provide meaningful written comments for this outcome.');
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)throw new Error('Sign into the authorised Client Portal before recording a review decision.');
  // The database independently enforces an active exact company membership,
  // the current issued revision, no prior decision and stage=client_review.
  const {error}=await supabase.rpc('op_qa_record_client_review_decision',{
    p_project_id:projectId,p_outcome:outcome,p_comments:comments});
  if(error)throw new Error(error.message);
  revalidatePath('/portal/client/projects/'+projectId+'/review');
  revalidatePath('/portal/client/projects/'+projectId);
  revalidatePath('/portal/client');
  revalidatePath('/opos-next/projects/'+projectId);
  redirect(safe(projectId,'updated','Your authenticated decision was received. Overflow Partner will reconcile it into the governed project outcome.'));
 }catch(error){
  if(error&&typeof error==='object'&&'digest' in error&&String((error as {digest?:string}).digest||'').startsWith('NEXT_REDIRECT'))throw error;
  message=error instanceof Error?error.message:message;
 }
 redirect(safe(projectId,'error',message));
}
