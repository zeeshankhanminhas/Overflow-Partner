'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaFixtureBackend} from '@/lib/qa/isolation';

export async function scheduleQaAccountReviewAction(form:FormData){
 const id=String(form.get('company_id')||'');
 const base='/opos-next/accounts/'+encodeURIComponent(id);
 let destination=base;
 try{
   assertIsolatedQaFixtureBackend();
   if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid company record.');
   const date=String(form.get('next_review_date')||'');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Choose a valid next review date.');
   const next=new Date(date+'T12:00:00Z');
   if(!Number.isFinite(next.getTime())||next.toISOString().slice(0,10)!==date||next.getTime()<Date.now()-86400000||next.getTime()>Date.now()+366*86400000)
     throw new Error('Next review must be within the coming year.');
   const {supabase,user,organisationId,profile}=await requireUserContext('/opos-next');
   assertRole(profile.role,['owner','admin','operator','business_development']);
   const {data:company,error:readError}=await supabase.from('companies')
     .select('id,name,next_account_review_at').eq('organisation_id',organisationId).eq('id',id).maybeSingle();
   if(readError||!company)throw new Error('Account not found.');
   if(!company.name.startsWith('QA - '))throw new Error('Only fictional QA accounts may be rescheduled here.');
   const {error}=await supabase.from('companies').update({next_account_review_at:next.toISOString(),updated_at:new Date().toISOString()})
     .eq('organisation_id',organisationId).eq('id',id);
   if(error)throw new Error(error.message);
   const {error:auditError}=await supabase.from('activity_events').insert({organisation_id:organisationId,entity_type:'company',entity_id:id,user_id:user.id,event_type:'qa.account_review_rescheduled',event_data:{previousReviewAt:company.next_account_review_at,nextReviewAt:next.toISOString()}});
   if(auditError)throw new Error('Review date updated but audit evidence could not be saved: '+auditError.message);
   revalidatePath(base);revalidatePath('/opos-next');
   destination=base+'?updated='+encodeURIComponent('Next QA account review scheduled.');
 }catch(e){destination=base+'?error='+encodeURIComponent(e instanceof Error?e.message:'Unable to schedule review.');}
 redirect(destination);
}
