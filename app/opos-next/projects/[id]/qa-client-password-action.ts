'use server';

import {createClient as createAdminClient} from '@supabase/supabase-js';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

const NORTHFIELD='b447f586-bf79-4839-be5e-1af607d9ca43';
const EMAIL='midts.systems@gmail.com';
export type QaPasswordResult={status:'idle'|'error'|'ready';message:string};

/** Test-only: owner explicitly sets password for the already-issued Northfield
 * QA client identity. Never creates users, changes memberships or touches production. */
export async function setNorthfieldQaClientPassword(
 _previous:QaPasswordResult, form:FormData
):Promise<QaPasswordResult>{
 const fail=(message:string):QaPasswordResult=>({status:'error',message});
 try{
  assertIsolatedQaBackend();
  if(process.env.VERCEL_GIT_COMMIT_REF!=='qa/recovery-ui-client-gate-20261105'||
     process.env.OP_QA_SUPABASE_PROJECT_REF!=='ukcamenuxhdznxaxpyis')
   return fail('This operation is restricted to the isolated Northfield QA recovery branch.');
  if(String(form.get('project_id')||'')!==NORTHFIELD)return fail('Northfield QA project required.');
  if(form.get('confirm_test_password')!=='yes')return fail('Explicitly confirm simulated client password setup.');
  const password=String(form.get('password')||'');
  const confirm=String(form.get('password_confirmation')||'');
  if(password!==confirm)return fail('Passwords do not match.');
  if(password.length<12||password.length>128||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))
   return fail('Choose 12–128 characters with at least one letter and one number.');
  const {supabase,user,profile,organisationId}=await requireUserContext();
  assertRole(profile.role,['owner','admin']);
  if(String(user.email||'').toLowerCase()===EMAIL)return fail('Operator and QA Client identities must be separate.');
  const {data:project,error:projectError}=await supabase.from('projects').select('id,project_stage')
   .eq('id',NORTHFIELD).eq('organisation_id',organisationId).maybeSingle();
  if(projectError||!project||project.project_stage!=='client_review')
   return fail('Northfield must have an issued client-review package for this test.');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(url!=='https://ukcamenuxhdznxaxpyis.supabase.co'||!key)
   return fail('QA authentication configuration is unavailable.');
  const admin=createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:issue,error:issueError}=await admin.from('op_qa_client_review_issues')
   .select('membership_id').eq('project_id',NORTHFIELD).order('issued_at',{ascending:false}).limit(1).maybeSingle();
  if(issueError||!issue?.membership_id)return fail('The issued Northfield review recipient could not be verified.');
  const {data:membership,error:membershipError}=await admin.from('external_portal_memberships')
   .select('auth_user_id,portal_kind,is_active').eq('id',issue.membership_id).maybeSingle();
  if(membershipError||!membership||membership.portal_kind!=='client'||!membership.is_active||!membership.auth_user_id)
   return fail('The issued recipient is not an active independent client.');
  const {data:client,error:clientError}=await admin.auth.admin.getUserById(membership.auth_user_id);
  if(clientError||!client?.user||String(client.user.email||'').toLowerCase()!==EMAIL||
     !client.user.email_confirmed_at||client.user.id===user.id)
   return fail('The recipient does not match the confirmed Northfield QA Client identity.');
  const {error:updateError}=await admin.auth.admin.updateUserById(client.user.id,{password});
  if(updateError)return fail('Supabase could not set the QA test password. No project records were changed.');
  return {status:'ready',message:'QA Client password saved for the existing Northfield identity. Open the Client login in a separate private browser and sign in with the password you selected.'};
 }catch{
  return fail('QA password setup failed safely. The client-review release and permissions were not changed.');
 }
}
