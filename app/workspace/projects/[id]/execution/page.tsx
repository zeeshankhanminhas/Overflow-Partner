import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { createExecutionSessionToken } from '@/lib/execution/sessionToken';
import { resolveProjectStartPaymentGate } from '@/lib/finance/startPayment';
import type { OperatingPresentation } from '@/lib/presentation/operatingState';
import { resolveExecutionExceptionAction } from './actions';
import { guardedGenerateExecutionLinkAction, guardedReleasePartnerExecutionAction } from './guardedActions';
import RecordWorkspace from '@/components/workspace/RecordWorkspace';
import { ActionDialog, EvidenceRow, ProductDisclosure } from '@/components/workspace/InteractionPrimitives';

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function money(value:unknown,currency='GBP'){try{return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(Number(value||0))}catch{return `${currency} ${Number(value||0).toFixed(2)}`}}
function stateLabel(value?: string | null) { return String(value || '').replaceAll('_',' ').replace(/\b\w/g, (char) => char.toUpperCase()); }

export default async function PartnerExecutionControlPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string,string | undefined>>;
}) {
  const { id }=await params;const query=searchParams?await searchParams:{};const {supabase,organisationId}=await requireUserContext();
  const {data:project,error:projectError}=await supabase.from('projects').select('id,project_number,title,lead_id,quote_id,start_date,due_date,project_stage,status').eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(projectError)throw new Error(projectError.message);if(!project)notFound();

  const [assignmentResult,documentsResult,startPaymentGate]=await Promise.all([
    supabase.from('project_execution_assignments').select('*').eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
    supabase.from('documents').select('id,title,reference,status,revision_code,document_type,is_current_revision,created_at').eq('organisation_id',organisationId).eq('project_id',id).in('document_type',['scope-of-work','statement-of-work']).in('status',['approved','issued','published']).order('created_at',{ascending:false}),
    resolveProjectStartPaymentGate(supabase,organisationId,id),
  ]);
  if(assignmentResult.error)throw new Error(assignmentResult.error.message);if(documentsResult.error)throw new Error(documentsResult.error.message);
  const assignment=assignmentResult.data;const documents=documentsResult.data||[];const currentScopes=documents.filter(doc=>doc.is_current_revision);

  let commercialPartnerId='';
  if(project.quote_id){
    const {data:quote}=await supabase.from('quotes').select('commercial_review_id').eq('organisation_id',organisationId).eq('id',project.quote_id).maybeSingle();
    if(quote?.commercial_review_id){const {data:review}=await supabase.from('commercial_reviews').select('partner_quote_id').eq('organisation_id',organisationId).eq('id',quote.commercial_review_id).maybeSingle();if(review?.partner_quote_id){const {data:partnerQuote}=await supabase.from('partner_quotes').select('partner_id').eq('organisation_id',organisationId).eq('id',review.partner_quote_id).maybeSingle();commercialPartnerId=partnerQuote?.partner_id||'';}}
  }
  const {data:commercialPartner,error:commercialPartnerError}=commercialPartnerId
    ? await supabase.from('partners').select('id,company_name,contact_name,email,status,nda_signed').eq('organisation_id',organisationId).eq('id',commercialPartnerId).maybeSingle()
    : {data:null,error:null};
  if(commercialPartnerError)throw new Error(commercialPartnerError.message);

  let session:any=null;let commencement:any=null;let progress:any[]=[];let exceptions:any[]=[];let submissions:any[]=[];
  if(assignment){
    const [sessionResult,commencementResult,progressResult,exceptionResult,submissionResult]=await Promise.all([
      supabase.from('partner_execution_sessions').select('id,status,recipient_email,expires_at,first_opened_at,last_opened_at,created_at').eq('organisation_id',organisationId).eq('assignment_id',assignment.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('partner_commencement_declarations').select('*').eq('organisation_id',organisationId).eq('assignment_id',assignment.id).maybeSingle(),
      supabase.from('partner_progress_updates').select('*').eq('organisation_id',organisationId).eq('assignment_id',assignment.id).order('submitted_at',{ascending:false}).limit(8),
      supabase.from('partner_execution_exceptions').select('*').eq('organisation_id',organisationId).eq('assignment_id',assignment.id).order('raised_at',{ascending:false}).limit(8),
      supabase.from('partner_delivery_submissions').select('*').eq('organisation_id',organisationId).eq('assignment_id',assignment.id).order('submitted_at',{ascending:false}).limit(8),
    ]);
    for(const result of [sessionResult,commencementResult,progressResult,exceptionResult,submissionResult])if(result.error)throw new Error(result.error.message);
    session=sessionResult.data;commencement=commencementResult.data;progress=progressResult.data||[];exceptions=exceptionResult.data||[];submissions=submissionResult.data||[];
  }

  const latestProgress=progress[0];
  const openExceptions=exceptions.filter(item=>['open','acknowledged'].includes(item.status));
  const partnerMismatch=Boolean(assignment&&commercialPartnerId&&assignment.partner_id!==commercialPartnerId);
  const noCommercialPartner=!commercialPartnerId||!commercialPartner;
  const sessionUsable=Boolean(session&&!['expired','revoked'].includes(String(session.status))&&new Date(session.expires_at).getTime()>Date.now());
  const baseUrl=process.env.NEXT_PUBLIC_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||'https://overflow-partner.vercel.app';
  const currentExecutionLink=sessionUsable?`${baseUrl}/execution/${createExecutionSessionToken(session.id)}`:null;
  const assignedScope=assignment?documents.find(doc=>doc.id===assignment.scope_document_id):null;
  const releaseScope=currentScopes.length===1?currentScopes[0]:null;
  const partnerName=commercialPartner?.company_name||'Execution Partner';
  const paymentReady=startPaymentGate.authorised;
  const readyForRelease=paymentReady&&project.project_stage==='ready_for_execution'&&!noCommercialPartner&&!partnerMismatch&&commercialPartner?.status==='approved'&&commercialPartner?.nda_signed&&Boolean(commercialPartner?.email)&&Boolean(releaseScope);
  const recordPaymentHref=`/workspace/payments?project=${id}&action=record-payment`;

  const releaseIssues=[
    ...(noCommercialPartner?['Accepted commercial Execution Partner is missing.']:[]),
    ...(partnerMismatch?['Existing release evidence does not match the accepted commercial Partner.']:[]),
    ...(commercialPartner&&!commercialPartner.nda_signed?['Execution Partner NDA readiness is incomplete.']:[]),
    ...(commercialPartner&&!commercialPartner.email?['Execution Partner recipient email is missing.']:[]),
    ...(paymentReady&&!releaseScope?[currentScopes.length>1?'Multiple current controlled scopes require resolution.':'Current approved controlled execution scope is missing.']:[]),
  ];

  let presentation:OperatingPresentation;
  if(!paymentReady&&!assignment){
    presentation={state:'Awaiting client payment',headline:'Awaiting client payment',summary:`Required to start: ${money(startPaymentGate.required,startPaymentGate.currency)} · Received: ${money(startPaymentGate.received,startPaymentGate.currency)}.`,tone:'waiting',waitingOn:{actor:'client',label:'Client'},nextAction:{label:'Record payment',available:true,kind:'navigate',href:recordPaymentHref,reason:'Execution remains locked until qualifying client money is received and cleared.'},blockers:[],warnings:[],completed:[],primaryActions:[]};
  }else if(releaseIssues.length){
    presentation={state:'Release basis needs attention',headline:'Release basis needs attention',summary:releaseIssues[0],tone:'attention',waitingOn:{actor:'internal',label:'Overflow Partner'},nextAction:{label:'Resolve release basis',available:false,kind:'act',reason:'The governed release basis must match the accepted commercial lineage.'},blockers:releaseIssues,warnings:[],completed:paymentReady?['Start payment received']:[],primaryActions:[]};
  }else if(!assignment||!sessionUsable){
    presentation={state:'Ready to release',headline:`Ready to release to ${partnerName}`,summary:'Partner, controlled scope, recipient and Project dates are inherited from governed lineage.',tone:'active',waitingOn:{actor:'internal',label:'Overflow Partner'},nextAction:{label:`Release to ${partnerName}`,available:readyForRelease,kind:'act',reason:'One governed release action creates the underlying assignment and secure Partner access.'},blockers:[],warnings:[],completed:['Start payment received'],primaryActions:[]};
  }else if(!commencement){
    presentation={state:'Waiting for Partner commencement',headline:`Waiting for ${partnerName} to start`,summary:'Work has been released. No internal action is required until the Partner confirms commencement.',tone:'waiting',waitingOn:{actor:'partner',label:partnerName},nextAction:{label:'Await Partner commencement',available:false,kind:'wait'},blockers:[],warnings:[],completed:['Partner release recorded'],primaryActions:[]};
  }else if(openExceptions.length){
    presentation={state:'Execution exception',headline:'Partner execution needs attention',summary:`${openExceptions.length} Partner exception${openExceptions.length===1?'':'s'} require resolution before progression.`,tone:'attention',waitingOn:{actor:'internal',label:'Overflow Partner'},nextAction:{label:'Resolve Partner exception',available:true,kind:'act'},blockers:openExceptions.map(item=>item.title),warnings:[],completed:['Partner commenced'],primaryActions:[]};
  }else if(submissions.length){
    presentation={state:'Partner delivery received',headline:'Partner delivery received',summary:'The current delivery package is available for governed Delivery review.',tone:'active',waitingOn:{actor:'internal',label:'Overflow Partner'},nextAction:{label:'Review delivery',available:true,kind:'review',href:`/workspace/projects/${id}/delivery`},blockers:[],warnings:[],completed:['Partner commenced'],primaryActions:[]};
  }else{
    presentation={state:'Partner execution',headline:`${partnerName} is executing Cycle ${assignment?.execution_cycle||1}`,summary:latestProgress?'The latest Partner update is shown below. No internal intervention is required unless work becomes off-plan.':'Execution is active. Await the next governed Partner update or delivery package.',tone:'waiting',waitingOn:{actor:'partner',label:partnerName},nextAction:{label:'Await Partner delivery',available:false,kind:'wait'},blockers:[],warnings:[],completed:['Partner commenced'],primaryActions:[]};
  }

  const header=<div><Link href={`/workspace/projects/${id}`} className="project-os-back">← Project 360</Link><p className="vp-kicker">Execution · {project.project_number}</p><h1>{project.title}</h1></div>;
  const notices=<>{query.success?<div className="project-os-notice success"><strong>{query.success}</strong></div>:null}{query.error?<div className="project-os-notice error"><strong>{query.error}</strong></div>:null}</>;

  const releaseAction=<ActionDialog title={`Release work to ${partnerName}`} description="This records the governed Partner release and creates secure Partner access underneath one operator action. The client start-payment gate is rechecked server-side before release." triggerLabel={`Release to ${partnerName}`} disabled={!readyForRelease||partnerMismatch}><div className="stack" style={{gap:16}}><EvidenceRow label="Start payment" value="Received and cleared" tone="complete"/><EvidenceRow label="Execution Partner" value={partnerName}/><EvidenceRow label="Controlled scope" value={releaseScope?`${releaseScope.reference} · ${releaseScope.title}`:'Current approved scope required'}/><EvidenceRow label="Recipient" value={commercialPartner?.email||'Email required'}/><EvidenceRow label="Committed due" value={formatDate(project.due_date)}/><form action={guardedReleasePartnerExecutionAction}><input type="hidden" name="project_id" value={id}/><button className="button" type="submit">Confirm release</button></form></div></ActionDialog>;

  const firstException=openExceptions[0];
  let nextAction:React.ReactNode;
  if(!paymentReady&&!assignment)nextAction=<Link className="button" href={recordPaymentHref}>Record payment</Link>;
  else if(releaseIssues.length)nextAction=<Link className="button secondary" href={releaseScope?`/workspace/projects/${id}`:`/workspace/documents?project=${id}`}>Resolve release basis</Link>;
  else if(!assignment||!sessionUsable)nextAction=releaseAction;
  else if(!commencement)nextAction=<p style={{color:'var(--op-muted)'}}>No internal action is required. The Partner owns the next move.</p>;
  else if(firstException)nextAction=<ActionDialog title={`Resolve exception · ${firstException.title}`} description="Record the governed resolution evidence. The exception remains in audit after completion." triggerLabel="Resolve Partner exception"><form action={resolveExecutionExceptionAction} className="stack"><input type="hidden" name="project_id" value={id}/><input type="hidden" name="exception_id" value={firstException.id}/><label>Resolution note<textarea name="resolution_note" rows={3} required placeholder="What resolved the execution blocker?"/></label><button className="button" type="submit">Resolve exception</button></form></ActionDialog>;
  else if(submissions.length)nextAction=<Link className="button" href={`/workspace/projects/${id}/delivery`}>Review delivery</Link>;
  else nextAction=<p style={{color:'var(--op-muted)'}}>Execution is progressing with the Partner. No intervention is required.</p>;

  const summary=<div className="vp-facts"><div className="vp-fact"><small>Execution Partner</small><strong>{partnerName}</strong></div><div className="vp-fact"><small>Controlled scope</small><strong>{assignedScope?assignedScope.reference:releaseScope?.reference||'Awaiting release'}</strong></div><div className="vp-fact"><small>Committed due</small><strong>{formatDate(assignment?.committed_due_date||project.due_date)}</strong></div><div className="vp-fact"><small>Cycle</small><strong>{assignment?.execution_cycle||1}</strong></div></div>;
  const readiness=releaseIssues.length?<div className="op-evidence-list">{releaseIssues.map(issue=><EvidenceRow key={issue} label="Unresolved" value={issue} tone="attention"/>)}</div>:undefined;

  const activities=commencement?<div className="stack" style={{gap:14}}>{latestProgress?<div><div className="vp-facts"><div className="vp-fact"><small>Partner state</small><strong>{stateLabel(latestProgress.progress_state)}</strong></div><div className="vp-fact"><small>Progress</small><strong>{latestProgress.percent_complete===null||latestProgress.percent_complete===undefined?'Partner reported':`${latestProgress.percent_complete}%`}</strong></div><div className="vp-fact"><small>Forecast</small><strong>{formatDate(latestProgress.forecast_delivery_date||commencement.forecast_delivery_date)}</strong></div><div className="vp-fact"><small>Updated</small><strong>{formatDate(latestProgress.submitted_at)}</strong></div></div>{latestProgress.work_in_progress?<p>{latestProgress.work_in_progress}</p>:null}</div>:<p style={{color:'var(--op-muted)'}}>Partner commencement is recorded. No progress update has been submitted yet.</p>}{openExceptions.length>0?<div className="stack" style={{gap:10}}>{openExceptions.map(item=><div className="project-os-check-row" key={item.id}><div><strong>{item.title}</strong><small>{stateLabel(item.severity)} · raised {formatDate(item.raised_at)}</small></div><ActionDialog title={`Resolve exception · ${item.title}`} description="Record the governed resolution evidence; do not change the raw exception status directly." triggerLabel="Resolve" triggerTone="secondary"><form action={resolveExecutionExceptionAction} className="stack"><input type="hidden" name="project_id" value={id}/><input type="hidden" name="exception_id" value={item.id}/><label>Resolution note<textarea name="resolution_note" rows={3} required placeholder="What resolved the execution blocker?"/></label><button className="button" type="submit">Resolve exception</button></form></ActionDialog></div>)}</div>:null}</div>:undefined;

  const latestSubmission=submissions[0];
  const evidence=latestSubmission?<div className="stack" style={{gap:12}}><EvidenceRow label="Current Partner delivery" value={latestSubmission.revision||`Execution cycle ${latestSubmission.execution_cycle||1}`} meta={`${formatDate(latestSubmission.submitted_at)} · ${stateLabel(latestSubmission.review_status)}`} tone="complete"/>{latestSubmission.delivery_summary?<p>{latestSubmission.delivery_summary}</p>:null}<Link className="button secondary" href={`/workspace/projects/${id}/delivery`}>Open Delivery review</Link></div>:undefined;

  const history=<div className="stack" style={{gap:12}}>{progress.slice(1,6).map(item=><div className="project-os-history-row" key={item.id}><span>→</span><div><strong>{stateLabel(item.progress_state)}</strong><small>{formatDate(item.submitted_at)}</small></div></div>)}{submissions.slice(1,6).map(item=><div className="project-os-history-row" key={item.id}><span>→</span><div><strong>{item.revision||`Delivery cycle ${item.execution_cycle||1}`}</strong><small>{formatDate(item.submitted_at)} · {stateLabel(item.review_status)}</small></div></div>)}{progress.length<=1&&submissions.length<=1?<p>No older execution evidence.</p>:null}</div>;

  const metadata=<div className="stack" style={{gap:14}}>{assignment?<div className="op-evidence-list"><EvidenceRow label="Partner release" value={partnerName} tone="complete"/><EvidenceRow label="Scope" value={assignedScope?`${assignedScope.reference} · ${assignedScope.title}`:'Controlled scope recorded'}/><EvidenceRow label="Recipient" value={assignment.partner_contact_email}/><EvidenceRow label="Committed due" value={formatDate(assignment.committed_due_date||project.due_date)}/></div>:null}{currentExecutionLink?<ProductDisclosure summary="Advanced Partner access"><div className="stack" style={{gap:12}}><EvidenceRow label="Access status" value="Active secure workspace" tone="complete" meta={`Expires ${formatDate(session.expires_at)}`}/><EvidenceRow label="Recipient" value={assignment?.partner_contact_email}/><label>Current secure Partner link<input readOnly value={currentExecutionLink}/></label><a className="button secondary" href={currentExecutionLink} target="_blank" rel="noreferrer">Open Partner workspace</a><form action={guardedGenerateExecutionLinkAction}><input type="hidden" name="project_id" value={id}/><button className="button secondary" type="submit">Replace Partner link</button><small style={{display:'block',marginTop:8}}>Replacing the link revokes the current one. Use this only for an access problem.</small></form></div></ProductDisclosure>:null}</div>;

  return <RecordWorkspace header={header} notices={notices} presentation={presentation} readiness={readiness} nextAction={nextAction} summary={summary} activities={activities} evidence={evidence} history={history} metadata={metadata}/>;
}
