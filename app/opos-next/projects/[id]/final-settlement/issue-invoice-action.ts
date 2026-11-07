'use server';

import {redirect} from 'next/navigation';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

export async function issueQaFinalInvoice(formData:FormData){
  assertIsolatedQaBackend();
  const id=String(formData.get('project_id')||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Valid project reference required.');
  const {supabase,profile,organisationId}=await requireUserContext('/opos-next');
  assertRole(profile.role,['owner','admin','commercial']);
  const {data:project,error:projectError}=await supabase.from('projects')
    .select('id').eq('id',id).eq('organisation_id',organisationId).maybeSingle();
  if(projectError||!project)throw new Error('This project is not available to your organisation.');
  const {data,error}=await supabase.rpc('op_qa_issue_final_invoice',{p_project_id:id});
  if(error||!data?.id)throw new Error('Final invoice could not be issued: '+String(error?.message||'The commercial checks did not pass.'));
  redirect('/opos-next/projects/'+id+'/final-settlement?invoice=issued');
}
