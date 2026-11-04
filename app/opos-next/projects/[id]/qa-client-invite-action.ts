'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient as createAdminClient} from '@supabase/supabase-js';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

const NORTHFIELD='b447f586-bf79-4839-be5e-1af607d9ca43';
const QA_ORIGIN='https://overflow-partner-git-design-o-9eda95-zeeshankhanminhas-projects.vercel.app';
function messageUrl(kind:'error'|'updated',value:string){
 return '/opos-next/projects/'+NORTHFIELD+'?'+new URLSearchParams({[kind]:value.slice(0,240)}).toString();
}
function isRedirect(error:unknown){
 return Boolean(error&&typeof error==='object'&&'digest' in error&&
  String((error as {digest?:string}).digest||'').startsWith('NEXT_REDIRECT'));
}

/** Sends a deliberate QA invitation to one provided new recipient address.
 * Never guesses client emails; never grants a member the Operator role.
 * An invited auth user is separately bound to Northfield by the audited RPC.
 */
export async function inviteNorthfieldClientQaAction(form:FormData){
 let err='The QA client invitation was not completed.';
 try{
  assertIsolatedQaBackend();
  const projectId=String(form.get('project_id')||'').trim();
  if(projectId!==NORTHFIELD)throw new Error('This isolated QA invitation only supports Northfield.');
  if(form.get('confirm_separate_login')!=='yes')throw new Error('Confirm the recipient is a separate, controlled QA email account.');
  const email=String(form.get('email')||'').trim().toLowerCase();
  if(email.length>254||!(/^[^@\s]+@[^@\s]+\.[^@\s]+$/).test(email))
   throw new Error('Enter a valid email address controlled by your QA tester.');
  const {supabase,user,profile,organisationId}=await requireUserContext();
  assertRole(profile.role,['owner','admin']);
  if(email===String(user.email||'').trim().toLowerCase())
   throw new Error('The QA Client Portal must use an email address different from the OP operator login.');
  const {data:project,error:projectError}=await supabase.from('projects')
    .select('id,project_stage').eq('organisation_id',organisationId)
    .eq('id',NORTHFIELD).maybeSingle();
  if(projectError||!project||project.project_stage!=='ready_for_client_issue')
    throw new Error('Northfield must be at governed review-package preparation.');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('Isolated QA Auth invitation service is not configured.');
  const admin=createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  // An earlier QA invite may have created the Auth identity before a DB
  // membership assignment failed. Reuse the exact explicitly selected address;
  // never issue duplicate invitations or guess another user.
  const {data:existing,error:existingError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
  if(existingError)throw new Error('Unable to check existing QA invitation accounts.');
  const prior=existing.users.find(item=>String(item.email||'').toLowerCase()===email);
  let recipientId=prior?.id||'';
  let invitationSent=false;
  if(!recipientId){
   // Email leaves the system only after this explicit owner action.
   const {data,error:invitationError}=await admin.auth.admin.inviteUserByEmail(email,{
     redirectTo:QA_ORIGIN+'/auth/callback?next=%2Fportal%2Fclient',
   });
   if(invitationError||!data.user?.id)
    throw new Error(invitationError?.message||'The QA Auth invitation could not be issued.');
   recipientId=data.user.id;
   invitationSent=true;
  }
  const {error:assignError}=await supabase.rpc('op_qa_assign_northfield_client_invite',{
    p_project_id:NORTHFIELD,
    p_auth_user_id:recipientId,
    p_expected_email:email,
  });
  if(assignError)throw new Error('Invite sent but client membership was not activated: '+assignError.message);
  revalidatePath('/opos-next/projects/'+NORTHFIELD);
  redirect(messageUrl('updated',invitationSent?
   'QA client invitation sent and independent Client membership assigned. Confirm the email link before issuing R01.':
   'Existing separate QA client account assigned. Use its own login or request a fresh email sign-in link, then issue R01.'));
 }catch(error){
  if(isRedirect(error))throw error;
  err=error instanceof Error?error.message:err;
 }
 redirect(messageUrl('error',err));
}
