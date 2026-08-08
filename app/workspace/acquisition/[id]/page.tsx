import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import RecordWorkspace from '@/components/workspace/RecordWorkspace';
import AcquisitionTechnicalBrief from '@/components/workspace/AcquisitionTechnicalBrief';
import TechnicalPartnerReviewPanel from '@/components/workspace/TechnicalPartnerReviewPanel';
import { acquisitionStages, resolveAcquisitionState } from '@/lib/acquisition/state';
import { operatorErrorMessage } from '@/lib/workspace/operatorErrors';
import { convertProspectFormAction, createStep2InvitationFormAction } from '../actions';

function dateTime(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not yet';
}
function display(value: unknown, fallback='Not recorded') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}
function Fact({label,value}:{label:string;value:React.ReactNode}){return <div className="vp-fact"><small>{label}</small><strong>{value??'Not recorded'}</strong></div>}

export default async function AcquisitionRecordPage({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const {id}=await params;const query=searchParams?await searchParams:{};const {supabase,organisationId}=await requireUserContext();
  const [prospectResult,sessionResult,activityResult]=await Promise.all([
    supabase.from('prospects').select('*').eq('organisation_id',organisationId).eq('id',id).maybeSingle(),
    supabase.from('intake_sessions').select('*').eq('organisation_id',organisationId).eq('prospect_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('activity_events').select('*').eq('organisation_id',organisationId).eq('entity_type','prospect').eq('entity_id',id).order('created_at',{ascending:false}).limit(20),
  ]);
  const prospect=prospectResult.data;if(!prospect)notFound();
  const session=sessionResult.data;
  let submission:any=null;
  if(session?.id){const result=await supabase.from('intake_submissions').select('*').eq('organisation_id',organisationId).eq('intake_session_id',session.id).maybeSingle();submission=result.data;}
  const events=activityResult.data??[];
  const convertedCaseId=String(prospect.converted_lead_id||'');
  const acquisition=resolveAcquisitionState({
    prospectStatus:prospect.status,
    hasSession:Boolean(session),
    sessionStatus:session?.status,
    hasSubmission:Boolean(submission),
    convertedCaseId,
  });

  const notices=<>{query.created||query.technical_review||query.qualified?<div className="vp-callout"><strong>Acquisition record updated</strong><p>{display(query.created||query.technical_review||query.qualified)}</p></div>:null}{query.error?<div className="vp-callout"><strong>Action could not be completed</strong><p>{operatorErrorMessage(String(query.error))}</p></div>:null}</>;

  const header=<div style={{display:'flex',justifyContent:'space-between',gap:24,width:'100%',alignItems:'flex-start',flexWrap:'wrap'}}><div><Link href="/workspace/acquisition">← Back to acquisition</Link><p className="vp-kicker">Acquisition record · {id.slice(0,8).toUpperCase()}</p><h1>{prospect.company_name}</h1><p className="vp-subtitle">{[prospect.contact_name,prospect.job_title].filter(Boolean).join(' · ')||'Contact not recorded'}</p><div className="project-os-meta"><span>Current state · {acquisition.currentState}</span><span>Owner · Internal acquisition</span></div></div><span className="vp-status">{acquisition.currentState}</span></div>;

  const stateStrip=<div><div style={{display:'grid',gridTemplateColumns:`repeat(${acquisitionStages.length},minmax(0,1fr))`,gap:8}}>{acquisitionStages.map((label,index)=><div key={label} style={{padding:'10px 12px',borderTop:`2px solid ${index===acquisition.stageIndex?'var(--op-accent)':index<acquisition.stageIndex?'rgba(255,255,255,.38)':'var(--op-line)'}`,opacity:index>acquisition.stageIndex?.55:1}}><small style={{display:'block',color:'var(--op-muted)'}}>{index<acquisition.stageIndex?'Complete':index===acquisition.stageIndex?'Current':'Future'}</small><strong>{label}</strong></div>)}</div><p style={{margin:'14px 0 0',color:'var(--op-muted)'}}>{acquisition.nextReason}</p></div>;

  const readiness=<div className="vp-facts"><Fact label="Prospect" value={acquisition.readiness.prospect}/><Fact label="Technical intake" value={acquisition.readiness.technicalIntake}/><Fact label="Technical submission" value={acquisition.readiness.technicalSubmission}/><Fact label="Qualification" value={acquisition.readiness.qualification}/></div>;

  const nextActionPanel=<div><h2 style={{marginTop:0}}>{acquisition.nextAction}</h2><p>{acquisition.nextReason}</p>
    {acquisition.actionKey==='create_intake'?<form action={createStep2InvitationFormAction}><input type="hidden" name="prospect_id" value={id}/><button className="button">Create technical intake</button></form>:null}
    {acquisition.actionKey==='review_submission'&&session?<TechnicalPartnerReviewPanel prospectId={id} intakeSessionId={session.id} prospectStatus={String(prospect.status||'new')}/>:null}
    {acquisition.actionKey==='create_case'?<form action={convertProspectFormAction}><input type="hidden" name="prospect_id" value={id}/><button className="button">Create governed Case 360</button></form>:null}
    {acquisition.actionKey==='wait_customer'?<div className="vp-callout"><strong>Waiting on customer</strong><p>No internal decision is required until the technical intake is submitted.</p></div>:null}
    {acquisition.actionKey==='open_case'?(convertedCaseId?<Link className="button" href={`/workspace/leads/${convertedCaseId}`}>Open Case 360</Link>:<Link className="button secondary" href="/workspace/leads">Open Cases</Link>):null}
  </div>;

  const summary=<div className="vp-facts"><Fact label="Company" value={prospect.company_name}/><Fact label="Contact" value={prospect.contact_name}/><Fact label="Job title" value={prospect.job_title}/><Fact label="Source" value={prospect.source}/><Fact label="Initial requirement" value={prospect.requirement_summary}/><Fact label="Prospect status" value={display(prospect.status).replaceAll('_',' ')}/></div>;

  const evidence=submission?<AcquisitionTechnicalBrief submission={submission}/>:<div className="vp-empty">No technical submission exists yet.</div>;
  const activities=<div className="vp-facts"><Fact label="Intake sent" value={dateTime(session?.sent_at)}/><Fact label="Opened" value={dateTime(session?.opened_at)}/><Fact label="Submitted" value={dateTime(session?.submitted_at)}/><Fact label="Expires" value={dateTime(session?.expires_at)}/><Fact label="Next movement" value={prospect.next_action}/></div>;
  const communications=<div><p style={{color:'var(--op-muted)',lineHeight:1.6}}>Acquisition communication stays with the prospect/company context until a governed Case is created.</p>{prospect.company_id?<Link className="button secondary" href={`/workspace/companies/${prospect.company_id}`}>Open company record</Link>:null}</div>;
  const history=<div>{events.length===0?<p>No prospect audit events recorded yet.</p>:events.slice(0,12).map((event:any)=><div className="project-os-history-row" key={event.id}><span>→</span><div><strong>{String(event.event_type).replaceAll('_',' ').replaceAll('.',' ')}</strong><small>{dateTime(event.created_at)}</small></div></div>)}</div>;
  const metadata=<div className="vp-facts"><Fact label="Prospect ID" value={prospect.id}/><Fact label="Created" value={dateTime(prospect.created_at)}/><Fact label="Updated" value={dateTime(prospect.updated_at)}/><Fact label="Source" value={prospect.source}/></div>;
  const audit=<p style={{color:'var(--op-muted)',lineHeight:1.6}}>Intake issuance, submission, review and conversion remain separate governed events. Browsing this record does not advance its business state.</p>;

  return <RecordWorkspace header={header} notices={notices} stateStrip={stateStrip} readiness={readiness} nextAction={nextActionPanel} summary={summary} evidence={evidence} activities={activities} communications={communications} history={history} metadata={metadata} audit={audit}/>;
}
