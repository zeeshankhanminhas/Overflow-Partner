'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { recordActivity } from '@/lib/repositories/activity';

/** Lightweight manual notes use existing auditable Prospect activity. They do
 * not infer interest, alter outreach state, or send any external messages.
 * Full structured imports remain behind their separate gated migration. */
export async function addOutreachNoteAction(formData: FormData) {
  const prospectId=String(formData.get('prospect_id')||'').trim();
  const body=String(formData.get('body')||'').trim();
  const safeId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prospectId);
  if(!safeId)redirect('/outreach?error=Invalid%20prospect');
  let result='Saved conversation note.';
  try {
    const {supabase,organisationId,user,profile}=await requireUserContext();
    assertRole(profile.role,['owner','admin','business_development','operator']);
    if(!body||body.length>6000)throw new Error('Paste a relevant conversation excerpt of up to 6,000 characters.');
    const {data,error}=await supabase.from('prospects').select('id,source,status')
      .eq('id',prospectId).eq('organisation_id',organisationId).maybeSingle();
    if(error||!data||data.source!=='linkedin')throw new Error('LinkedIn prospect not found.');
    await recordActivity(supabase,{organisationId,userId:user.id,entityType:'prospect',entityId:prospectId,
      eventType:'prospect.linkedin_conversation_note',eventData:{note:body,source:'manual_copy'}});
    revalidatePath('/outreach/'+prospectId);
    revalidatePath('/workspace/acquisition/'+prospectId);
  } catch(error) {
    result='Error: '+(error instanceof Error?error.message:'Could not save the note.');
  }
  redirect('/outreach/'+prospectId+'?note='+encodeURIComponent(result));
}
