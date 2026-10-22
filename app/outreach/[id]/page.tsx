import { notFound, redirect } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { canInviteFromLinkedIn, linkedInFunnelStage } from '@/lib/acquisition/linkedinFunnel';
import LinkedInProspectWorkspace from '@/components/workspace/LinkedInProspectWorkspace';
import OutreachConversationJournal from '@/components/workspace/OutreachConversationJournal';
import ProspectConversationPanel from '@/components/workspace/ProspectConversationPanel';

export default async function OutreachConversationPage({
  params,searchParams,
}:{
  params:Promise<{id:string}>;
  searchParams?:Promise<{note?:string;updated?:string;error?:string;created?:string}>;
}) {
  const {id}=await params;
  const query=searchParams?await searchParams:{};
  const {supabase,organisationId,profile}=await requireUserContext();
  const [prospectResult,intakeResult,activityResult]=await Promise.all([
    supabase.from('prospects').select('*').eq('organisation_id',organisationId).eq('id',id).maybeSingle(),
    supabase.from('intake_sessions').select('id').eq('organisation_id',organisationId)
      .eq('prospect_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('activity_events').select('id,event_type,event_data,created_at')
      .eq('organisation_id',organisationId).eq('entity_type','prospect').eq('entity_id',id)
      .order('created_at',{ascending:false}).limit(100),
  ]);
  const prospect=prospectResult.data;
  if(prospectResult.error||!prospect||prospect.source!=='linkedin')notFound();
  if(intakeResult.error||activityResult.error)throw new Error('Unable to load prospect conversation.');

  // A structured technical enquiry belongs to the governed OPOS workspace.
  // Never substitute this lightweight screen for intake, partner review or approval.
  if(intakeResult.data||prospect.converted_lead_id
    ||['qualified','converted'].includes(String(prospect.status))) {
    redirect('/workspace/acquisition/'+id);
  }

  const canWrite=['owner','admin','business_development','operator'].includes(String(profile.role));
  const importerEnabled=canWrite&&process.env.OP_LINKEDIN_CONVERSATION_IMPORT_ENABLED==='true';
  let conversation;
  if(importerEnabled){
    const [messages,imports]=await Promise.all([
      supabase.from('prospect_conversation_messages')
        .select('id,source,speaker,body,sent_at,imported_at,original_order')
        .eq('organisation_id',organisationId).eq('prospect_id',id)
        .order('imported_at',{ascending:true}).order('original_order',{ascending:true}).limit(500),
      supabase.from('prospect_conversation_imports')
        .select('id,source,source_url,original_text,created_at')
        .eq('organisation_id',organisationId).eq('prospect_id',id)
        .order('created_at',{ascending:false}).limit(25),
    ]);
    if(messages.error||imports.error)throw new Error('Conversation archive needs its scoped database migration.');
    conversation=<>
      <ProspectConversationPanel prospectId={id} messages={messages.data||[]} imports={imports.data||[]} canImport={canWrite}/>
      <OutreachConversationJournal prospectId={id} events={activityResult.data||[]} canWrite={false}/>
    </>;
  } else {
    conversation=<OutreachConversationJournal prospectId={id} events={activityResult.data||[]} canWrite={canWrite}/>;
  }
  const stage=linkedInFunnelStage(prospect,false);
  const closed=stage==='closed';
  const interested=canInviteFromLinkedIn(prospect)&&!closed;
  const decision=closed?'closed':interested?'interested':prospect.next_follow_up_at?'followup':'waiting';
  const alert=String(query.note||query.updated||query.error||query.created||'').slice(0,350);
  const approvedMessage=`Hello${prospect.contact_name?' '+String(prospect.contact_name).split(' ')[0]:''}, I help engineering teams add dependable CAD and technical delivery capacity when internal workload is constrained. Would you be open to a brief conversation about whether ${prospect.company_name} ever uses external overflow support?`;
  return <LinkedInProspectWorkspace
    id={id}
    companyName={prospect.company_name}
    contactName={prospect.contact_name}
    jobTitle={prospect.job_title}
    linkedInUrl={prospect.linkedin_url}
    openingMessage={approvedMessage}
    followUpAt={prospect.next_follow_up_at}
    interested={interested}
    closed={closed}
    decision={decision}
    conversation={conversation}
    events={[]}
    notices={alert?<p role="status">{alert}</p>:null}
    canDecide={canWrite}
  />;
}
