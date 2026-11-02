'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';
import {issueWorkOrderAfterVerifiedOpeningPayment} from '@/lib/execution/paymentWorkOrderHandoff';

export async function retryGovernedWorkOrderAction(formData:FormData){
  const projectId=String(formData.get('project_id')||'');
  if(!/^[0-9a-f-]{36}$/i.test(projectId))throw new Error('Invalid project reference.');
  const target='/opos-next/projects/'+encodeURIComponent(projectId)+'/work-order';
  let params='';
  try{
    assertIsolatedQaBackend();
    const {supabase,organisationId,user,profile}=await requireUserContext();
    assertRole(profile.role,['owner','admin']);
    const result=await issueWorkOrderAfterVerifiedOpeningPayment(supabase,organisationId,projectId);
    if(result.status!=='queued')throw new Error(result.reason||'Work Order issuance remains blocked by missing governed evidence.');
    revalidatePath('/opos-next/projects/'+projectId);
    revalidatePath(target);
    params='success='+encodeURIComponent('The original payment-triggered Work Order handoff was retried; partner notification is queued, not yet proven delivered.');
  }catch(error){
    params='error='+encodeURIComponent(error instanceof Error?error.message:'Work Order release was blocked.');
  }
  redirect(target+'?'+params);
}
