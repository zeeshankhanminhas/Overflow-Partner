import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { getProjectById } from '@/lib/repositories/workflow';
import { isRecordNotFoundError } from '@/lib/repositories/errors';
import { humaniseOperatingReason, resolveProjectPresentation, type OperatingPresentation } from '@/lib/presentation/operatingState';
import { normaliseProjectStage, projectStageMeta, projectStages } from '@/lib/projects/stages';
import { getProjectDocumentRequirements } from '@/lib/projects/documentRequirements';
import { resolveActionState, resolveEvidenceState } from '@/lib/workspace/state';
import { toOperatorError } from '@/lib/workspace/operatorErrors';
import { resolveProjectStartPaymentGate } from '@/lib/finance/startPayment';
import RecordWorkspace from '@/components/workspace/RecordWorkspace';
import GovernedAction from '@/components/workspace/GovernedAction';
import { ActionDialog } from '@/components/workspace/InteractionPrimitives';
import { getWorkspaceDocument } from '@/components/workspace/documents/documentRegistry';
import { advanceProjectStageAction, updateProjectMobilisationAction } from './actions';
import { recordClientReviewOutcomeAction, recordClientTransmittalAction } from './client-actions';

function value(record:Record<string,unknown>|null|undefined,key:string,fallback='Not recorded'){const entry=record?.[key];return entry===null||entry===undefined||entry===''?fallback:String(entry)}
function money(amount:unknown,currency:unknown){const number=Number(amount??0);try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:String(currency||'GBP')}).format(number)}catch{return `${String(currency||'GBP')} ${number.toFixed(2)}`}}
function formatDate(input:unknown,fallback='Not set'){if(!input)return fallback;const date=new Date(String(input));return Number.isNaN(date.getTime())?String(input):date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
function stateLabel(input:unknown){return String(input||'not_released').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}
type Readiness={ready:boolean;stage:string;reasons:string[];activityTotal:number;activityOpen:number;approvedDocuments?:number;issuedDocuments?:number;executionMode?:string;partnerCommencement?:boolean;deliveryItems?:number;deliveryWorkOpen?:number;deliveryCloseOpen?:number;openPartnerExceptions?:number;executionCycle?:number;clientTransmittals?:number;clientOutcome?:string|null};

export default async function ProjectWorkspacePage({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<Record<string,string|undefined>>}){
  const {id}=await params;const query=searchParams?await searchParams:{};const {supabase,organisationId}=await requireUserContext();
  let project;try{project=await getProjectById(supabase,organisationId,id)}catch(error){if(isRecordNotFoundError(error))notFound();throw error;}

  const [tasksResult,documentsResult,activityResult,membersResult,readinessResult,startPaymentGate,executionAssignmentResult]=await Promise.all([
    supabase.from('tasks').select('id,title,status,priority,due_at').eq('organisation_id',organisationId).eq('entity_type','project').eq('entity_id',id).order('created_at',{ascending:false}),
    supabase.from('documents').select('*').eq('organisation_id',organisationId).eq('project_id',id).order('created_at',{ascending:false}),
    supabase.from('activity_events').select('*').eq('organisation_id',organisationId).eq('entity_type','project').eq('entity_id',id).order('created_at',{ascending:false}).limit(30),
    supabase.from('profiles').select('id,full_name,role').eq('organisation_id',organisationId).order('full_name'),
    supabase.rpc('op_project_stage_readiness',{p_project_id:id}),
    resolveProjectStartPaymentGate(supabase,organisationId,id),
    supabase.from('project_execution_assignments').select('id,partner_id,execution_state,execution_cycle,reporting_cadence,committed_due_date').eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
  ]);
  if(executionAssignmentResult.error)throw new Error(`Partner execution could not be loaded: ${executionAssignmentResult.error.message}`);

  const executionAssignment=executionAssignmentResult.data;
  let executionPartner:Record<string,unknown>|null=null;let commencement:Record<string,unknown>|null=null;let latestPartnerProgress:Record<string,unknown>|null=null;let currentCycleDelivery:Record<string,unknown>|null=null;
  if(executionAssignment){
    const executionCycle=Number(executionAssignment.execution_cycle||1);
    const [partnerResult,commencementResult,progressResult,deliveryResult]=await Promise.all([
      supabase.from('partners').select('id,company_name,contact_name').eq('organisation_id',organisationId).eq('id',executionAssignment.partner_id).maybeSingle(),
      supabase.from('partner_commencement_declarations').select('id,submitted_at,forecast_delivery_date,execution_lead_name').eq('organisation_id',organisationId).eq('assignment_id',executionAssignment.id).maybeSingle(),
      supabase.from('partner_progress_updates').select('id,progress_state,percent_complete,work_in_progress,forecast_delivery_date,submitted_at').eq('organisation_id',organisationId).eq('assignment_id',executionAssignment.id).order('submitted_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('partner_delivery_submissions').select('id,execution_cycle,submitted_at,review_status,delivery_summary').eq('organisation_id',organisationId).eq('assignment_id',executionAssignment.id).eq('execution_cycle',executionCycle).order('submitted_at',{ascending:false}).limit(1).maybeSingle(),
    ]);
    if(partnerResult.error)throw new Error(`Execution Partner could not be loaded: ${partnerResult.error.message}`);if(commencementResult.error)throw new Error(`Partner commencement could not be loaded: ${commencementResult.error.message}`);if(progressResult.error)throw new Error(`Partner progress could not be loaded: ${progressResult.error.message}`);if(deliveryResult.error)throw new Error(`Partner delivery could not be loaded: ${deliveryResult.error.message}`);
    executionPartner=partnerResult.data;commencement=commencementResult.data;latestPartnerProgress=progressResult.data;currentCycleDelivery=deliveryResult.data;
  }

  const projectRecord=project as typeof project&{project_stage?:string};const stage=normaliseProjectStage(projectRecord.project_stage);const stageMeta=projectStageMeta[stage];const stageIndex=projectStages.indexOf(stage);
  const lead=project.lead as Record<string,unknown>|null|undefined;const quote=project.quote as Record<string,unknown>|null|undefined;const manager=project.project_manager as Record<string,unknown>|null|undefined;
  const tasks=tasksResult.data??[];const documents=documentsResult.data??[];const events=activityResult.data??[];const members=membersResult.data??[];
  const readiness=(readinessResult.data||{ready:false,stage,reasons:['Project stage readiness is not available yet.'],activityTotal:tasks.length,activityOpen:tasks.filter(t=>!['completed','cancelled'].includes(t.status)).length}) as Readiness;
  const financialGate=startPaymentGate;const mobilisationControlsComplete=Boolean(project.project_manager_id&&project.start_date&&project.due_date);const partnerControlled=Boolean(executionAssignment);const partnerCommencementPending=partnerControlled&&stage==='ready_for_execution'&&!commencement;
  const financeHref=`/workspace/commercial-control?project=${id}&focus=financial-gate`;const deliveryHref=`/workspace/projects/${id}/delivery`;const executionHref=`/workspace/projects/${id}/execution`;const documentsHref=`/workspace/documents?project=${id}`;const paymentsHref=`/workspace/payments?project=${id}`;const recordPaymentHref=`${paymentsHref}&action=record-payment`;

  const documentRequirements=getProjectDocumentRequirements(stage,Boolean(project.quote_id));
  const requiredDocumentRequirements=documentRequirements.filter(item=>item.requiredNow).map(item=>({key:item.slug,label:getWorkspaceDocument(item.slug)?.title||item.slug.replaceAll('-',' '),requiredStatus:item.minimumStatus==='signed'?'approved':item.minimumStatus,aliases:[item.slug,getWorkspaceDocument(item.slug)?.title||''],description:item.reason})) as Parameters<typeof resolveEvidenceState>[1];
  const resolvedEvidence=resolveEvidenceState(documents,requiredDocumentRequirements);const evidenceBlockers=resolvedEvidence.filter(item=>item.blocking).map(item=>`${item.label}: ${item.operatorState}`);
  const partnerReason='Execution Partner commencement declaration is required.';
  const nonDocumentReasons=readiness.reasons.filter(reason=>!resolvedEvidence.some(item=>reason.toLowerCase().includes(item.label.toLowerCase()))&&reason!==partnerReason&&!reason.toLowerCase().startsWith('financial authorisation:'));
  const partnerBlocker=partnerCommencementPending?partnerReason:null;const financialBlocker=stage==='mobilisation'&&!financialGate.authorised?`Client start payment: ${financialGate.reason}`:null;
  const blockers=[...nonDocumentReasons,...evidenceBlockers,...(partnerBlocker?[partnerBlocker]:[]),...(financialBlocker?[financialBlocker]:[])];

  const basePresentation=resolveProjectPresentation({
    stage,
    ready:readiness.ready,
    readinessReasons:nonDocumentReasons,
    partnerControlled,
    partnerName:value(executionPartner,'company_name','Execution Partner'),
    executionState:executionAssignment?.execution_state,
    executionCycle:Number(executionAssignment?.execution_cycle||readiness.executionCycle||1),
    commencementConfirmed:Boolean(commencement),
    currentCycleDeliverySubmitted:Boolean(currentCycleDelivery),
    latestPartnerUpdateAt:latestPartnerProgress?.submitted_at?String(latestPartnerProgress.submitted_at):null,
    deliveryItems:readiness.deliveryItems||0,
    deliveryWorkOpen:readiness.deliveryWorkOpen||0,
    openPartnerExceptions:readiness.openPartnerExceptions||0,
    requiredDocuments:resolvedEvidence.length,
    completedDocuments:resolvedEvidence.filter(item=>item.satisfied).length,
    evidenceBlockers,
    financialAuthorised:financialGate.authorised,
    clientOutcome:readiness.clientOutcome,
    executionHref,deliveryHref,documentsHref,financeHref:financialGate.authorised?financeHref:recordPaymentHref,
  });
  const presentation:OperatingPresentation=stage==='mobilisation'&&!financialGate.authorised?{
    ...basePresentation,
    state:'Awaiting client payment',
    headline:'Awaiting client payment',
    summary:financialGate.required>0?`Required to start: ${money(financialGate.required,financialGate.currency)} · Received: ${money(financialGate.received,financialGate.currency)}.`:financialGate.reason,
    tone:'waiting',
    waitingOn:{actor:'client',label:value(lead,'company_name','Client')},
    nextAction:{label:'Record payment',available:true,kind:'navigate',href:recordPaymentHref,reason:'Record cleared settlement in Payments. Project execution remains locked until the required amount has been received.'},
    blockers:financialBlocker?[humaniseOperatingReason(financialBlocker)]:[],
    completed:basePresentation.completed.filter(item=>item!=='Commercial release authorised'),
    primaryActions:[],
  }:basePresentation;
  const actionState=resolveActionState({label:presentation.nextAction.label,businessReady:presentation.nextAction.available&&readiness.ready&&resolvedEvidence.every(item=>item.satisfied)&&!financialBlocker,blockers,readyMessage:presentation.summary});
  const operatorError=query.error?toOperatorError(query.error):null;

  const notices=<>{query.created?<div className="project-os-notice success"><strong>{query.created}</strong></div>:null}{query.advanced?<div className="project-os-notice success"><strong>Delivery stage advanced</strong><span>The project is now at {projectStageMeta[normaliseProjectStage(query.advanced)].label}.</span></div>:null}{query.updated?<div className="project-os-notice success"><strong>{query.updated}</strong></div>:null}{operatorError?<div className="project-os-notice error"><strong>{operatorError.title}</strong><span>{operatorError.message}</span></div>:null}</>;
  const header=<div style={{display:'flex',justifyContent:'space-between',gap:20,width:'100%',alignItems:'flex-start',flexWrap:'wrap'}}><div><Link href="/workspace/projects" className="project-os-back">← Projects</Link><p className="project-os-reference">Project 360 · {project.project_number}</p><h1>{project.title}</h1><p className="vp-subtitle">{value(lead,'company_name')}</p></div></div>;
  const stateStrip=<div className="project-os-progress-card" style={{margin:0,border:0,padding:0,background:'transparent'}}><div className="project-os-progress-scroll"><ol className="project-os-progress">{projectStages.map((item,index)=>{const state=index<stageIndex?'complete':index===stageIndex?'current':'future';return <li key={item} className={state}><div className="project-os-node"><span>{index+1}</span></div><strong>{projectStageMeta[item].label}</strong>{state==='current'?<small>Current</small>:null}</li>})}</ol></div></div>;

  const displayReadinessReasons=nonDocumentReasons.filter(reason=>!reason.toLowerCase().includes('execution partner exception')&&!reason.toLowerCase().includes('delivery control')&&!reason.toLowerCase().includes('delivery submission')&&!reason.toLowerCase().includes('delivery files'));
  const hasReadinessDetail=(stage==='mobilisation'&&!mobilisationControlsComplete)||evidenceBlockers.length>0||partnerCommencementPending||(readiness.openPartnerExceptions||0)>0||(readiness.deliveryWorkOpen||0)>0||displayReadinessReasons.length>0;
  const readinessPanel=hasReadinessDetail?<div className="stack" style={{gap:10}}>
    {stage==='mobilisation'&&!project.project_manager_id?<div className="project-os-check-row"><span className="project-os-check-icon missing">!</span><div><strong>Project manager</strong><small>Assign an owner before mobilisation can complete.</small></div><span>Required</span></div>:null}
    {stage==='mobilisation'&&!(project.start_date&&project.due_date)?<div className="project-os-check-row"><span className="project-os-check-icon missing">!</span><div><strong>Programme dates</strong><small>Start and due dates are required.</small></div><span>Required</span></div>:null}
    {stage==='mobilisation'&&!mobilisationControlsComplete?<ActionDialog title="Complete mobilisation controls" description="Assign the Project owner and programme dates. These are genuine mobilisation inputs; the Project start-payment gate remains independently enforced." triggerLabel="Complete mobilisation controls" triggerTone="secondary"><form action={updateProjectMobilisationAction} className="stack"><input type="hidden" name="project_id" value={id}/><label>Project manager<select name="project_manager_id" required defaultValue={String(project.project_manager_id||'')}><option value="">Select manager</option>{members.map(member=><option key={member.id} value={member.id}>{member.full_name||member.role}</option>)}</select></label><div className="grid gap-4 md:grid-cols-2"><label>Start date<input name="start_date" type="date" required defaultValue={project.start_date?String(project.start_date).slice(0,10):''}/></label><label>Due date<input name="due_date" type="date" required defaultValue={project.due_date?String(project.due_date).slice(0,10):''}/></label></div><button className="button">Save mobilisation controls</button></form></ActionDialog>:null}
    {evidenceBlockers.length>0?<div className="project-os-check-row"><span className="project-os-check-icon missing">!</span><div><strong>Required documents</strong><small>{evidenceBlockers.length} current requirement{evidenceBlockers.length===1?'':'s'} unresolved.</small></div><Link href={documentsHref}>Resolve</Link></div>:null}
    {partnerCommencementPending?<div className="project-os-check-row"><span className="project-os-check-icon missing">!</span><div><strong>Partner commencement</strong><small>{value(executionPartner,'company_name','Execution Partner')} has not confirmed commencement.</small></div><Link href={executionHref}>Open workspace</Link></div>:null}
    {(readiness.openPartnerExceptions||0)>0?<div className="project-os-check-row"><span className="project-os-check-icon missing">!</span><div><strong>Partner exceptions</strong><small>{readiness.openPartnerExceptions} unresolved</small></div><Link href={executionHref}>Resolve</Link></div>:null}
    {(readiness.deliveryWorkOpen||0)>0?<div className="project-os-check-row"><span className="project-os-check-icon missing">!</span><div><strong>Delivery Control</strong><small>{readiness.deliveryWorkOpen} active or blocked item{readiness.deliveryWorkOpen===1?'':'s'}.</small></div><Link href={deliveryHref}>Open</Link></div>:null}
    {displayReadinessReasons.map(reason=><div className="project-os-check-row" key={reason}><span className="project-os-check-icon missing">!</span><div><strong>{humaniseOperatingReason(reason)}</strong></div><span>Outstanding</span></div>)}
  </div>:undefined;

  const transitionLabel=stage==='partner_correction'?stageMeta.action:presentation.nextAction.label;
  const standardTransition=stageMeta.next?<ActionDialog title={transitionLabel} description="This governed action advances the Project only if the canonical readiness authority permits the transition." triggerLabel={transitionLabel}><form action={advanceProjectStageAction} className="stack"><input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="target_stage" value={stageMeta.next}/><label>Decision note<textarea name="note" rows={3} placeholder="Optional transition note"/></label><button className="button">{transitionLabel}</button>{stage==='internal_review'?<button className="button secondary" name="target_stage" value="partner_correction">Request Partner correction</button>:null}</form></ActionDialog>:<div><strong>Project closed</strong><p>Delivery is complete.</p></div>;
  const transmittalOnlyReason=(reason:string)=>reason.toLowerCase().includes('client transmittal record');
  const preTransmittalBlockers=blockers.filter(reason=>!transmittalOnlyReason(reason));
  const clientTransmittalAction=<ActionDialog title="Send approved delivery to client" description="Record the controlled transmittal evidence without leaving Project 360." triggerLabel="Send approved delivery"><form action={recordClientTransmittalAction} className="stack"><input type="hidden" name="project_id" value={id}/><div className="grid gap-4 md:grid-cols-2"><label>Recipient name<input name="recipient_name" required defaultValue={value(lead,'contact_name','')}/></label><label>Recipient email<input name="recipient_email" type="email" defaultValue={value(lead,'contact_email','')}/></label></div><label>Delivery method<select name="delivery_method" required defaultValue="email"><option value="email">Email</option><option value="secure_link">Secure link</option><option value="client_portal">Client portal</option><option value="other">Other controlled method</option></select></label><label>Transmittal note<textarea name="note" rows={3} placeholder="Optional issue note"/></label><button className="button" disabled={preTransmittalBlockers.length>0}>Record transmittal and send</button>{preTransmittalBlockers.length>0?<p>Resolve first: {humaniseOperatingReason(preTransmittalBlockers[0])}</p>:null}</form></ActionDialog>;
  const clientReviewAction=<ActionDialog title="Record client outcome" description="Capture the client's actual written outcome. Accepted outcomes permit Completion; changes or rejection create the governed correction path." triggerLabel="Record client outcome"><form action={recordClientReviewOutcomeAction} className="stack"><input type="hidden" name="project_id" value={id}/><label>Client outcome<select name="outcome" required defaultValue=""><option value="" disabled>Select outcome</option><option value="accepted">Accepted</option><option value="accepted_with_comments">Accepted with comments</option><option value="changes_requested">Changes requested</option><option value="rejected">Rejected / correction required</option></select></label><label>Evidence basis<select name="evidence_basis" required defaultValue="email_confirmation"><option value="email_confirmation">Email confirmation</option><option value="signed_acceptance">Signed acceptance</option><option value="client_portal">Client portal</option><option value="meeting_record">Meeting record</option><option value="other_written">Other written evidence</option></select></label><label>Evidence reference<input name="evidence_reference" required placeholder="Email subject/date, signed acceptance ref, meeting record..."/></label><label>Comments<textarea name="comments" rows={3}/></label><button className="button">Record client outcome</button></form></ActionDialog>;
  let nextAction:React.ReactNode;
  if(stage==='mobilisation'&&!financialGate.authorised)nextAction=<Link className="button" href={recordPaymentHref}>Record payment</Link>;
  else if(stage==='ready_for_client_issue')nextAction=clientTransmittalAction;
  else if(stage==='client_review'&&!readiness.clientOutcome)nextAction=clientReviewAction;
  else {const blockerHref=partnerCommencementPending?executionHref:(readiness.openPartnerExceptions||0)>0?executionHref:(readiness.deliveryWorkOpen||0)>0?deliveryHref:evidenceBlockers.length?documentsHref:'#record-readiness';nextAction=<GovernedAction state={actionState} blockedAction={<Link className="button secondary" href={blockerHref}>Resolve blocker{blockers.length!==1?'s':''} →</Link>}>{standardTransition}</GovernedAction>;}

  const summary=<dl className="project-os-summary" style={{margin:0}}><div><dt>Customer</dt><dd>{value(lead,'company_name')}</dd></div><div><dt>Owner</dt><dd>{value(manager,'full_name')}</dd></div><div><dt>Due</dt><dd>{formatDate(project.due_date)}</dd></div><div><dt>{stage==='mobilisation'&&financialGate.authorised?'Start payment':'Value'}</dt><dd>{stage==='mobilisation'&&financialGate.authorised?`${money(financialGate.received,financialGate.currency)} cleared`:quote?money(quote.total,quote.currency):'Not recorded'}</dd></div></dl>;
  const activities=partnerControlled?<div className="stack operating-work-summary" style={{gap:12}}><div className="vp-facts"><div className="vp-fact"><small>Execution Partner</small><strong>{value(executionPartner,'company_name','Not recorded')}</strong></div><div className="vp-fact"><small>Cycle</small><strong>{Number(executionAssignment?.execution_cycle||readiness.executionCycle||1)}</strong></div><div className="vp-fact"><small>Committed due</small><strong>{formatDate(executionAssignment?.committed_due_date||project.due_date)}</strong></div><div className="vp-fact"><small>Partner update</small><strong>{latestPartnerProgress?formatDate(latestPartnerProgress.submitted_at):'Not received yet'}</strong></div></div>{latestPartnerProgress?<div className="project-os-check-row"><div><strong>{stateLabel(latestPartnerProgress.progress_state)}</strong><small>{value(latestPartnerProgress,'work_in_progress','No current-work note')}</small></div><span>{latestPartnerProgress.percent_complete===null||latestPartnerProgress.percent_complete===undefined?'Partner reported':`${latestPartnerProgress.percent_complete}%`}</span></div>:null}<div style={{display:'flex',gap:10,flexWrap:'wrap'}}><Link className="button secondary" href={executionHref}>Open Partner workspace →</Link><Link className="button secondary" href={deliveryHref}>Open Delivery Control →</Link></div></div>:undefined;
  const evidence=evidenceBlockers.length?<div className="stack" style={{gap:12}}>{resolvedEvidence.filter(item=>item.blocking).map(item=><div className="project-os-check-row" key={item.key}><span className="project-os-check-icon missing">!</span><div><strong>{item.label}</strong><small>{item.operatorState}</small></div></div>)}<Link className="button secondary" href={documentsHref}>Resolve Documents →</Link></div>:undefined;
  const communications=<div><p style={{color:'var(--op-muted)'}}>Correspondence stays contextual to the Project decision surface.</p><Link className="button secondary" href={`/workspace/communications/project/${id}`}>Open Messages →</Link></div>;
  const history=<div>{events.length===0?<p>No project events recorded.</p>:events.slice(0,10).map(event=><div className="project-os-history-row" key={event.id}><span>→</span><div><strong>{event.event_type.replaceAll('_',' ').replaceAll('.',' ')}</strong><small>{formatDate(event.created_at)}</small></div></div>)}</div>;
  const metadata=<dl className="project-os-summary" style={{margin:0}}><div><dt>Created</dt><dd>{formatDate(project.created_at)}</dd></div><div><dt>Updated</dt><dd>{formatDate(project.updated_at)}</dd></div>{project.lead_id?<div><dt>Source Case</dt><dd><Link href={`/workspace/leads/${project.lead_id}`}>Open Case 360</Link></dd></div>:null}{readiness.clientOutcome?<div><dt>Client outcome</dt><dd>{stateLabel(readiness.clientOutcome)}</dd></div>:null}</dl>;
  const audit=<div className="stack"><Link href={documentsHref}>Document register →</Link><Link href={paymentsHref}>Payments →</Link><Link href={financeHref}>Commercial control →</Link>{partnerControlled?<Link href={executionHref}>Partner execution →</Link>:null}</div>;

  return <RecordWorkspace className="project-os-page" header={header} notices={notices} stateStrip={stateStrip} presentation={presentation} readiness={readinessPanel} nextAction={nextAction} summary={summary} evidence={evidence} activities={activities} communications={communications} history={history} metadata={metadata} audit={audit}/>;
}
