import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import RecordWorkspace from '@/components/workspace/RecordWorkspace';
import AcquisitionTechnicalBrief from '@/components/workspace/AcquisitionTechnicalBrief';
import Step2TestLink from '@/components/workspace/Step2TestLink';
import AcquisitionPartnerGate from '@/components/workspace/AcquisitionPartnerGate';
import { acquisitionStages, resolveAcquisitionState } from '@/lib/acquisition/state';
import { resolveAcquisitionPresentation } from '@/lib/presentation/operatingState';
import { operatorErrorMessage } from '@/lib/workspace/operatorErrors';
import { convertProspectFormAction, createStep2InvitationFormAction } from '../actions';
import { generateStep2TestLinkFormAction } from '../test-link-actions';

function dateTime(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not yet';
}
function display(value: unknown, fallback='Not recorded') { return value === null || value === undefined || value === '' ? fallback : String(value); }
function Fact({label,value}:{label:string;value:React.ReactNode}){return <div className="vp-fact"><small>{label}</small><strong>{value??'Not recorded'}</strong></div>}

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
    {query.created||query.qualified||query.partnerReviewCreated||query.partnerDecision?<div className="vp-callout"><strong>Acquisition record updated</strong><p>{query.partnerReviewCreated?'Partner assessment sent.':query.partnerDecision?`Go / No-Go decision: ${String(query.partnerDecision).replaceAll('_',' ')}.`:display(query.created||query.qualified)}</p></div>:null}
    {query.error?<div className="vp-callout"><strong>Action could not be completed</strong><p>{operatorErrorMessage(String(query.error))}</p></div>:null}
    {canUseDeveloperLink&&invitationUrl?<Step2TestLink url={invitationUrl}/>:null}
  </>;

  const header=<div style={{display:'flex',justifyContent:'space-between',gap:24,width:'100%',alignItems:'flex-start',flexWrap:'wrap'}}><div><Link href="/workspace/acquisition">← Back to enquiries</Link><p className="vp-kicker">Enquiry · {id.slice(0,8).toUpperCase()}</p><h1>{prospect.company_name}</h1><p className="vp-subtitle">{[prospect.contact_name,prospect.job_title].filter(Boolean).join(' · ')||'Contact not recorded'}</p></div></div>;

  const stateStrip=<div><div style={{display:'grid',gridTemplateColumns:`repeat(${acquisitionStages.length},minmax(0,1fr))`,gap:8}}>{acquisitionStages.map((label,index)=><div key={label} style={{padding:'10px 12px',borderTop:`2px solid ${index===acquisition.stageIndex?'var(--op-accent)':index<acquisition.stageIndex?'rgba(255,255,255,.38)':'var(--op-line)'}`,opacity:index>acquisition.stageIndex?.55:1}}><small style={{display:'block',color:'var(--op-muted)'}}>{index<acquisition.stageIndex?'Complete':index===acquisition.stageIndex?'Current':'Future'}</small><strong>{label}</strong></div>)}</div><p style={{margin:'14px 0 0',color:'var(--op-muted)'}}>{presentation.summary}</p></div>;

  const readiness=<div className="vp-facts"><Fact label="Customer intake" value={acquisition.readiness.technicalIntake}/><Fact label="Submission" value={acquisition.readiness.technicalSubmission}/><Fact label="Partner assessment" value={acquisition.readiness.partnerReview}/><Fact label="Partner price" value={acquisition.readiness.partnerPricing}/><Fact label="Go / No-Go" value={acquisition.readiness.approval}/><Fact label="Lifecycle" value={acquisition.readiness.qualification}/></div>;

  const partnerGate=<AcquisitionPartnerGate prospectId={id} intakeSessionId={session?.id||''} scopeSummary={String(submission?.description||prospect.requirement_summary||'Engineering requirement')} partners={partners} request={partnerRequest} response={response} quote={partnerQuote} decision={decision} reviewUrl={canUseDeveloperLink?reviewUrl:undefined}/>;
  const nextActionPanel=<div><p className="vp-kicker">Action controls</p><h2 style={{marginTop:6}}>{presentation.nextAction.label}</h2><p>{presentation.nextAction.reason}</p>
    {acquisition.actionKey==='create_intake'?<form action={createStep2InvitationFormAction}><input type="hidden" name="prospect_id" value={id}/><button className="button">Create technical intake</button></form>:null}
    {['request_partner','wait_partner','review_partner_response','resolve_clarification'].includes(acquisition.actionKey)?partnerGate:null}
    {acquisition.actionKey==='wait_customer'?<div className="vp-callout"><strong>Waiting on client</strong><p>The technical intake is live. No internal decision is required until the client submits it.</p>{canUseDeveloperLink?<form action={generateStep2TestLinkFormAction} style={{marginTop:12}}><input type="hidden" name="prospect_id" value={id}/><button className="button secondary">Generate technical intake test link</button></form>:null}</div>:null}
    {acquisition.actionKey==='create_case'?<form action={convertProspectFormAction}><input type="hidden" name="prospect_id" value={id}/><button className="button">Create Case 360</button></form>:null}
    {acquisition.actionKey==='open_case'?(convertedCaseId?<Link className="button" href={`/workspace/leads/${convertedCaseId}`}>Open Case 360</Link>:<Link className="button secondary" href="/workspace/leads">Open Cases</Link>):null}
    {acquisition.actionKey==='closed'?<div className="vp-callout"><strong>Enquiry closed</strong><p>This opportunity has a governed No-Go outcome. It cannot progress to Case 360.</p></div>:null}
  </div>;

  const summary=<div className="vp-facts"><Fact label="Source" value={prospect.source}/><Fact label="Initial requirement" value={prospect.requirement_summary}/>{partnerRequest?.partner?.company_name?<Fact label="Execution Partner" value={partnerRequest.partner.company_name}/>:null}{partnerQuote?<Fact label="Partner price" value={`${partnerQuote.currency} ${Number(partnerQuote.price).toFixed(2)}`}/>:null}</div>;
  const evidence=<div style={{display:'grid',gap:20}}>{submission?<AcquisitionTechnicalBrief submission={submission}/>:<div className="vp-empty">No technical submission exists yet.</div>}{intakeFiles.length?<div><p className="vp-kicker">Client source evidence</p>{intakeFiles.map((file:any)=><div key={file.id} className="project-os-history-row"><span>↳</span><div><strong>{file.original_filename}</strong><small>{Math.max(1,Math.round(Number(file.size_bytes||0)/1024))} KB · {dateTime(file.uploaded_at)}</small></div></div>)}</div>:null}{response?<div className="vp-callout"><strong>Partner evidence received</strong><p>{response.reviewer_name}{response.reviewer_role?` · ${response.reviewer_role}`:''} · {String(response.feasibility).replaceAll('_',' ')} · {response.confidence_percent}% confidence.</p></div>:null}</div>;
  const activities=<div className="vp-facts"><Fact label="Intake sent" value={dateTime(session?.sent_at)}/><Fact label="Client submitted" value={dateTime(session?.submitted_at)}/><Fact label="Partner assessment sent" value={dateTime(partnerRequest?.sent_at)}/><Fact label="Partner responded" value={dateTime(partnerRequest?.submitted_at)}/><Fact label="Partner response due" value={dateTime(partnerRequest?.response_due_at)}/></div>;
  const communications=<div><p style={{color:'var(--op-muted)',lineHeight:1.6}}>Client intake and Partner assessment remain owned by Acquisition until Go / No-Go permits Case 360 creation.</p>{prospect.company_id?<Link className="button secondary" href={`/workspace/companies/${prospect.company_id}`}>Open company record</Link>:null}</div>;
  const history=<div>{events.length===0?<p>No enquiry audit events recorded yet.</p>:events.slice(0,16).map((event:any)=><div className="project-os-history-row" key={event.id}><span>→</span><div><strong>{String(event.event_type).replaceAll('_',' ').replaceAll('.',' ')}</strong><small>{dateTime(event.created_at)}</small></div></div>)}</div>;
  const metadata=<div className="vp-facts"><Fact label="Enquiry ID" value={prospect.id}/><Fact label="Created" value={dateTime(prospect.created_at)}/><Fact label="Updated" value={dateTime(prospect.updated_at)}/><Fact label="Partner assessment ref" value={partnerRequest?.case_reference}/><Fact label="Partner price" value={partnerQuote?`${partnerQuote.currency} ${Number(partnerQuote.price).toFixed(2)}`:'Not received'}/></div>;
  const audit=<p style={{color:'var(--op-muted)',lineHeight:1.6}}>The client submission, Partner response, Partner price, Go / No-Go decision and Case conversion are separate governed events. Case 360 cannot become active until the Acquisition gates are satisfied.</p>;

  return <RecordWorkspace header={header} notices={notices} stateStrip={stateStrip} presentation={presentation} readiness={readiness} nextAction={nextActionPanel} summary={summary} evidence={evidence} activities={activities} communications={communications} history={history} metadata={metadata} audit={audit}/>;
}