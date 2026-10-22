'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserContext, assertRole } from '@/lib/auth/context';

const HOME='/outreach';
function urlFor(id:string,kind:'error'|'updated',message:string) {
 return HOME+'/'+encodeURIComponent(id)+'?'+kind+'='+encodeURIComponent(message);
}
function parseLinkedInURL(value:string) {
 if(!value)return null;
 try {
   const u=new URL(value);
   if(u.protocol!=='https:'||!['linkedin.com','www.linkedin.com'].includes(u.hostname)||u.username||u.password)
     throw Error();
   u.hash='';
   return u.toString();
 }catch{throw new Error('Enter a valid https://www.linkedin.com profile URL.');}
}
export async function addOutreachThreadAction(form:FormData) {
 let target=HOME;
 try {
   const {supabase,user,profile,organisationId}=await requireUserContext();
   assertRole(profile.role,['owner','admin','business_development','operator']);
   const company_name=String(form.get('company_name')||'').trim();
   const contact_name=String(form.get('contact_name')||'').trim();
   const job_title=String(form.get('job_title')||'').trim();
   const linkedin_url=parseLinkedInURL(String(form.get('linkedin_url')||'').trim());
   if(company_name.length<2||company_name.length>180||contact_name.length<2||contact_name.length>180||job_title.length>180)
     throw new Error('Enter the company and contact name (2–180 characters).');
   if(linkedin_url){
     const {data:existing,error:searchError}=await supabase.from('linkedin_outreach_threads')
       .select('id').eq('organisation_id',organisationId).eq('linkedin_url',linkedin_url).limit(1).maybeSingle();
     if(searchError)throw new Error(searchError.message);
     if(existing?.id){target=urlFor(existing.id,'updated','This conversation already exists.');revalidatePath(HOME);}
   }
   if(target===HOME){
     const {data,error}=await supabase.from('linkedin_outreach_threads')
       .insert({organisation_id:organisationId,created_by:user.id,company_name,contact_name,
         job_title:job_title||null,linkedin_url}).select('id').single();
     if(error)throw new Error(error.code==='23505'?'This LinkedIn contact already exists. Search the list.':error.message);
     target=urlFor(data.id,'updated','Added to outreach. No CRM record created.');
     revalidatePath(HOME);
   }
 }catch(e){target=HOME+'?add=1&error='+encodeURIComponent(e instanceof Error?e.message:'Unable to add contact.');}
 redirect(target);
}

export async function updateOutreachThreadAction(form:FormData) {
 const id=String(form.get('id')||'').trim();
 let target=HOME;
 try {
  const {supabase,profile,organisationId}=await requireUserContext();
  assertRole(profile.role,['owner','admin','business_development','operator']);
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid outreach ID.');
  const state=String(form.get('state')||'');
  const permitted=['waiting','followup','interested','closed'];
  if(!permitted.includes(state))throw new Error('Choose a valid next step.');
  const followUp=String(form.get('follow_up_iso')||'');
  let next_follow_up_at:string|null=null;
  if(state==='followup'){
    const parsed=new Date(followUp);
    if(!followUp||!Number.isFinite(parsed.getTime()))throw new Error('Choose a valid follow-up time.');
    next_follow_up_at=parsed.toISOString();
  }
  const {data:thread,error:readError}=await supabase.from('linkedin_outreach_threads')
    .select('state').eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(readError||!thread)throw new Error('Outreach conversation not found.');
  if(thread.state==='converted')throw new Error('Already transferred to CRM. Open the existing Prospect.');
  if(thread.state==='interested'&&state!=='interested')
    throw new Error('Interest was already confirmed. Convert to CRM or review with the team.');
  const {error}=await supabase.from('linkedin_outreach_threads')
    .update({state,next_follow_up_at,updated_at:new Date().toISOString()})
    .eq('organisation_id',organisationId).eq('id',id).neq('state','converted');
  if(error)throw new Error(error.message);
  revalidatePath(HOME);revalidatePath(HOME+'/'+id);
  target=urlFor(id,'updated',state==='interested'?'Interest recorded. CRM is still clean until you convert.':'Next action saved.');
 }catch(e){target=urlFor(id,'error',e instanceof Error?e.message:'Unable to update.');}
 redirect(target);
}

export async function promoteOutreachToCrmAction(form:FormData) {
 const id=String(form.get('id')||'').trim();
 let target=HOME;
 try{
  const {supabase,profile,organisationId}=await requireUserContext();
  assertRole(profile.role,['owner','admin','business_development','operator']);
  const {data:thread,error:readError}=await supabase.from('linkedin_outreach_threads')
   .select('id,state,crm_prospect_id').eq('id',id).eq('organisation_id',organisationId).maybeSingle();
  if(readError||!thread)throw new Error('Outreach record not found.');
  if(thread.state!=='interested'&&thread.state!=='converted')
    throw new Error('Confirm interest before creating CRM records.');
  const {data,error}=await supabase.rpc('op_promote_linkedin_outreach',{p_outreach_id:id});
  if(error||!data)throw new Error(error?.message||'Could not convert conversation.');
  revalidatePath(HOME);revalidatePath('/workspace/acquisition');revalidatePath('/workspace/acquisition/prospects');
  target='/workspace/acquisition/'+data+'?updated='+encodeURIComponent('Interested LinkedIn conversation converted into a CRM Prospect.');
 }catch(e){target=urlFor(id,'error',e instanceof Error?e.message:'Conversion failed. No partial records created.');}
 redirect(target);
}
