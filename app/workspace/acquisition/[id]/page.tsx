import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import RecordWorkspace from '@/components/workspace/RecordWorkspace';
import AcquisitionTechnicalBrief from '@/components/workspace/AcquisitionTechnicalBrief';
import Step2TestLink from '@/components/workspace/Step2TestLink';
import AcquisitionPartnerGate from '@/components/workspace/AcquisitionPartnerGate';
import { acquisitionStages, resolveAcquisitionState } from '@/lib/acquisition/state';
import { resolveAcquisitionPresentation } from '@/lib/presentation/operatingState';
import { commercialCopy, commercialStatus } from '@/lib/presentation/commercialLanguage';
import { operatorErrorMessage } from '@/lib/workspace/operatorErrors';
import { DecisionDialog } from '@/components/workspace/InteractionSurface';
import { convertProspectFormAction, createStep2InvitationFormAction, updateProspectWorkingStatusFormAction } from '../actions';
import { generateStep2TestLinkFormAction } from '../test-link-actions';
import ProspectOutreachTools from '@/components/workspace/ProspectOutreachTools';
import { updateProspectOutreachAction } from '../actions';

function dateTime(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not yet';
}
function display(value: unknown, fallback='Not recorded') { return value === null || value === undefined || value === '' ? fallback : String(value); }
function Fact({label,value}:{label:string;value:React.ReactNode}){return <div className="vp-fact"><small>{label}</small><strong>{value??'Not recorded'}</strong></div>}

const opportunityStageLabel=(label:string)=>commercialCopy(label)
  .replace('Technical intake','Requirements')
  .replace('Partner review','Delivery review')
  .replace('Partner assessment','Delivery review')
  .replace('Qualification','Commercial decision');

export default async function AcquisitionRecordPage({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const {id}=await params;const query=searchParams?await searchParams:{};const {supabase,organisationId,profile}=await requireUserContext();
  const [prospectResult,sessionResult,activityResult,partnerRequestResult,partnersResult]=await Promise.all([
    supabase.from('prospects').select('*').eq('organisation_id',organisationId).eq('id',id).maybeSingle(),
    supabase.from('intake_sessions').select('*').eq('organisation_id',organisationId).eq('prospect_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('activity_events').select('*').eq('organisation_id',organisationId).eq('entity_type','prospect').eq('entity_id',id).order('created_at',{ascending:false}).limit(30),
    supabase.from('partner_review_requests').select('*,partner:partners(company_name)').eq('organisation_id',organisationId).eq('prospect_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('partners').select('id,company_name,rating,email').eq('organisation_id',organisationId).eq('status','approved').eq('nda_signed',true).order('company_name'),
  ]);
  const prospect=prospectResult.data;if(!prospect)notFound();
  const session=sessionResult.data;const partnerRequest:any=partnerRequestResult.data;const partners:any[]=(partnersResult.data||[]) as any[];
  let submission:any=null;let response:any=null;let decision:any=null;let partnerQuote:any=null;let intakeFiles:any[]=[];
  if(session?.id){
    const [submissionResult,filesResult]=await Promise.all([
      supabase.from('intake_submissions').select('*').eq('organisation_id',organisationId).eq('intake_session_id',session.id).maybeSingle(),
      supabase.from('intake_files').select('id,original_filename,size_bytes,file_category,uploaded_at').eq('organisation_id',organisationId).eq('intake_session_id',session.id).order('uploaded_at'),
    ]);
    submission=submissionResult.data;intakeFiles=filesResult.data||[];
  }
  if(partnerRequest?.id){
    const [responseResult,decisionResult,quoteResult]=await Promise.all([
      supabase.from('partner_review_responses').select('*').eq('organisation_id',organisationId).eq('partner_review_request_id',partnerRequest.id).order('revision',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('partner_review_internal_decisions').select('*').eq('organisation_id',organisationId).eq('partner_review_request_id',partnerRequest.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('partner_quotes').select('*').eq('organisation_id',organisationId).eq('partner_review_request_id',partnerRequest.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    ]);
    response=responseResult.data;decision=decisionResult.data;partnerQuote=quoteResult.data;
  }
  const events=activityResult.data??[];const convertedCaseId=String(prospect.converted_lead_id||'');
  const acquisition=resolveAcquisitionState({
    prospectStatus:prospect.status,hasSession:Boolean(session),sessionStatus:session?.status,hasSubmission:Boolean(submission),convertedCaseId,
    hasPartnerRequest:Boolean(partnerRequest),partnerRequestStatus:partnerRequest?.status,hasPartnerResponse:Boolean(response),partnerDecision:decision?.decision,hasPartnerPricing:Boolean(partnerQuote&&Number(partnerQuote.price)>0),
  });
  const presentation=resolveAcquisitionPresentation(acquisition);
  const rawInvitation=Array.isArray(query.invitation)?query.invitation[0]:query.invitation;
  const invitationUrl=typeof rawInvitation==='string'&&/^https?:\/\//.test(rawInvitation)?rawInvitation:'';
  const rawReviewUrl=Array.isArray(query.reviewUrl)?query.reviewUrl[0]:query.reviewUrl;
  const reviewUrl=typeof rawReviewUrl==='string'&&/^https?:\/\//.test(rawReviewUrl)?rawReviewUrl:'';
  const canUseDeveloperLink=['owner','admin'].includes(String(profile.role));

  const notices=<>
    {query.created||query.updated||query.qualified||query.partnerReviewCreated||query.partnerDecision?<div className="vp-callout"><strong>Opportunity updated</strong><p>{query.partnerReviewCreated?'Delivery review sent.':query.partnerDecision?`Commercial decision: ${commercialStatus(String(query.partnerDecision),commercialCopy(String(query.partnerDecision)))}.`:display(query.created||query.updated||query.qualified)}</p></div>:null}
    {query.error?<div className="vp-callout"><strong>Action could not be completed</strong><p>{operatorErrorMessage(String(query.error))}</p></div>:null}
    {invitationUrl?<Step2TestLink url={invitationUrl} outreach/>:null}
  </>;

  const header=<div style={{display:'flex',justifyContent:'space-between',gap:24,width:'100%',alignItems:'flex-start',flexWrap:'wrap'}}><div><Link href="/workspace/acquisition">← Back to opportunities</Link><p className="vp-kicker">Opportunity · {id.slice(0,8).toUpperCase()}</p><h1>{prospect.company_name}</h1><p className="vp-subtitle">{[prospect.contact_name,prospect.job_title].filter(Boolean).join(' · ')||'Contact not recorded'}</p><div className="project-os-meta"><span>{commercialCopy(presentation.state)}</span>{presentation.waitingOn?<span>{presentation.waitingOn.actor==='partner'?'Waiting for delivery partner':presentation.waitingOn.actor==='client'?'Waiting for client':'With your team'} · {commercialCopy(presentation.waitingOn.label)}</span>:null}</div></div><span className="vp-status">{commercialStatus(prospect.status,commercialCopy(presentation.state))}</span></div>;

  const stateStrip=<div><div className="opportunity-stage-strip" style={{display:'grid',gridTemplateColumns:`repeat(${acquisitionStages.length},minmax(0,1fr))`,gap:8}}>{acquisitionStages.map((label,index)=><div key={label} className="opportunity-stage-step" style={{padding:'10px 12px',borderTop:`2px solid ${index===acquisition.stageIndex?'var(--op-accent)':index<acquisition.stageIndex?'rgba(255,255,255,.38)':'var(--op-line)'}`,opacity:index>acquisition.stageIndex?.55:1}}><small style={{display:'block',color:'var(--op-muted)'}}>{index<acquisition.stageIndex?'Complete':index===acquisition.stageIndex?'Current':'Next'}</small><strong>{opportunityStageLabel(label)}</strong></div>)}</div><p style={{margin:'14px 0 0',color:'var(--op-muted)'}}>{commercialCopy(presentation.summary)}</p></div>;

  const readiness=<div className="vp-facts"><Fact label="Requirements" value={acquisition.readiness.technicalIntake}/><Fact label="Client submission" value={acquisition.readiness.technicalSubmission}/><Fact label="Delivery review" value={acquisition.readiness.partnerReview}/><Fact label="Partner cost" value={acquisition.readiness.partnerPricing}/><Fact label="Commercial decision" value={acquisition.readiness.approval}/><Fact label="Ready to progress" value={acquisition.readiness.qualification}/></div>;

  const partnerGate=<AcquisitionPartnerGate prospectId={id} intakeSessionId={session?.id||''} scopeSummary={String(submission?.description||prospect.requirement_summary||'Engineering requirement')} partners={partners} request={partnerRequest} response={response} quote={partnerQuote} decision={decision} reviewUrl={canUseDeveloperLink?reviewUrl:undefined}/>;
  const canEditWorkingStatus=['identified','contacted','conversation','not_a_fit'].includes(String(prospect.status))&&!convertedCaseId;
  const statusControl=canEditWorkingStatus?<DecisionDialog triggerLabel="Update opportunity status" triggerClassName="button secondary" eyebrow="Opportunity control" title="Update opportunity status" description="Manage early commercial engagement without bypassing technical qualification or Case conversion."><form action={updateProspectWorkingStatusFormAction} className="stack"><input type="hidden" name="prospect_id" value={id}/><label>Status<select name="status" defaultValue={prospect.status} required><option value="identified">Identified</option><option value="contacted">Contacted</option><option value="conversation">In conversation</option><option value="not_a_fit">Not a fit</option></select></label><label>Reason<textarea name="reason" rows={3} placeholder="Required when closing or reopening an opportunity"/></label><div className="product-notice"><strong>Governed boundaries</strong><div>Qualified status remains controlled by the approved Go / No-Go decision. Converted status remains controlled by Case 360 creation.</div></div><button className="button" type="submit">Save status</button></form></DecisionDialog>:null;
  const nextActionPanel=<div><p className="vp-kicker">Next action</p><h2 style={{marginTop:6}}>{commercialCopy(presentation.nextAction.label)}</h2><p>{commercialCopy(presentation.nextAction.reason)}</p>
    {acquisition.actionKey==='create_intake'?<form action={createStep2InvitationFormAction}><input type="hidden" name="prospect_id" value={id}/><button className="button">Create requirements request</button></form>:null}
    {['request_partner','wait_partner','review_partner_response','resolve_clarification'].includes(acquisition.actionKey)?partnerGate:null}
    {acquisition.actionKey==='wait_customer'?<div className="vp-callout"><strong>Waiting for client</strong><p>The requirements request is live. No internal decision is required until the client submits it.</p>{canUseDeveloperLink?<form action={generateStep2TestLinkFormAction} style={{marginTop:12}}><input type="hidden" name="prospect_id" value={id}/><button className="button secondary">Generate requirements test link</button></form>:null}</div>:null}
    {acquisition.actionKey==='create_case'?<form action={convertProspectFormAction}><input type="hidden" name="prospect_id" value={id}/><button className="button">Progress opportunity</button></form>:null}
    {acquisition.actionKey==='open_case'?(convertedCaseId?<Link className="button" href={`/workspace/leads/${convertedCaseId}`}>Open commercial workspace</Link>:<Link className="button secondary" href="/workspace/leads">Open opportunities</Link>):null}
    {acquisition.actionKey==='closed'?<div className="vp-callout"><strong>Opportunity declined</strong><p>This opportunity will not progress to commercial preparation or delivery.</p></div>:null}
    {statusControl}
  </div>;

  const summary=<div className="vp-facts"><Fact label="Client" value={prospect.company_name}/><Fact label="Primary contact" value={prospect.contact_name}/><Fact label="Role" value={prospect.job_title}/><Fact label="Source" value={prospect.source}/><Fact label="Requirement" value={prospect.requirement_summary}/><Fact label="Status" value={commercialStatus(prospect.status,commercialCopy(display(prospect.status)))}/></div>;
  const evidence=<div style={{display:'grid',gap:20}}>{submission?<AcquisitionTechnicalBrief submission={submission}/>:<div className="vp-empty">No requirements have been submitted yet.</div>}{intakeFiles.length?<div><p className="vp-kicker">Client files</p>{intakeFiles.map((file:any)=><div key={file.id} className="project-os-history-row"><span>↳</span><div><strong>{file.original_filename}</strong><small>{Math.max(1,Math.round(Number(file.size_bytes||0)/1024))} KB · {dateTime(file.uploaded_at)}</small></div></div>)}</div>:null}{response?<div className="vp-callout"><strong>Delivery partner response received</strong><p>{response.reviewer_name}{response.reviewer_role?` · ${response.reviewer_role}`:''} · {commercialStatus(response.feasibility,commercialCopy(response.feasibility))} · {response.confidence_percent}% confidence.</p></div>:null}</div>;
  const activities=<div className="vp-facts"><Fact label="Requirements sent" value={dateTime(session?.sent_at)}/><Fact label="Client submitted" value={dateTime(session?.submitted_at)}/><Fact label="Delivery review sent" value={dateTime(partnerRequest?.sent_at)}/><Fact label="Partner responded" value={dateTime(partnerRequest?.submitted_at)}/><Fact label="Response due" value={dateTime(partnerRequest?.response_due_at)}/></div>;
  const approvedMessage=`Hello${prospect.contact_name?` ${String(prospect.contact_name).split(' ')[0]}`:''}, I help engineering teams add dependable CAD and technical delivery capacity when internal workload is constrained. I would be glad to understand whether ${prospect.company_name} ever uses external support for overflow work.`;
  const outreachStatus=String(prospect.outreach_status||'not_contacted');
  const communications=<div className="outreach-panel"><p style={{color:'var(--op-muted)',lineHeight:1.6}}>Run the LinkedIn conversation here while LinkedIn remains the sending channel. Outreach progress is separate from technical and commercial qualification.</p><ProspectOutreachTools linkedinUrl={prospect.linkedin_url} message={approvedMessage}/><div className="outreach-message"><small>Approved opening message</small><p>{approvedMessage}</p></div><form action={updateProspectOutreachAction} className="stack"><input type="hidden" name="prospect_id" value={id}/><label>Outreach action<select name="outreach_status" defaultValue={outreachStatus}><option value="not_contacted">Not contacted</option><option value="message_sent">Mark message sent</option><option value="follow_up_due">Set follow-up</option><option value="replied">Record reply</option><option value="no_response">No response</option><option value="paused">Pause outreach</option></select></label><label>Reply outcome<select name="response_outcome" defaultValue={prospect.response_outcome||''}><option value="">Not applicable</option><option value="interested">Interested</option><option value="later">Possible later requirement</option><option value="referred">Referred internally</option><option value="not_interested">Not interested</option><option value="no_response">No response</option></select></label><label>Next follow-up<input type="datetime-local" name="next_follow_up_at" defaultValue={prospect.next_follow_up_at?new Date(prospect.next_follow_up_at).toISOString().slice(0,16):''}/></label><label>Conversation note<textarea name="outreach_note" rows={3} placeholder="Record the commercial substance of the reply or follow-up"/></label><button className="button" type="submit">Record outreach</button></form>{acquisition.actionKey==='create_intake'?<form action={createStep2InvitationFormAction}><input type="hidden" name="prospect_id" value={id}/><button className="button secondary">Create and copy secure link</button></form>:<div className="product-notice"><strong>Secure intake</strong><div>{session?'A requirements request already exists. For security, its raw link is not retained after creation.':'The secure link becomes available when this opportunity is ready for requirements intake.'}</div></div>}{prospect.company_id?<Link className="button secondary" href={`/workspace/companies/${prospect.company_id}`}>Open client account</Link>:null}</div>;
  const history=<div>{events.length===0?<p>No opportunity activity recorded yet.</p>:events.slice(0,16).map((event:any)=><div className="project-os-history-row" key={event.id}><span>→</span><div><strong>{commercialCopy(String(event.event_type).replaceAll('_',' ').replaceAll('.',' '))}</strong><small>{dateTime(event.created_at)}</small></div></div>)}</div>;
  const metadata=<div className="vp-facts"><Fact label="Opportunity ID" value={prospect.id}/><Fact label="Created" value={dateTime(prospect.created_at)}/><Fact label="Updated" value={dateTime(prospect.updated_at)}/><Fact label="Delivery review ref" value={partnerRequest?.case_reference}/><Fact label="Partner cost" value={partnerQuote?`${partnerQuote.currency} ${Number(partnerQuote.price).toFixed(2)}`:'Not received'}/></div>;
  const audit=<p style={{color:'var(--op-muted)',lineHeight:1.6}}>Client submission, delivery-partner response, partner cost and the commercial decision remain separately recorded for traceability. The opportunity can progress only when the required evidence is complete.</p>;

  return <RecordWorkspace className="opportunity-reference-workspace" header={header} notices={notices} stateStrip={stateStrip} presentation={presentation} readiness={readiness} nextAction={nextActionPanel} summary={summary} evidence={evidence} activities={activities} communications={communications} history={history} metadata={metadata} audit={audit}/>;
}
