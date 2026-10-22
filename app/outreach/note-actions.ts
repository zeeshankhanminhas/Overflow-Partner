'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';

/** Preserve relevant raw LinkedIn/Sales Navigator text in Outreach, never CRM.
 * Pasting does not send messages or infer prospect interest. */
export async function addOutreachNoteAction(form:FormData) {
 const id=String(form.get('outreach_id')||'').trim();
 const body=String(form.get('body')||'').trim();
 const source=String(form.get('source')||'');
 let destination='/outreach';
 try {
  const {supabase,user,organisationId,profile}=await requireUserContext();
  assertRole(profile.role,['owner','admin','business_development','operator']);
  if(!['linkedin','sales_navigator','note'].includes(source))throw new Error('Choose a valid source.');
  if(body.length<1||body.length>60000)throw new Error('Paste up to 60,000 characters.');
  const {data:thread,error:readError}=await supabase.from('linkedin_outreach_threads')
    .select('id,state').eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(readError||!thread)throw new Error('Conversation not found.');
  if(thread.state==='converted')throw new Error('Conversation is already in CRM. Its prior history remains read-only.');
  const {error}=await supabase.from('linkedin_outreach_messages')
    .insert({organisation_id:organisationId,created_by:user.id,outreach_id:id,source,body});
  if(error)throw new Error(error.message);
  revalidatePath('/outreach/'+id);revalidatePath('/outreach');
  destination='/outreach/'+id+'?updated='+encodeURIComponent('Conversation saved. CRM remains unchanged.');
 }catch(e){destination='/outreach/'+encodeURIComponent(id)+'?error='+encodeURIComponent(e instanceof Error?e.message:'Could not save note.');}
 redirect(destination);
}
