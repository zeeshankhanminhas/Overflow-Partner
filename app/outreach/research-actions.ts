'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {researchGaps, type OutreachResearch} from '@/lib/outreach/research';

function textValue(form:FormData,name:string,max:number){
 const value=String(form.get(name)||'').trim();
 if(value.length>max)throw Error(name.replaceAll('_',' ')+' exceeds '+max+' characters.');
 return value;
}
function dateValue(form:FormData,name:string){
 const value=textValue(form,name,10);
 if(value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Enter a valid date.');
 return value||null;
}
function verifiedURL(input:string){
 if(!input)return null;
 let url:URL;
 try{url=new URL(input)}catch{throw Error('Enter a valid source URL.')}
 if(url.protocol!=='https:'||url.username||url.password||!url.hostname||url.href.length>1500)
  throw Error('Evidence URL must be a valid HTTPS website without embedded credentials.');
 return url.toString();
}

/** Save evidence and record an explicit reviewer decision. This does not send
 * an outreach message, mark a prospect contacted, or create a CRM record. */
export async function saveOutreachResearchAction(form:FormData){
 const id=String(form.get('outreach_id')||'').trim();
 let target='/outreach';
 try{
  const {supabase,user,profile,organisationId}=await requireUserContext();
  assertRole(profile.role,['owner','admin','business_development','operator']);
  if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid outreach record.');
  const {data:thread,error:threadError}=await supabase.from('linkedin_outreach_threads')
   .select('id,state').eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(threadError||!thread)throw Error('Outreach record not available.');
  if(thread.state==='converted')throw Error('This record has entered CRM and its outreach research is read-only.');

  const review_action=textValue(form,'review_action',16);
  if(!['save','approve','reject','block'].includes(review_action))throw Error('Invalid review decision.');
  const confidence=textValue(form,'confidence',24);
  const evidence_state=textValue(form,'evidence_state',16);
  if(!['unverified','inferred','directly_confirmed'].includes(confidence) ||
     !['missing','tentative','evidenced'].includes(evidence_state))
    throw Error('Choose a valid confidence and evidence status.');
  const review_status=review_action==='approve'?'approved':review_action==='reject'?'rejected':
    review_action==='block'?'blocked':'pending';
  const record={
   evidence_description:textValue(form,'evidence_description',4000),
   engineering_evidence:textValue(form,'engineering_evidence',4000),
   decision_maker_evidence:textValue(form,'decision_maker_evidence',2000),
   workload_pressure_signal:textValue(form,'workload_pressure_signal',4000),
   source_url:verifiedURL(textValue(form,'source_url',1500)),
   observed_on:dateValue(form,'observed_on'),
   confidence:confidence as OutreachResearch['confidence'],
   evidence_state:evidence_state as OutreachResearch['evidence_state'],
   review_status,
   review_reason:textValue(form,'review_reason',2000),
   next_action:textValue(form,'next_action',1000),
   next_action_date:dateValue(form,'next_action_date'),
   approved_at:review_status==='approved'?new Date().toISOString():null,
   approved_by:review_status==='approved'?user.id:null,
   updated_at:new Date().toISOString(),
  };
  if(record.observed_on && record.observed_on>new Date().toISOString().slice(0,10))
    throw Error('Observation date cannot be in the future.');
  if(review_status==='approved'){
   const gaps=researchGaps(record);
   if(gaps.length)throw Error('Cannot approve first contact: '+gaps.join('; ')+'.');
  }
  if(['rejected','blocked'].includes(review_status)&&record.review_reason.length<8)
   throw Error('Record the reason for blocking or rejecting this prospect.');
  const {data:existing,error:existingError}=await supabase.from('linkedin_outreach_research')
    .select('outreach_id').eq('organisation_id',organisationId).eq('outreach_id',id).maybeSingle();
  if(existingError)throw Error('Research access is unavailable. Confirm the new migration is applied.');
  const operation=existing?
    supabase.from('linkedin_outreach_research').update(record)
      .eq('outreach_id',id).eq('organisation_id',organisationId):
    supabase.from('linkedin_outreach_research').insert({
      ...record,organisation_id:organisationId,outreach_id:id,researched_by:user.id
    });
  const {error}=await operation;
  if(error)throw Error(error.message);
  revalidatePath('/outreach');revalidatePath('/outreach/'+id);
  target='/outreach/'+id+'?updated='+encodeURIComponent(
    review_status==='approved'?'Approved for manual first contact. No message was sent.':
    review_status==='pending'?'Research saved for review. No message was sent.':
    'Research decision recorded. No message was sent.');
 }catch(e){
  target='/outreach/'+encodeURIComponent(id)+'?error='+encodeURIComponent(
    e instanceof Error?e.message:'Unable to save research.');
 }
 redirect(target);
}
