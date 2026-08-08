import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { getWorkflowCase } from '@/lib/orchestration/service';
import { acceptQuoteAction, approveCommercialAction, approveIntakeAction, createCommercialReviewAction, createIntakeShellAction, issueQuoteAction, recordQuoteOutcomeAction, reviseQuoteAction } from '../../orchestration/actions';
import { createPartnerReviewRequestAction, decidePartnerReviewAction } from './actions';
import { eventLabel, partnerReviewNextAction, workspaceLabel } from '@/lib/presentation/vocabulary';
import { getCaseDocumentRequirements } from '@/lib/cases/documentRequirements';
import { resolveActionState, resolveEvidenceState } from '@/lib/workspace/state';
import { toOperatorError } from '@/lib/workspace/operatorErrors';
import RecordWorkspace from '@/components/workspace/RecordWorkspace';
import GovernedAction from '@/components/workspace/GovernedAction';
import DocumentGenerationPanel from '@/components/workspace/documents/DocumentGenerationPanel';
import { getWorkspaceDocument } from '@/components/workspace/documents/documentRegistry';
import MarginSimulator from './MarginSimulator';

const dateTime=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Not recorded';
const money=(currency:string|null|undefined,amount:number|string|null|undefined)=>amount===null||amount===undefined?'Not recorded':new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'GBP'}).format(Number(amount));
function Fact({label,value}:{label:string;value:React.ReactNode}){return <div className="vp-fact"><small>{label}</small><strong>{value??'Not recorded'}</strong></div>}

const caseStages=['Technical scope','Partner review','Commercial decision','Client quote','Delivery'] as const;

export default async function Case360Page({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const {id}=await params;const query=searchParams?await searchParams:{};const {supabase,organisationId}=await requireUserContext();
  let workflow;try{workflow=await getWorkflowCase(supabase,organisationId,id)}catch{notFound()}
  if(!workflow)notFound();

  const [activityResult,documentsResult,partnersResult,reviewsResult,tasksResult]=await Promise.all([
    supabase.from('activity_events').select('*').eq('organisation_id',organisationId).eq('entity_type','lead').eq('entity_id',id).order('created_at',{ascending:false}).limit(30),
    supabase.from('documents').select('*').eq('organisation_id',organisationId).eq('lead_id',id).order('created_at',{ascending:false}),
    supabase.from('partners').select('id,company_name,status,nda_signed').eq('organisation_id',organisationId).eq('status','approved').eq('nda_signed',true).order('company_name'),
    supabase.from('partner_review_requests').select('*, partner:partners(id,company_name,nda_signed), responses:partner_review_responses(*), decisions:partner_review_internal_decisions(*), files:partner_review_files(id)').eq('organisation_id',organisationId).eq('lead_id',id).order('created_at',{ascending:false}),
    supabase.from('tasks').select('*').eq('organisation_id',organisationId).eq('entity_type','lead').eq('entity_id',id).order('created_at',{ascending:false}).limit(12),
  ]);

  const activity=activityResult.data??[];const documents=documentsResult.data??[];const partners=partnersResult.data??[];const tasks=tasksResult.data??[];
  const review=((reviewsResult.data??[]) as any[])[0] as any|undefined;
  const response=[...(review?.responses??[])].sort((a:any,b:any)=>Number(b.revision)-Number(a.revision))[0];
  const technicalApproved=workflow.technicalIntake?.status==='approved';
  const partnerApproved=['approved','approved_with_conditions'].includes(review?.status);
  const quote=workflow.clientQuote;
  const quoteDocument=documents.find((document:any)=>['client-quote','quote'].includes(document.document_type)&&(!quote?.id||document.quote_id===quote.id));
  const quoteDocumentStatus=String(quoteDocument?.status||'not generated');

  let currentStatus='New enquiry',nextAction='Create technical scope',reason='The case needs a governed technical definition.',actionKey='create_scope',blocker:string|null=null;
  if(workflow.technicalIntake&&!technicalApproved){currentStatus='Technical scope under review';nextAction='Approve technical scope';reason='The inherited scope is ready for an engineering decision.';actionKey='approve_scope'}
  if(technicalApproved&&!review){currentStatus='Ready for partner review';nextAction='Send partner review';reason='The approved scope can now be issued to an NDA-ready execution partner.';actionKey='create_partner_review'}
  if(review&&!response){currentStatus='Awaiting partner response';nextAction=partnerReviewNextAction(review.status,false);reason='The partner has the controlled request.';blocker='Waiting on the execution partner.';actionKey='wait_partner'}
  if(review?.status==='submitted'&&response){currentStatus='Partner response received';nextAction='Record technical decision';reason='Technical feasibility and commercial pricing are ready for internal review.';blocker='Commercial progression is locked until this decision is recorded.';actionKey='decide_partner'}
  if(review?.status==='clarification_required'){currentStatus='Clarification required';nextAction='Await revised response';reason='The clarification request is with the partner.';blocker='Waiting on revised partner evidence.';actionKey='wait_partner'}
  if(partnerApproved&&workflow.partnerQuote&&!workflow.commercialReview){currentStatus='Ready for commercial decision';nextAction='Set margin';reason='The approved partner cost is ready for a selling-price decision.';actionKey='create_commercial'}
  if(workflow.commercialReview&&!quote){currentStatus='Quote ready to generate';nextAction='Generate client quote';reason='The approved commercial position can now become a controlled quote.';actionKey='generate_quote'}
  if(quote&&['draft','internal_review'].includes(quote.status)){currentStatus='Draft quote ready';nextAction=quoteDocumentStatus==='approved'?'Issue client quote':'Complete controlled quotation';reason=quoteDocumentStatus==='approved'?'The controlled quotation is approved and may now be commercially issued.':`Commercial issue is blocked until the controlled client quotation is approved. Current document state: ${quoteDocumentStatus}.`;actionKey='issue_quote';blocker=quoteDocumentStatus==='approved'?null:'Controlled quotation approval required.'}
  if(quote?.status==='issued'&&!workflow.project){currentStatus='Awaiting client decision';nextAction='Record client outcome';reason='The issued quote is awaiting acceptance, rejection or revision.';actionKey='accept_quote'}
  if(quote&&['rejected','expired','withdrawn'].includes(quote.status)&&!workflow.project){currentStatus=`Quote ${quote.status}`;nextAction='Open quote revision';reason='The concluded quotation may be revised through a new controlled publication.';actionKey='revise_quote'}
  if(workflow.project){currentStatus=workflow.project.status==='active'?'Active project':'Project ready';nextAction='Open active project';reason='The accepted case has entered controlled delivery.';actionKey='open_project'}

  const documentConfig=getCaseDocumentRequirements({
    hasIntake:Boolean(workflow.technicalIntake),scopeApproved:technicalApproved,hasReview:Boolean(review),partnerResponseReady:Boolean(review&&['submitted','approved','approved_with_conditions','clarification_required'].includes(review.status)),commercialApproved:workflow.commercialReview?.status==='approved',quoteStatus:quote?.status,
  });
  const requiredRequirements=documentConfig.items.filter(item=>item.requiredNow).map(item=>({key:item.slug,label:getWorkspaceDocument(item.slug)?.title||item.slug.replaceAll('-',' '),requiredStatus:item.minimumStatus,aliases:[item.slug,getWorkspaceDocument(item.slug)?.title||''],description:item.reason}));
  const resolvedEvidence=resolveEvidenceState(documents,requiredRequirements);
  const evidenceBlockers=resolvedEvidence.filter(item=>item.blocking).map(item=>`${item.label}: ${item.operatorState}`);
  const waitOnly=actionKey==='wait_partner';
  const actionState=resolveActionState({label:nextAction,businessReady:!blocker&&!waitOnly&&evidenceBlockers.length===0,blockers:[...(blocker?[blocker]:[]),...evidenceBlockers],readyMessage:reason});

  const caseReference=review?.case_reference||`OP-CASE-${workflow.lead.id.slice(0,8).toUpperCase()}`;
  const success=query.success||query.partnerReviewDecision||query.partnerReviewCreated;
  const stageIndex=workflow.project?4:quote?3:(workflow.commercialReview||actionKey==='create_commercial')?2:review?1:0;
  const owner=review?.partner?.company_name?`Internal owner · partner ${review.partner.company_name}`:'Internal owner';
  const operatorError=query.error?toOperatorError(query.error):null;

  const notices=<>{success?<div className="vp-callout"><strong>{String(success)}</strong><p>Current status: {currentStatus}. Next: {nextAction}.</p>{query.reviewUrl?<p style={{overflowWrap:'anywhere'}}>{String(query.reviewUrl)}</p>:null}</div>:null}{operatorError?<div className="vp-callout"><strong>{operatorError.title}</strong><p>{operatorError.message}</p></div>:null}</>;

  const header=<div style={{display:'flex',justifyContent:'space-between',gap:24,width:'100%',alignItems:'flex-start',flexWrap:'wrap'}}><div><Link href="/workspace/leads">← Back to cases</Link><p className="vp-kicker">Case 360 · {caseReference}</p><h1>{workflow.lead.title||workflow.lead.company_name}</h1><p className="vp-subtitle">{workflow.lead.company_name}{workflow.lead.contact_name?` · ${workflow.lead.contact_name}`:''}</p><div className="project-os-meta"><span>Current state · {currentStatus}</span><span>{owner}</span></div></div><span className="vp-status">{currentStatus}</span></div>;

  const stateStrip=<div><div style={{display:'grid',gridTemplateColumns:`repeat(${caseStages.length},minmax(0,1fr))`,gap:8}}>{caseStages.map((label,index)=><div key={label} style={{padding:'10px 12px',borderTop:`2px solid ${index===stageIndex?'var(--op-accent)':index<stageIndex?'rgba(255,255,255,.38)':'var(--op-line)'}`,opacity:index>stageIndex?.55:1}}><small style={{display:'block',color:'var(--op-muted)'}}>{index<stageIndex?'Complete':index===stageIndex?'Current':'Future'}</small><strong>{label}</strong></div>)}</div><p style={{margin:'14px 0 0',color:'var(--op-muted)'}}>{reason}</p></div>;

  const readiness=<div>{actionState.permitted?<div className="vp-callout"><strong>Ready for current decision</strong><p>{reason}</p></div>:<div className="vp-callout"><strong>{waitOnly?'Waiting on external response':'Progression blocked'}</strong><p>{actionState.message}</p>{evidenceBlockers.length?<p>{evidenceBlockers.length} controlled evidence requirement{evidenceBlockers.length===1?'':'s'} remain unresolved.</p>:null}</div>}<div className="vp-facts" style={{marginTop:14}}><Fact label="Technical scope" value={workflow.technicalIntake?workspaceLabel(workflow.technicalIntake.status,'technicalIntake'):'Not created'}/><Fact label="Partner review" value={review?workspaceLabel(review.status,'partnerReview'):'Not started'}/><Fact label="Commercial review" value={workflow.commercialReview?'Recorded':'Not recorded'}/><Fact label="Quote evidence" value={quote?workspaceLabel(quoteDocumentStatus,'document'):'Not required yet'}/></div></div>;

  const actionControls=<>
    {actionKey==='create_scope'?<form action={createIntakeShellAction}><input type="hidden" name="lead_id" value={id}/><button className="button">Create technical scope</button></form>:null}
    {actionKey==='approve_scope'?<form action={approveIntakeAction}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="intake_id" value={workflow.technicalIntake?.id}/><button className="button">Approve technical scope</button></form>:null}
    {actionKey==='create_partner_review'?<form action={createPartnerReviewRequestAction} className="stack"><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="technical_intake_id" value={workflow.technicalIntake?.id}/><label>Execution partner<select name="partner_id" required defaultValue=""><option value="">Select partner</option>{partners.map((p:any)=><option key={p.id} value={p.id}>{p.company_name}</option>)}</select></label><label>Response due<input name="response_due_at" type="datetime-local" required/></label><label>Files<select name="file_selection" defaultValue="all"><option value="all">All approved documents</option><option value="none">No files</option></select></label><button className="button">Send partner review</button></form>:null}
    {actionKey==='decide_partner'?<form action={decidePartnerReviewAction} className="stack"><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="request_id" value={review.id}/><input type="hidden" name="response_id" value={response.id}/><label>Decision<select name="decision" required defaultValue=""><option value="">Select decision</option><option value="approved">Approve</option><option value="approved_with_conditions">Approve with conditions</option><option value="clarification_required">Request clarification</option><option value="rejected">Reject</option></select></label><label>Decision note<textarea name="review_notes" rows={3}/></label><button className="button">Record decision</button></form>:null}
    {actionKey==='create_commercial'?<form action={createCommercialReviewAction} className="stack"><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="partner_quote_id" value={workflow.partnerQuote?.id}/><MarginSimulator cost={Number(workflow.partnerQuote?.price||0)} currency={workflow.partnerQuote?.currency||'GBP'}/><label>Optional note<textarea name="commercial_note" rows={3}/></label><button className="button">Approve commercial position</button></form>:null}
    {actionKey==='generate_quote'?<form action={approveCommercialAction}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="commercial_review_id" value={workflow.commercialReview?.id}/><button className="button">Generate quote</button></form>:null}
    {actionKey==='issue_quote'?<form action={issueQuoteAction}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="quote_id" value={quote?.id}/><button className="button">Issue client quote</button></form>:null}
    {actionKey==='accept_quote'?<div className="stack"><form action={acceptQuoteAction}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="quote_id" value={quote?.id}/><button className="button">Record acceptance and create project</button></form><details className="vp-disclosure"><summary>Other client outcome</summary><form action={recordQuoteOutcomeAction} className="stack"><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="quote_id" value={quote?.id}/><label>Outcome<select name="outcome" required defaultValue="rejected"><option value="rejected">Rejected</option><option value="expired">Expired</option><option value="withdrawn">Withdrawn</option></select></label><label>Decision note<textarea name="note" rows={3}/></label><button className="button secondary">Record outcome</button></form></details></div>:null}
    {actionKey==='revise_quote'?<form action={reviseQuoteAction} className="stack"><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="quote_id" value={quote?.id}/><label>Revision reason<textarea name="note" rows={3} required/></label><button className="button">Open new controlled revision</button></form>:null}
    {actionKey==='open_project'?<Link className="button" href={`/workspace/projects/${workflow.project?.id}`}>Open active project</Link>:null}
  </>;
  const nextActionPanel=waitOnly?<div><h2>{nextAction}</h2><p>{reason}</p><strong>No internal action is required.</strong></div>:<GovernedAction state={actionState} blockedAction={<a className="button secondary" href="#record-controlled-evidence">Resolve controlled evidence ↓</a>}>{actionControls}</GovernedAction>;

  const summary=<div className="vp-facts"><Fact label="Customer" value={workflow.lead.company_name}/><Fact label="Contact" value={workflow.lead.contact_name}/><Fact label="Project type" value={workflow.technicalIntake?.project_type||workflow.lead.project_type}/><Fact label="Discipline" value={workflow.technicalIntake?.discipline}/><Fact label="Deadline" value={workflow.technicalIntake?.deadline}/><Fact label="Documents" value={documents.length}/>{quote?<><Fact label="Quote" value={quote.quote_number}/><Fact label="Total" value={money(quote.currency,quote.total)}/></>:null}</div>;

  const evidence=<div style={{display:'grid',gap:14}}><DocumentGenerationPanel context="case" recordId={id} quoteId={quote?.id} returnTo={`/workspace/leads/${id}`} stageLabel={documentConfig.stageLabel} items={documentConfig.items}/><details className="vp-disclosure"><summary>Underlying technical evidence</summary><div className="vp-facts"><Fact label="Scope" value={workflow.technicalIntake?.description||workflow.lead.notes}/><Fact label="Deliverables" value={workflow.technicalIntake?.deliverables||workflow.lead.service}/><Fact label="Technical status" value={workflow.technicalIntake?workspaceLabel(workflow.technicalIntake.status,'technicalIntake'):'Not created'}/></div></details>{response?<details className="vp-disclosure"><summary>Partner evidence · Revision {response.revision}</summary><div className="vp-facts"><Fact label="Feasibility" value={workspaceLabel(response.feasibility,'feasibility')}/><Fact label="Confidence" value={`${response.confidence_percent}%`}/><Fact label="Capacity" value={workspaceLabel(response.capacity_status,'capacity')}/><Fact label="Hours" value={response.estimated_engineering_hours}/><Fact label="Lead time" value={response.estimated_lead_time_days?`${response.estimated_lead_time_days} days`:'Not recorded'}/>{workflow.partnerQuote?<Fact label="Partner price" value={money(workflow.partnerQuote.currency,workflow.partnerQuote.price)}/>:null}</div></details>:null}</div>;

  const activities=<div>{tasks.length===0?<p style={{color:'var(--op-muted)'}}>No separate case activities are currently open.</p>:<div className="project-os-activity-list">{tasks.map((task:any)=><div key={task.id}><div><strong>{task.title}</strong><small>{workspaceLabel(task.status,'task')} · {task.priority||'normal'}</small></div></div>)}</div>}</div>;
  const communications=<div><p style={{color:'var(--op-muted)',lineHeight:1.6}}>Customer and partner communication stays attached to this Case rather than being mixed into the decision surface.</p><Link className="button secondary" href={`/workspace/communications/lead/${id}`}>Open case communications</Link></div>;
  const history=<div>{activity.length===0?<p>No case events recorded.</p>:activity.slice(0,12).map((event:any)=><div className="project-os-history-row" key={event.id}><span>→</span><div><strong>{eventLabel(event.event_type)}</strong><small>{dateTime(event.created_at)}</small></div></div>)}</div>;
  const olderDocuments=documents.length>6?<div className="project-os-document-list">{documents.slice(6,14).map((document:any)=><div className="project-os-document-row" key={document.id}><div><strong>{document.title}</strong><small>{document.reference}</small></div><span className="project-os-tag">{workspaceLabel(document.status,'document')}</span></div>)}</div>:<p>No older evidence outside the current-stage document set.</p>;
  const metadata=<div className="vp-facts"><Fact label="Case reference" value={caseReference}/><Fact label="Lead ID" value={workflow.lead.id}/><Fact label="Created" value={dateTime(workflow.lead.created_at)}/><Fact label="Lead status" value={workspaceLabel(workflow.lead.status,'lead')}/></div>;
  const audit=<div><p style={{color:'var(--op-muted)',lineHeight:1.6}}>{activity.length} recent governed events are attached to this Case. Decisions, evidence state changes and commercial transitions remain auditable.</p><Link href={`/workspace/documents?lead=${id}`}>Open controlled evidence →</Link></div>;

  return <RecordWorkspace header={header} notices={notices} stateStrip={stateStrip} readiness={readiness} nextAction={nextActionPanel} summary={summary} evidence={evidence} activities={activities} communications={communications} history={history} olderDocuments={olderDocuments} metadata={metadata} audit={audit}/>;
}
