import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {OperatorRecord} from '../../OperatorViews';
export default async function OutreachThreadPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('linkedin_outreach_threads')
    .select('id,company_name,contact_name,state,job_title,next_follow_up_at,crm_prospect_id')
    .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(error)throw new Error('Outreach conversation could not be loaded.');if(!data)notFound();
  const state=String(data.state||'identified');
  const waiting=state==='waiting'||state==='followup';
  const label=state==='interested'?'Interest confirmed — eligible for CRM':
    state==='converted'?'Conversation handed over to CRM':
    state==='waiting'?'Waiting for a LinkedIn reply':
    state==='followup'?'Follow-up planned':state==='closed'?'Conversation closed':'Conversation not yet qualified';
  const desc=state==='interested'
    ? 'The prospect has confirmed interest. A controlled CRM handoff is now eligible.'
    : state==='converted'
      ? 'This conversation has moved into the governed Opportunity lifecycle.'
      : waiting
        ? 'Continue the personal LinkedIn conversation at the appropriate time. Do not invite technical intake without expressed interest.'
        : 'Record and qualify the conversation before creating any customer requirements invitation.';
  return <OperatorRecord eyebrow="OUTREACH / CONVERSATION" title={data.company_name}
    position={label} description={desc}
    fields={[{label:'Person',value:data.contact_name},{label:'Position',value:data.job_title||'Not recorded'},
      {label:'Conversation state',value:state},{label:'Follow-up',value:data.next_follow_up_at?new Date(data.next_follow_up_at).toLocaleDateString('en-GB'):'Not scheduled'}]}
    previous="/opos-next/outreach" governedHref={'/outreach/'+id} governedLabel="Continue LinkedIn conversation"
    waiting={waiting}/>;
}
