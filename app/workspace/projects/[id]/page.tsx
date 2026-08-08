import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { getProjectById } from '@/lib/repositories/workflow';
import { workspaceLabel } from '@/lib/presentation/vocabulary';
import { normaliseProjectStage, projectStageMeta, projectStages } from '@/lib/projects/stages';
import { getProjectDocumentRequirements } from '@/lib/projects/documentRequirements';
import { resolveActionState, resolveEvidenceState } from '@/lib/workspace/state';
import { toOperatorError } from '@/lib/workspace/operatorErrors';
import RecordWorkspace from '@/components/workspace/RecordWorkspace';
import GovernedAction from '@/components/workspace/GovernedAction';
import DocumentGenerationPanel from '@/components/workspace/documents/DocumentGenerationPanel';
import { getWorkspaceDocument } from '@/components/workspace/documents/documentRegistry';
import { advanceProjectStageAction, createProjectActivityAction, setProjectActivityStatusAction, updateProjectMobilisationAction } from './actions';

function value(record: Record<string,unknown>|null|undefined,key:string,fallback='Not recorded'){const entry=record?.[key];return entry===null||entry===undefined||entry===''?fallback:String(entry)}
function money(amount:unknown,currency:unknown){const number=Number(amount??0);try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:String(currency||'GBP')}).format(number)}catch{return `${String(currency||'GBP')} ${number.toFixed(2)}`}}
function formatDate(input:unknown,fallback='Not set'){if(!input)return fallback;const date=new Date(String(input));return Number.isNaN(date.getTime())?String(input):date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}

type Readiness={ready:boolean;stage:string;reasons:string[];activityTotal:number;activityOpen:number;approvedDocuments:number;issuedDocuments:number};

export default async function ProjectWorkspacePage({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<Record<string,string|undefined>>}){
  const {id}=await params;const query=searchParams?await searchParams:{};const {supabase,organisationId}=await requireUserContext();
  let project;try{project=await getProjectById(supabase,organisationId,id)}catch{notFound()}

  const [tasksResult,documentsResult,activityResult,membersResult,readinessResult]=await Promise.all([
    supabase.from('tasks').select('*').eq('organisation_id',organisationId).eq('entity_type','project').eq('entity_id',id).order('created_at',{ascending:false}),
    supabase.from('documents').select('*').eq('organisation_id',organisationId).eq('project_id',id).order('created_at',{ascending:false}),
    supabase.from('activity_events').select('*').eq('organisation_id',organisationId).eq('entity_type','project').eq('entity_id',id).order('created_at',{ascending:false}).limit(30),
    supabase.from('profiles').select('id,full_name,role').eq('organisation_id',organisationId).order('full_name'),
    supabase.rpc('op_project_stage_readiness',{p_project_id:id}),
  ]);

  const projectRecord=project as typeof project&{project_stage?:string};const stage=normaliseProjectStage(projectRecord.project_stage);const stageMeta=projectStageMeta[stage];const stageIndex=projectStages.indexOf(stage);
  const lead=project.lead as Record<string,unknown>|null|undefined;const quote=project.quote as Record<string,unknown>|null|undefined;const manager=project.project_manager as Record<string,unknown>|null|undefined;
  const tasks=tasksResult.data??[];const documents=documentsResult.data??[];const events=activityResult.data??[];const members=membersResult.data??[];
  const readiness=(readinessResult.data||{ready:false,stage,reasons:['Apply the Project Delivery OS migration to activate governed stage gates.'],activityTotal:tasks.length,activityOpen:tasks.filter(t=>!['completed','cancelled'].includes(t.status)).length,approvedDocuments:0,issuedDocuments:0}) as Readiness;
  const mobilisationControlsComplete=Boolean(project.project_manager_id&&project.start_date&&project.due_date);

  const documentRequirements=getProjectDocumentRequirements(stage,Boolean(project.quote_id));
  const requiredDocumentRequirements=documentRequirements.filter(item=>item.requiredNow).map(item=>({
    key:item.slug,
    label:getWorkspaceDocument(item.slug)?.title||item.slug.replaceAll('-',' '),
    requiredStatus:item.minimumStatus==='signed'?'approved':item.minimumStatus,
    aliases:[item.slug,getWorkspaceDocument(item.slug)?.title||''],
    description:item.reason,
  })) as Parameters<typeof resolveEvidenceState>[1];
  const resolvedEvidence=resolveEvidenceState(documents,requiredDocumentRequirements);
  const evidenceBlockers=resolvedEvidence.filter(item=>item.blocking).map(item=>`${item.label}: ${item.operatorState}`);
  const nonDocumentReasons=readiness.reasons.filter(reason=>!resolvedEvidence.some(item=>reason.toLowerCase().includes(item.label.toLowerCase())));
  const actionState=resolveActionState({
    label:stageMeta.action,
    businessReady:readiness.ready&&resolvedEvidence.every(item=>item.satisfied),
    blockers:[...nonDocumentReasons,...evidenceBlockers],
    readyMessage:'All governed stage requirements are satisfied.',
  });

  const operatorError=query.error?toOperatorError(query.error):null;
  const notices=<>
    {query.advanced?<div className="project-os-notice success"><strong>Delivery stage advanced</strong><span>The project is now at {projectStageMeta[normaliseProjectStage(query.advanced)].label}.</span></div>:null}
    {query.updated||query.activity?<div className="project-os-notice success"><strong>{query.updated||query.activity}</strong></div>:null}
    {operatorError?<div className="project-os-notice error"><strong>{operatorError.title}</strong><span>{operatorError.message}</span></div>:null}
  </>;

  const header=<div style={{display:'flex',justifyContent:'space-between',gap:24,width:'100%',alignItems:'flex-start',flexWrap:'wrap'}}>
    <div><Link href="/workspace/projects" className="project-os-back">← Back to projects</Link><p className="project-os-reference">Project 360 · {project.project_number}</p><h1>{project.title}</h1><div className="project-os-meta"><span>{value(lead,'company_name')}</span><span>Current state · {stageMeta.label}</span><span>Owner · {value(manager,'full_name')}</span><span>{actionState.permitted?'Ready to progress':'Gate controlled'}</span></div></div>
  </div>;

  const stateStrip=<div className="project-os-progress-card" style={{margin:0,border:0,padding:0,background:'transparent'}}><div className="project-os-progress-scroll"><ol className="project-os-progress">{projectStages.map((item,index)=>{const state=index<stageIndex?'complete':index===stageIndex?'current':'future';return <li key={item} className={state}><div className="project-os-node"><span>{index+1}</span></div><strong>{projectStageMeta[item].label}</strong>{state==='current'?<small>Current</small>:null}</li>})}</ol></div><div className="project-os-progress-footer"><p>{stageMeta.objective}</p><span>{readiness.activityOpen} open activities · {resolvedEvidence.filter(item=>item.satisfied).length} required evidence satisfied · {resolvedEvidence.filter(item=>item.blocking).length} blocking</span></div></div>;

  const readinessPanel=<div>
    {stage==='mobilisation'?<div className="project-os-checklist" style={{marginBottom:14}}>
      <div className="project-os-check-row"><span className={`project-os-check-icon ${project.project_manager_id?'':'missing'}`}>{project.project_manager_id?'✓':'!'}</span><div><strong>Project manager</strong><small>{project.project_manager_id?value(manager,'full_name'):'Assign an accountable delivery owner.'}</small></div><span className="project-os-missing">{project.project_manager_id?'Saved':'Required'}</span></div>
      <div className="project-os-check-row"><span className={`project-os-check-icon ${project.start_date?'':'missing'}`}>{project.start_date?'✓':'!'}</span><div><strong>Start date</strong><small>{formatDate(project.start_date)}</small></div><span className="project-os-missing">{project.start_date?'Saved':'Required'}</span></div>
      <div className="project-os-check-row"><span className={`project-os-check-icon ${project.due_date?'':'missing'}`}>{project.due_date?'✓':'!'}</span><div><strong>Due date</strong><small>{formatDate(project.due_date)}</small></div><span className="project-os-missing">{project.due_date?'Saved':'Required'}</span></div>
    </div>:null}
    {actionState.permitted?<div className="project-os-blocker"><div><strong>Ready for progression</strong><p>Operational controls and governed evidence satisfy the current gate.</p></div></div>:<div className="stack" style={{gap:10}}>{nonDocumentReasons.length?<div><p style={{margin:'0 0 8px',color:'var(--op-muted)'}}>Other gate requirements</p>{nonDocumentReasons.map(reason=><div className="project-os-check-row" key={reason}><span className="project-os-check-icon missing">!</span><div><strong>{reason}</strong></div><span className="project-os-missing">Outstanding</span></div>)}</div>:null}{resolvedEvidence.length?<div className="vp-callout"><strong>Controlled evidence</strong><p>{resolvedEvidence.filter(item=>item.blocking).length} blocking · {resolvedEvidence.filter(item=>item.satisfied).length} satisfied. Resolve document state in Controlled Evidence below.</p></div>:null}</div>}
    {stage==='mobilisation'?<details className="vp-disclosure" open={!mobilisationControlsComplete} style={{marginTop:14}}><summary>{mobilisationControlsComplete?'Edit mobilisation controls':'Complete mobilisation controls'}</summary><form action={updateProjectMobilisationAction} className="stack" style={{paddingTop:16}}><input type="hidden" name="project_id" value={id}/><label>Project manager<select name="project_manager_id" required defaultValue={String(project.project_manager_id||'')}><option value="">Select manager</option>{members.map(member=><option key={member.id} value={member.id}>{member.full_name||member.role}</option>)}</select></label><div className="grid gap-4 md:grid-cols-2"><label>Start date<input name="start_date" type="date" required defaultValue={project.start_date?String(project.start_date).slice(0,10):''}/></label><label>Due date<input name="due_date" type="date" required defaultValue={project.due_date?String(project.due_date).slice(0,10):''}/></label></div><button className="button">Save mobilisation controls</button></form></details>:null}
  </div>;

  const permittedAction=stageMeta.next?<form action={advanceProjectStageAction}><input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="target_stage" value={stageMeta.next}/><label>Decision note<textarea name="note" rows={3} placeholder="Optional governed transition note"/></label><button className="button">{stageMeta.action}</button>{stage==='internal_review'?<button className="button secondary" name="target_stage" value="partner_correction">Request partner correction</button>:null}</form>:<strong>Project closed</strong>;
  const nextAction=<GovernedAction state={actionState} blockedAction={<a className="button secondary" href="#record-controlled-evidence">Resolve blockers ↓</a>}>{permittedAction}</GovernedAction>;

  const summary=<dl className="project-os-summary" style={{margin:0}}><div><dt>Customer</dt><dd>{value(lead,'company_name')}</dd></div><div><dt>Case</dt><dd>{value(lead,'title')}</dd></div><div><dt>Manager</dt><dd>{value(manager,'full_name')}</dd></div><div><dt>Dates</dt><dd>{formatDate(project.start_date)} → {formatDate(project.due_date)}</dd></div><div><dt>Commercial value</dt><dd>{quote?money(quote.total,quote.currency):'Not recorded'}</dd></div><div><dt>Quote status</dt><dd>{quote?workspaceLabel(value(quote,'status'),'quote'):'Not recorded'}</dd></div>{project.lead_id?<div><dt>Source record</dt><dd><Link href={`/workspace/leads/${project.lead_id}`}>Open Case 360 →</Link></dd></div>:null}</dl>;

  const evidence=<DocumentGenerationPanel context="project" recordId={id} quoteId={project.quote_id} returnTo={`/workspace/projects/${id}`} stageLabel={stageMeta.label} items={documentRequirements}/>;

  const activities=<div><div className="project-os-activity-list">{tasks.length===0?<div className="project-os-empty-state"><strong>No active delivery activities</strong><p>Create an activity only when governed work needs to be assigned or tracked.</p></div>:tasks.slice(0,6).map(task=><div key={task.id}><div><strong>{task.title}</strong><small>{workspaceLabel(task.status,'task')} · {task.activity_type?.replaceAll('_',' ')||'delivery'} · {task.due_at?formatDate(task.due_at):'No due date'}</small></div><form action={setProjectActivityStatusAction}><input type="hidden" name="project_id" value={id}/><input type="hidden" name="task_id" value={task.id}/>{!['completed','cancelled'].includes(task.status)?<><button className="button secondary" name="status" value="in_progress">Start</button><button className="button" name="status" value="completed">Complete</button><button className="button secondary" name="status" value="blocked">Block</button></>:<button className="button secondary" name="status" value="open">Reopen</button>}</form></div>)}</div><details className="vp-disclosure" style={{marginTop:12}}><summary>+ Add delivery activity</summary><form action={createProjectActivityAction} className="stack" style={{paddingTop:16}}><input type="hidden" name="project_id" value={id}/><input type="hidden" name="project_stage" value={stage}/><label>Activity title<input name="title" required/></label><div className="grid gap-4 md:grid-cols-2"><label>Type<select name="activity_type" defaultValue="delivery"><option value="delivery">Delivery</option><option value="internal_review">Internal review</option><option value="partner_correction">Partner correction</option><option value="client_review">Client review</option><option value="closeout">Closeout</option></select></label><label>Owner<select name="owner_id" defaultValue=""><option value="">Unassigned</option>{members.map(member=><option key={member.id} value={member.id}>{member.full_name||member.role}</option>)}</select></label><label>Due date<input name="due_at" type="datetime-local"/></label><label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label></div><label>Linked document<select name="linked_document_id" defaultValue=""><option value="">No linked document</option>{documents.map(document=><option key={document.id} value={document.id}>{document.reference} · {document.title}</option>)}</select></label><label>Notes<textarea name="notes" rows={3}/></label><button className="button">Create activity</button></form></details></div>;

  const communications=<div><p style={{color:'var(--op-muted)',lineHeight:1.6}}>Project communications remain contextual to this delivery record rather than competing with the current-stage decision.</p><Link className="button secondary" href={`/workspace/communications/project/${id}`}>Open project communications</Link></div>;

  const history=<div>{events.length===0?<p>No project events recorded.</p>:events.slice(0,12).map(event=><div className="project-os-history-row" key={event.id}><span>→</span><div><strong>{event.event_type.replaceAll('_',' ').replaceAll('.',' ')}</strong><small>{formatDate(event.created_at)}</small></div></div>)}</div>;

  const olderDocuments=documents.length>8?<div className="project-os-document-list">{documents.slice(8,16).map(document=><div className="project-os-document-row" key={document.id}><div><strong>{document.title}</strong><small>{document.reference}</small></div><span className="project-os-tag">{workspaceLabel(document.status,'document')}</span></div>)}<Link href={`/workspace/documents?project=${id}`}>View full evidence registry →</Link></div>:<p>No older project documents outside the current evidence set.</p>;

  const metadata=<dl className="project-os-summary" style={{margin:0}}><div><dt>Project ID</dt><dd>{project.id}</dd></div><div><dt>Created</dt><dd>{formatDate(project.created_at)}</dd></div><div><dt>Last updated</dt><dd>{formatDate(project.updated_at)}</dd></div><div><dt>Lifecycle stage</dt><dd>{stageMeta.label}</dd></div></dl>;

  const audit=<div><p style={{color:'var(--op-muted)',lineHeight:1.6}}>Governed transitions, document changes and commercial decisions are recorded in the project audit history.</p><Link href={`/workspace/documents?project=${id}`}>Open governed evidence →</Link></div>;

  return <RecordWorkspace className="project-os-page" header={header} notices={notices} stateStrip={stateStrip} readiness={readinessPanel} nextAction={nextAction} summary={summary} evidence={evidence} activities={activities} communications={communications} history={history} olderDocuments={olderDocuments} metadata={metadata} audit={audit}/>;
}
