'use server';

import {createClient as createAdminClient} from '@supabase/supabase-js';
import {revalidatePath} from 'next/cache';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

const NORTHFIELD='b447f586-bf79-4839-be5e-1af607d9ca43';
const QA_ORIGIN='https://overflow-partner-git-design-o-9eda95-zeeshankhanminhas-projects.vercel.app';
export type ManualQaLinkResult={
  status:'idle'|'ready'|'error';message:string;
  /** One-use authentication secret. Only returned to the initiating OP owner. */
  link:string|null;
};

export async function createNorthfieldManualQaClientLink(
  _previous:ManualQaLinkResult,form:FormData
):Promise<ManualQaLinkResult>{
 const fail=(message:string):ManualQaLinkResult=>({status:'error',message,link:null});
 try{
  assertIsolatedQaBackend();
  const id=String(form.get('project_id')||'').trim();
  const email=String(form.get('email')||'').trim().toLowerCase();
  if(id!==NORTHFIELD)return fail('Manual QA activation is restricted to the Northfield test project.');
  if(form.get('qa_manual_ack')!=='yes')
   return fail('Confirm that this creates a separate simulated QA identity without email-delivery verification.');
  if(email.length>254||!(/^[^@\s]+@[^@\s]+\.[^@\s]+$/).test(email))
   return fail('Enter a valid, separate QA client identity email.');
  const {supabase,user,profile,organisationId}=await requireUserContext();
  assertRole(profile.role,['owner','admin']);
  if(email===String(user.email||'').trim().toLowerCase())
   return fail('The QA Client identity must differ from the signed-in OP account.');
  const {data:project,error:projectError}=await supabase.from('projects')
   .select('id,project_stage').eq('organisation_id',organisationId)
   .eq('id',NORTHFIELD).maybeSingle();
  if(projectError||!project||project.project_stage!=='ready_for_client_issue')
   return fail('Northfield must remain in authorised review-package preparation.');

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return fail('Isolated QA authentication service credentials are missing.');
  const admin=createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:existing,error:lookupError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
  if(lookupError)return fail('The QA identity list could not be checked. No link was generated.');
  const known=existing.users.find(entry=>String(entry.email||'').trim().toLowerCase()===email);
  // generateLink creates an invite account or an OTP for an existing invited one,
  // but does not call the mail provider (Resend/SMTP).
  const type=known?'magiclink':'invite';
  const {data,error:linkError}=await admin.auth.admin.generateLink({
    type,email,options:{redirectTo:QA_ORIGIN+'/auth/callback'}
  });
  if(linkError||!data?.user?.id||!data.properties?.hashed_token)
   return fail(linkError?.message||'The isolated QA authentication token could not be generated.');

  // Only owner can assign a strictly separate account for the exact project's
  // linked client company. This RPC refuses staff identities, wrong company or
  // any project after a real client issue has been recorded.
  const {error:assignError}=await supabase.rpc('op_qa_assign_northfield_client_invite',{
    p_project_id:NORTHFIELD,
    p_auth_user_id:data.user.id,
    p_expected_email:email
  });
  if(assignError)return fail('QA link creation succeeded, but recipient authorisation failed: '+assignError.message);

  revalidatePath('/opos-next/projects/'+NORTHFIELD);
  // Present to the authorising QA owner only. Do not save tokens in database,
  // logs, URL search parameters, email drafts or analytics.
  const link=QA_ORIGIN+'/auth/callback?token_hash='+
   encodeURIComponent(data.properties.hashed_token)+'&type='+encodeURIComponent(type);
  return {
   status:'ready',link,
   message:'A separate QA account is assigned. Copy this single-use sign-in link and open it in an incognito/private browser. No email was sent or mailbox ownership verified.'
  };
 }catch(error){
  return fail(error instanceof Error?error.message:'The isolated QA login link could not be created.');
 }
}
