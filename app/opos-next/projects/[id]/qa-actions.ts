'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

function value(form:FormData,key:string){return String(form.get(key)||'').trim();}
function projectUrl(id:string,params:Record<string,string>){return '/opos-next/projects/'+id+'?'+new URLSearchParams(params).toString();}
function refresh(id:string){revalidatePath('/opos-next/projects/'+id);revalidatePath('/workspace/projects/'+id);}

export async function recordEngineeringDecisionAction(form:FormData){
 const id=value(form,'project_id');let message='Engineering decision was not recorded.';
 try{
  assertIsolatedQaBackend();
  const {supabase,profile,organisationId}=await requireUserContext();
  assertRole(profile.role,['owner','admin','engineering']);
  const {data:project}=await supabase.from('projects').select('id').eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(!project)throw new Error('Authorised QA project not found.');
  const checks=Object.fromEntries(['scope','completeness','revision','quality','exceptions'].map(key=>[key,form.get(key)==='true']));
  const decision=value(form,'decision');
  const {error}=await supabase.rpc('op_qa_engineering_decision',{
   p_project_id:id,p_submission_id:value(form,'submission_id'),p_decision:decision,p_findings:value(form,'findings'),p_checklist:checks,
  });
  if(error)throw new Error(error.message);
  refresh(id);
  redirect(projectUrl(id,{updated:decision==='accepted'?'Engineering acceptance recorded for this submission.':'Engineering correction recorded and partner correction stage opened.'}));
 }catch(error){
  // Next redirect throws a framework signal: never convert a successful redirect into an error.
  if(error&&typeof error==='object'&&'digest' in error&&String((error as {digest?:string}).digest||'').startsWith('NEXT_REDIRECT'))throw error;
  message=error instanceof Error?error.message:message;
 }
 redirect(projectUrl(id,{error:message}));
}
export async function verifyDeliveryManifestAction(form:FormData){
 const id=value(form,'project_id');let message='Document control was not recorded.';
 try{
  assertIsolatedQaBackend();
  const {supabase,profile,organisationId}=await requireUserContext();
  assertRole(profile.role,['owner','admin','operator','engineering']);
  const {data:project}=await supabase.from('projects').select('id').eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(!project)throw new Error('Authorised QA project not found.');
  const {error}=await supabase.rpc('op_qa_verify_manifest',{p_project_id:id,p_confirmed:form.get('confirmed')==='true'});
  if(error)throw new Error(error.message);
  refresh(id);
  redirect(projectUrl(id,{updated:'Document manifest verified against engineering acceptance.'}));
 }catch(error){
  if(error&&typeof error==='object'&&'digest' in error&&String((error as {digest?:string}).digest||'').startsWith('NEXT_REDIRECT'))throw error;
  message=error instanceof Error?error.message:message;
 }
 redirect(projectUrl(id,{error:message}));
}
export async function authoriseClientReviewReleaseAction(form:FormData){
 const id=value(form,'project_id');let message='Release authority was not recorded.';
 try{
  assertIsolatedQaBackend();
  const {supabase,profile,organisationId}=await requireUserContext();
  assertRole(profile.role,['owner','admin']);
  const {data:project}=await supabase.from('projects').select('id').eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(!project)throw new Error('Authorised QA project not found.');
  const {error}=await supabase.rpc('op_qa_authorise_review_release',{p_project_id:id,p_note:value(form,'note')});
  if(error)throw new Error(error.message);
  refresh(id);
  redirect(projectUrl(id,{updated:'Client-review preparation authorised. External issue still blocked until secure preview.'}));
 }catch(error){
  if(error&&typeof error==='object'&&'digest' in error&&String((error as {digest?:string}).digest||'').startsWith('NEXT_REDIRECT'))throw error;
  message=error instanceof Error?error.message:message;
 }
 redirect(projectUrl(id,{error:message}));
}

/** The owner explicitly issues an already-authorised, current-cycle PDF
 * into the recipient's existing, independently verified Client Workspace.
 * No email is claimed/sent, and no money/final file permission is modified. */
export async function issueProtectedClientReviewAction(form:FormData){
 const id=value(form,'project_id');let message='Protected client-review issue was not recorded.';
 try{
  assertIsolatedQaBackend();
  const {supabase,profile,organisationId}=await requireUserContext();
  assertRole(profile.role,['owner','admin']);
  const {data:project,error:projectError}=await supabase.from('projects').select('id,project_stage')
   .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(projectError||!project||project.project_stage!=='ready_for_client_issue')
   throw new Error('Current authorised review-preparation project is required.');
  const {error}=await supabase.rpc('op_qa_issue_protected_client_review',{
   p_project_id:id,p_note:value(form,'note')});
  if(error)throw new Error(error.message);
  refresh(id);
  redirect(projectUrl(id,{updated:'The protected R01 package is now available in the verified Client Workspace. In-app issue recorded; no email sent.'}));
 }catch(error){
  if(error&&typeof error==='object'&&'digest' in error&&String((error as {digest?:string}).digest||'').startsWith('NEXT_REDIRECT'))throw error;
  message=error instanceof Error?error.message:message;
 }
 redirect(projectUrl(id,{error:message}));
}

/** OP reconciles the actual external client's signed-in portal decision into
 * the existing canonical review record. This never impersonates the client. */
export async function reconcileProtectedClientReviewAction(form:FormData){
 const id=value(form,'project_id');let message='Client attestation could not be reconciled.';
 try{
  assertIsolatedQaBackend();
  const {supabase,profile,organisationId}=await requireUserContext();
  assertRole(profile.role,['owner','admin','operator','engineering']);
  const {data:project,error:projectError}=await supabase.from('projects').select('id,project_stage')
   .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(projectError||!project||project.project_stage!=='client_review')
   throw new Error('Current governed Client Review project required.');
  const {error}=await supabase.rpc('op_qa_reconcile_client_review_decision',{p_project_id:id});
  if(error)throw new Error(error.message);
  refresh(id);
  redirect(projectUrl(id,{updated:'The external client decision is reconciled against its current-cycle review issue. The next governed stage gate remains separate.'}));
 }catch(error){
  if(error&&typeof error==='object'&&'digest' in error&&String((error as {digest?:string}).digest||'').startsWith('NEXT_REDIRECT'))throw error;
  message=error instanceof Error?error.message:message;
 }
 redirect(projectUrl(id,{error:message}));
}
