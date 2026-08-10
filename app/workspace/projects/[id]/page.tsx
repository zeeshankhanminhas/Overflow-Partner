import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { getProjectById } from '@/lib/repositories/workflow';
import { isRecordNotFoundError } from '@/lib/repositories/errors';
import { workspaceLabel } from '@/lib/presentation/vocabulary';
import { normaliseProjectStage, projectStageMeta, projectStages } from '@/lib/projects/stages';
import { getProjectDocumentRequirements } from '@/lib/projects/documentRequirements';
import { resolveActionState, resolveEvidenceState } from '@/lib/workspace/state';
import { toOperatorError } from '@/lib/workspace/operatorErrors';
import { resolveFinancialGate } from '@/lib/finance/state';
import RecordWorkspace from '@/components/workspace/RecordWorkspace';
import GovernedAction from '@/components/workspace/GovernedAction';
import { getWorkspaceDocument } from '@/components/workspace/documents/documentRegistry';
import { advanceProjectStageAction, updateProjectMobilisationAction } from './actions';

function value(record:Record<string,unknown>|null|undefined,key:string,fallback='Not recorded'){const entry=record?.[key];return entry===null||entry===undefined||entry===''?fallback:String(entry)}
function money(amount:unknown,currency:unknown){const number=Number(amount??0);try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:String(currency||'GBP')}).format(number)}catch{return `${String(currency||'GBP')} ${number.toFixed(2)}`}}
function formatDate(input:unknown,fallback='Not set'){if(!input)return fallback;const date=new Date(String(input));return Number.isNaN(date.getTime())?String(input):date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
function stateLabel(input:unknown){return String(input||'not_released').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}
type Readiness={ready:boolean;stage:string;reasons:string[];activityTotal:number;activityOpen:number;approvedDocuments:number;issuedDocuments:number;executionMode?:string;partnerCommencement?:boolean};

export default async function ProjectWorkspacePage({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<Record<string,string|undefined>>}){
  const {id}=await params;const query=searchParams?await searchParams:{};const {supabase,organisationId}=await requireUserContext();
  let project;
  try{project=await getProjectById(supabase,organisationId,id)}catch(error){if(isRecordNotFoundError(error))notFound();throw error;}

  const [tasksResult,documentsResult,activityResult,membersResult,readinessResult,financialGateResult,executionAssignmentResult]=await Promise.all([
    supabase.from('tasks').select('id,title,status,priority,due_at').eq('organisation_id',organisationId).eq('entity_type','project').eq('entity_id',id).order('created_at',{ascending:false}),
    supabase.from('documents').select('*').eq('organisation_id',organisationId).eq('project_id',id).order('created_at',{ascending:false}),
    supabase.from('activity_events').select('*').eq('organisation_id',organisationId).eq('entity_type','project').eq('entity_id',id).order('created_at',{ascending:false}).limit(30),
    supabase.from('profiles').select('id,full_name,role').eq('organisation_id',organisationId).order('full_name'),
    supabase.rpc('op_project_stage_readiness',{p_project_id:id}),
    supabase.rpc('op_project_financial_gate',{p_project_id:id}),
    supabase.from('project_execution_assignments').select('id,partner_id,execution_state,reporting_cadence,committed_due_date').eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
  ]);
  if(executionAssignmentResult.error)throw new Error(`Partner execution could not be loaded: ${executionAssignmentResult.error.message}`);

  const executionAssignment=executionAssignmentResult.data;
  let executionPartner:Record<string,unknown>|null=null;
  let commencement:Record<string,unknown>|null=null;
  let latestPartnerProgress:Record<string,unknown>|null=null;
  if(executionAssignment){
    const [partnerResult,commencementResult,progressResult]=await Promise.all([
      supabase.from('partners').select('id,company_name,contact_name').eq('organisation_id',organisationId).eq('id',executionAssignment.partner_id).maybeSingle(),
      supabase.from('partner_commencement_declarations').select('id,submitted_at,forecast_delivery_date,execution_lead_name').eq('organisation_id',organisationId).eq('assignment_id',executionAssignment.id).maybeSingle(),
      supabase.from('partner_progress_updates').select('id,progress_state,percent_complete,work_in_progress,forecast_delivery_date,submitted_at').eq('organisation_id',organisationId).eq('assignment_id',executionAssignment.id).order('submitted_at',{ascending:false}).limit(1).maybeSingle(),
    ]);
    if(partnerResult.error)throw new Error(`Execution Partner could not be loaded: ${partnerResult.error.message}`);
    if(commencementResult.error)throw new Error(`Partner commencement could not be loaded: ${commencementResult.error.message}`);
    if(progressResult.error)throw new Error(`Partner progress could not be loaded: ${progressResult.error.message}`);
    executionPartner=partnerResult.data;commencement=commencementResult.data;latestPartnerProgress=progressResult.data;
  }

  const projectRecord=project as typeof project&{project_stage?:string};const stage=normaliseProjectStage(projectRecord.project_stage);const stageMeta=projectStageMeta[stage];const stageIndex=projectStages.indexOf(stage);
  const lead=project.lead as Record<string,unknown>|null|undefined;const quote=project.quote as Record<string,unknown>|null|undefined;const manager=project.project_manager as Record<string,unknown>|null|undefined;
  const tasks=tasksResult.data??[];const documents=documentsResult.data??[];const events=activityResult.data??[];const members=membersResult.data??[];
  const readiness=(readinessResult.data||{ready:false,stage,reasons:['Project stage readiness is not available yet.'],activityTotal:tasks.length,activityOpen:tasks.filter(t=>!['completed','cancelled'].includes(t.status)).length,approvedDocuments:0,issuedDocuments:0}) as Readiness;
  const financialGate=resolveFinancialGate(financialGateResult.data);
  const mobilisationControlsComplete=Boolean(project.project_manager_id&&project.start_date&&project.due_date);
  const partnerControlled=Boolean(executionAssignment);
  const partnerCommencementPending=partnerControlled&&stage==='ready_for_execution'&&!commencement;
  const financeHref=`/workspace/commercial-control?project=${id}&focus=financial-gate`;
  const deliveryHref=`/workspace/projects/${id}/delivery`;
  const executionHref=`/workspace/projects/${id}/execution`;
  const documentsHref=`/workspace/documents?project=${id}`;
  const paymentsHref=`/workspace/payments?project=${id}`;

  const documentRequirements=getProjectDocumentRequirements(stage,Boolean(project.quote_id));
  const requiredDocumentRequirements=documentRequirements.filter(item=>item.requiredNow).map(item=>({key:item.slug,label:getWorkspaceDocument(item.slug)?.title||item.slug.replaceAll('-',' '),requiredStatus:item.minimumStatus==='signed'?'approved':item.minimumStatus,aliases:[item.slug,getWorkspaceDocument(item.slug)?.title||''],description:item.reason})) as Parameters<typeof resolveEvidenceState>[1];
  const resolvedEvidence=resolveEvidenceState(documents,requiredDocumentRequirements);
  const evidenceBlockers=resolvedEvidence.filter(item=>item.blocking).map(item=>`${item.label}: ${item.operatorState}`);
  const partnerReason='Execution Partner commencement declaration is required.';
  const nonDocumentReasons=readiness.reasons.filter(reason=>!resolvedEvidence.some(item=>reason.toLowerCase().includes(item.label.toLowerCase()))&&reason!==partnerReason);
  const partnerBlocker=partnerCommencementPending?partnerReason:null;
  const financialBlocker=stage==='mobilisation'&&!financialGate.authorised?`Financial authorisation: ${financialGate.reason}`:null;
  const blockers=[...nonDocumentReasons,...evidenceBlockers,...(partnerBlocker?[partnerBlocker]:[]),...(financialBlocker?[financialBlocker]:[])];
  const actionLabel=partnerCommencementPending?'Await partner commencement':stageMeta.action;
  const actionState=resolveActionState({label:actionLabel,businessReady:readiness.ready&&resolvedEvidence.every(item=>item.satisfied)&&!financialBlocker,blockers,readyMessage:partnerControlled&&stage==='ready_for_execution'?'Partner commencement has been received.':'All requirements for this transition are satisfied.'});
  const operatorError=query.error?toOperatorError(query.error):null;

  const notices=<>{query.created?<div className="project-os-notice success"><strong>{query.created}</strong></div>:null}{query.advanced?<div className="project-os-notice success"><strong>Delivery stage advanced</strong><span>The project is now at {projectStageMeta[normaliseProjectStage(query.advanced)].label}.</span></div>:null}{query.updated?<div className="project-os-notice success"><strong>{query.updated}</strong></div>:null}{operatorError?<div className="project-os-notice error"><strong>{operatorError.title}</strong><span>{operatorError.message}</span></div>:null}</>;

  const header=<div style={{display:'flex',justifyContent:'space-between',gap:20,width:'100%',alignItems:'flex-start',flexWrap:'wrap'}}><div><Link href="/workspace/projects" className="project-os-back">← Projects</Link><p className="project-os-reference">Project 360 · {project.project_number}</p><h1>{project.title}</h1><div className="project-os-meta"><span>{value(lead,'company_name')}</span><span>{stageMeta.label}</span><span>Owner · {value(manager,'full_name')}</span><span>Due · {formatDate(project.due_date)}</span><span>{partnerCommencementPending?'Waiting on partner':actionState.permitted?'Ready to progress':'Needs attention'}</span></div></div></div>;

  const stateStrip=<div className="project-os-progress-card" style={{margin:0,border:0,padding:0,background:'transparent'}}><div className="project-os-progress-scroll"><ol className="project-os-progress">{projectStages.map((item,index)=>{const state=index<stageIndex?'complete':index===stageIndex?'current':'future';return <li key={item} className={state}><div className="project-os-node"><span>{index+1}</span></div><strong>{projectStageMeta[item].label}</strong>{state==='current'?<small>Current</small>:null}</li>})}</ol></div><div className="project-os-progress-footer"><p>{stageMeta.objective}</p><span>{partnerControlled?`${blockers.length} blocker${blockers.length===1?'':'s'} · Partner ${stateLabel(executionAssignment?.execution_state)}`:`${blockers.length} blocker${blockers.length===1?'':'s'} · ${readiness.activityOpen} open activit${readiness.activityOpen===1?'y':'ies'}`}</span></div></div>;

  const readinessPanel=<div className="stack" style={{gap:10}}>
    {stage==='mobilisation'?<><div className="project-os-check-row"><span className={`project-os-check-icon ${project.project_manager_id?'':'missing'}`}>{project.project_manager_id?'✓':'!'}</span><div><strong>Project manager</strong><small>{project.project_manager_id?value(manager,'full_name'):'Assign an owner'}</small></div><span>{project.project_manager_id?'Complete':'Required'}</span></div><div className="project-os-check-row"><span className={`project-os-check-icon ${project.start_date&&project.due_date?'':'missing'}`}>{project.start_date&&project.due_date?'✓':'!'}</span><div><strong>Programme dates</strong><small>{formatDate(project.start_date)} → {formatDate(project.due_date)}</small></div><span>{project.start_date&&project.due_date?'Complete':'Required'}</span></div></>:null}
    <div className="project-os-check-row"><span className={`project-os-check-icon ${evidenceBlockers.length?'missing':''}`}>{evidenceBlockers.length?'!':'✓'}</span><div><strong>Required documents</strong><small>{resolvedEvidence.filter(item=>item.satisfied).length} of {resolvedEvidence.length} complete</small></div><Link href={documentsHref}>{evidenceBlockers.length?'Resolve':'Open'}</Link></div>
    {stage==='mobilisation'?<div className="project-os-check-row"><span className={`project-os-check-icon ${financialGate.authorised?'':'missing'}`}>{financialGate.authorised?'✓':'!'}</span><div><strong>Financial authorisation</strong><small>{financialGate.reason}</small></div><Link href={financeHref}>{financialGate.authorised?'Review':'Resolve'}</Link></div>:null}
    {partnerControlled&&['ready_for_execution','in_progress'].includes(stage)?<div className="project-os-check-row"><span className={`project-os-check-icon ${commencement?'':'missing'}`}>{commencement?'✓':'!'}</span><div><strong>Execution Partner commencement</strong><small>{value(executionPartner,'company_name','Execution Partner')} · {commencement?`Declared ${formatDate(commencement.submitted_at)}`:'Awaiting controlled declaration'}</small></div><Link href={executionHref}>{commencement?'Review':'Open'}</Link></div>:null}
    {nonDocumentReasons.map(reason=><div className="project-os-check-row" key={reason}><span className="project-os-check-icon missing">!</span><div><strong>{reason}</strong></div><span>Outstanding</span></div>)}
    {stage==='mobilisation'?<details className="vp-disclosure" open={!mobilisationControlsComplete}><summary>{mobilisationControlsComplete?'Edit mobilisation controls':'Complete mobilisation controls'}</summary><form action={updateProjectMobilisationAction} className="stack" style={{paddingTop:16}}><input type="hidden" name="project_id" value={id}/><label>Project manager<select name="project_manager_id" required defaultValue={String(project.project_manager_id||'')}><option value="">Select manager</option>{members.map(member=><option key={member.id} value={member.id}>{member.full_name||member.role}</option>)}</select></label><div className="grid gap-4 md:grid-cols-2"><label>Start date<input name="start_date" type="date" required defaultValue={project.start_date?String(project.start_date).slice(0,10):''}/></label><label>Due date<input name="due_date" type="date" required defaultValue={project.due_date?String(project.due_date).slice(0,10):''}/></label></div><button className="button">Save mobilisation controls</button></form></details>:null}
  </div>;

  const permittedAction=stageMeta.next?<form action={advanceProjectStageAction}><input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="target_stage" value={stageMeta.next}/><label>Decision note<textarea name="note" rows={3} placeholder="Optional transition note"/></label><button className="button">{stageMeta.action}</button>{stage==='internal_review'?<button className="button secondary" name="target_stage" value="partner_correction">Request partner correction</button>:null}</form>:<div><strong>Project closed</strong><p>Delivery is complete.</p></div>;
  const blockerHref=partnerCommencementPending?executionHref:financialBlocker?financeHref:evidenceBlockers.length?documentsHref:'#record-readiness';
  const nextAction=<GovernedAction state={actionState} blockedAction={<Link className="button secondary" href={blockerHref}>{partnerCommencementPending?'Open Partner Execution':'Resolve blocker'+(blockers.length===1?'':'s')} →</Link>}>{permittedAction}</GovernedAction>;

  const summary=<dl className="project-os-summary" style={{margin:0}}><div><dt>Customer</dt><dd>{value(lead,'company_name')}</dd></div><div><dt>Owner</dt><dd>{value(manager,'full_name')}</dd></div><div><dt>Due</dt><dd>{formatDate(project.due_date)}</dd></div><div><dt>Value</dt><dd>{quote?money(quote.total,quote.currency):'Not recorded'}</dd></div></dl>;

  const activities=partnerControlled?<div className="stack" style={{gap:12}}><div className="vp-facts"><div className="vp-fact"><small>Execution Partner</small><strong>{value(executionPartner,'company_name','Not recorded')}</strong></div><div className="vp-fact"><small>Execution state</small><strong>{stateLabel(executionAssignment?.execution_state)}</strong></div><div className="vp-fact"><small>Commencement</small><strong>{commencement?'Declared':'Awaiting'}</strong></div><div className="vp-fact"><small>Last partner update</small><strong>{latestPartnerProgress?formatDate(latestPartnerProgress.submitted_at):'No update'}</strong></div></div>{latestPartnerProgress?<div className="project-os-check-row"><div><strong>{stateLabel(latestPartnerProgress.progress_state)}</strong><small>{value(latestPartnerProgress,'work_in_progress','No current-work note')}</small></div><span>{latestPartnerProgress.percent_complete===null||latestPartnerProgress.percent_complete===undefined?'Partner reported':`${latestPartnerProgress.percent_complete}%`}</span></div>:null}<div style={{display:'flex',gap:10,flexWrap:'wrap'}}><Link className="button secondary" href={executionHref}>Open Partner Execution →</Link><Link className="button secondary" href={deliveryHref}>Open Delivery Plan →</Link></div></div>:<div className="stack" style={{gap:12}}><div className="vp-facts"><div className="vp-fact"><small>Open activities</small><strong>{readiness.activityOpen}</strong></div><div className="vp-fact"><small>Total activities</small><strong>{tasks.length}</strong></div></div>{tasks.filter(t=>!['completed','cancelled'].includes(t.status)).slice(0,3).map(task=><div className="project-os-check-row" key={task.id}><div><strong>{task.title}</strong><small>{workspaceLabel(task.status,'task')} · {task.due_at?formatDate(task.due_at):'No due date'}</small></div></div>)}<Link className="button secondary" href={deliveryHref}>Open Delivery →</Link></div>;
  const evidence=<div className="stack" style={{gap:12}}><div className="vp-facts"><div className="vp-fact"><small>Required now</small><strong>{resolvedEvidence.length}</strong></div><div className="vp-fact"><small>Complete</small><strong>{resolvedEvidence.filter(item=>item.satisfied).length}</strong></div><div className="vp-fact"><small>Blocking</small><strong>{resolvedEvidence.filter(item=>item.blocking).length}</strong></div></div>{resolvedEvidence.slice(0,4).map(item=><div className="project-os-check-row" key={item.key}><span className={`project-os-check-icon ${item.satisfied?'':'missing'}`}>{item.satisfied?'✓':'!'}</span><div><strong>{item.label}</strong><small>{item.operatorState}</small></div></div>)}<Link className="button secondary" href={documentsHref}>Open Documents →</Link></div>;
  const communications=<div><p style={{color:'var(--op-muted)'}}>Correspondence is kept out of the decision surface.</p><Link className="button secondary" href={`/workspace/communications/project/${id}`}>Open Communications →</Link></div>;
  const history=<div>{events.length===0?<p>No project events recorded.</p>:events.slice(0,10).map(event=><div className="project-os-history-row" key={event.id}><span>→</span><div><strong>{event.event_type.replaceAll('_',' ').replaceAll('.',' ')}</strong><small>{formatDate(event.created_at)}</small></div></div>)}</div>;
  const metadata=<dl className="project-os-summary" style={{margin:0}}><div><dt>Project ID</dt><dd>{project.id}</dd></div><div><dt>Created</dt><dd>{formatDate(project.created_at)}</dd></div><div><dt>Updated</dt><dd>{formatDate(project.updated_at)}</dd></div>{project.lead_id?<div><dt>Source Case</dt><dd><Link href={`/workspace/leads/${project.lead_id}`}>Open Case 360</Link></dd></div>:null}</dl>;
  const audit=<div className="stack"><Link href={documentsHref}>Document register →</Link><Link href={paymentsHref}>Payments →</Link><Link href={financeHref}>Commercial control →</Link>{partnerControlled?<Link href={executionHref}>Partner execution →</Link>:null}</div>;

  return <RecordWorkspace className="project-os-page" header={header} notices={notices} stateStrip={stateStrip} readiness={readinessPanel} nextAction={nextAction} summary={summary} evidence={evidence} activities={activities} communications={communications} history={history} metadata={metadata} audit={audit}/>;
}
