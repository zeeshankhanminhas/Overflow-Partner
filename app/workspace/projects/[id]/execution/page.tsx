import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { createExecutionSessionToken } from '@/lib/execution/sessionToken';
import { deliveryHealthLabel, deliverySubmissionLabel, partnerWorkPresentation, projectPhaseForStage, projectPhaseMeta } from '@/lib/presentation/projectJourney';
import { generateExecutionLinkAction, resolveExecutionExceptionAction, saveExecutionAssignmentAction } from './actions';

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function stateLabel(value?: string | null) { return String(value || 'not_released').replaceAll('_',' ').replace(/\b\w/g, (char) => char.toUpperCase()); }

export default async function PartnerExecutionControlPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string,string | undefined>>;
}) {
  const { id }=await params;const query=searchParams?await searchParams:{};const {supabase,organisationId}=await requireUserContext();
  const {data:project,error:projectError}=await supabase.from('projects').select('id,project_number,title,lead_id,quote_id,start_date,due_date,project_stage,status').eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(projectError)throw new Error(projectError.message);if(!project)notFound();

  const [assignmentResult,documentsResult]=await Promise.all([
    supabase.from('project_execution_assignments').select('*').eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
    supabase.from('documents').select('id,title,reference,status,revision_code,document_type').eq('organisation_id',organisationId).eq('project_id',id).in('document_type',['scope-of-work','statement-of-work']).in('status',['approved','issued','published']).eq('is_current_revision',true).order('created_at',{ascending:false}),
  ]);
  if(assignmentResult.error)throw new Error(assignmentResult.error.message);if(documentsResult.error)throw new Error(documentsResult.error.message);
  const assignment=assignmentResult.data;const documents=documentsResult.data||[];

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

  const latestProgress=progress[0];const openExceptions=exceptions.filter(item=>['open','acknowledged'].includes(item.status));const commencementPending=Boolean(assignment&&!commencement&&project.project_stage==='ready_for_execution');
  const partnerMismatch=Boolean(assignment&&commercialPartnerId&&assignment.partner_id!==commercialPartnerId);
  const noCommercialPartner=!commercialPartnerId||!commercialPartner;
  const sessionUsable=Boolean(session&&!['expired','revoked'].includes(String(session.status))&&new Date(session.expires_at).getTime()>Date.now());
  const baseUrl=process.env.NEXT_PUBLIC_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||'https://overflow-partner.vercel.app';
  const currentExecutionLink=sessionUsable?`${baseUrl}/execution/${createExecutionSessionToken(session.id)}`:null;
  const partnerName=commercialPartner?.company_name||'Execution Partner';
  const deliverySubmitted=assignment?.execution_state==='delivery_submitted';
  const partnerView=partnerWorkPresentation({stage:project.project_stage,executionState:assignment?.execution_state,commenced:Boolean(commencement),deliverySubmitted,openExceptions:openExceptions.length,partnerName});
  const projectPhase=projectPhaseMeta[projectPhaseForStage(project.project_stage)].label;
  const executionActive=Boolean(assignment&&!partnerMismatch&&!noCommercialPartner&&['ready_for_execution','in_progress','partner_correction'].includes(String(project.project_stage))&&!deliverySubmitted);
  const currentHeadline=partnerMismatch?'Partner assignment needs attention':noCommercialPartner?'Commercial Partner is missing':!assignment?'Set up Partner work':partnerView.status;
  const currentSummary=partnerMismatch?'The project assignment does not match the Partner selected through the accepted commercial position.':noCommercialPartner?'Partner work cannot be set up until the accepted commercial position identifies the Partner.':!assignment?'Confirm the Partner, approved scope, dates and reporting cadence before giving the Partner workspace access.':partnerView.summary;
  const nextAction=partnerMismatch||noCommercialPartner?'Resolve Partner assignment':!assignment?'Complete Partner setup':partnerView.next;
  const nextSummary=partnerMismatch||noCommercialPartner?'Return to the commercial/project record before releasing more work.':!assignment?'Use the setup section below to create the Partner assignment.':openExceptions.length?`${openExceptions.length} Partner exception${openExceptions.length===1?'':'s'} need attention.`:deliverySubmitted?'Partner work is complete for now. Overflow Partner owns the review.':latestProgress?`Latest delivery health: ${deliveryHealthLabel(latestProgress.progress_state)}${latestProgress.percent_complete===null||latestProgress.percent_complete===undefined?'':` · ${latestProgress.percent_complete}% reported`}.`:'No operator action is required unless the Partner reports a change, exception or delivery.';

  return <section className="stack" style={{gap:24,maxWidth:1180}}>
    <div><Link href={`/workspace/projects/${id}`} className="project-os-back">← Project 360</Link><p className="eyebrow" style={{marginTop:18}}>Partner work</p><h1 style={{marginTop:8}}>{project.title}</h1><p className="lede">See who owns the work now, the latest Partner-reported health and the next hand-off. Setup stays secondary.</p></div>

    {query.success?<div className="card" style={{borderLeft:'3px solid var(--op-success)'}}><strong>{query.success}</strong></div>:null}
    {query.error?<div className="card" style={{borderLeft:'3px solid var(--op-danger)'}}><strong>{query.error}</strong></div>:null}
    {query.execution_link?<div className="card" style={{borderLeft:'3px solid var(--op-success)'}}><strong>Partner access link created.</strong><p>It is available under Partner setup &amp; access below.</p></div>:null}
    {partnerMismatch?<div className="card" style={{borderLeft:'3px solid var(--op-danger)'}}><strong>Partner assignment does not match the accepted commercial Partner.</strong><p>Resolve the Partner selection before releasing more work.</p></div>:null}
    {noCommercialPartner?<div className="card" style={{borderLeft:'3px solid var(--op-danger)'}}><strong>Commercial Partner is missing.</strong><p>Partner work cannot be set up until the accepted commercial position identifies the Partner.</p></div>:null}

    <section className="operating-state" aria-label="Current Partner work state">
      <div className="operating-state__copy">
        <div className="operating-state__kicker"><span className="product-provenance product-provenance--partner"><i/>Partner work</span><span>{projectPhase}</span></div>
        <h2>{currentHeadline}</h2>
        <p>{currentSummary}</p>
        {assignment?<div className="operating-state__actions">{currentExecutionLink?<a className="button secondary" href={currentExecutionLink} target="_blank" rel="noreferrer">Open Partner workspace →</a>:null}<Link className="button secondary" href={`/workspace/projects/${id}/delivery`}>Open delivery work →</Link></div>:null}
      </div>
      <div className="operating-state__decision">
        <small>What happens next</small>
        <strong>{nextAction}</strong>
        <p>{nextSummary}</p>
        {!assignment&&!noCommercialPartner?<div className="operating-state__actions"><a className="button secondary" href="#execution-setup">Open setup →</a></div>:null}
        {(partnerMismatch||noCommercialPartner)?<div className="operating-state__actions"><Link className="button secondary" href={`/workspace/commercial-control?project=${id}`}>Open commercial control →</Link></div>:null}
        {openExceptions.length?<div className="operating-state__actions"><a className="button secondary" href="#partner-exceptions">Open exceptions →</a></div>:null}
      </div>
    </section>

    {assignment?<div className="vp-facts"><div className="vp-fact"><small>Execution Partner</small><strong>{partnerName}</strong></div><div className="vp-fact"><small>Current responsibility</small><strong>{partnerView.owner}</strong></div><div className="vp-fact"><small>Delivery health</small><strong>{openExceptions.length?'Blocked':deliveryHealthLabel(latestProgress?.progress_state)}</strong></div><div className="vp-fact"><small>Partner forecast</small><strong>{formatDate(latestProgress?.forecast_delivery_date||commencement?.forecast_delivery_date||assignment.committed_due_date||project.due_date)}</strong></div></div>:null}

    {assignment?<>
      <article className="card stack" style={{gap:16}}><div><p className="eyebrow">Latest Partner report</p><h2>{openExceptions.length?'Blocked':latestProgress?deliveryHealthLabel(latestProgress.progress_state):commencement?'Working':'Waiting to start'}</h2><p>{latestProgress?.work_in_progress||partnerView.summary}</p></div><div className="grid gap-4 md:grid-cols-4"><div><small>Commencement</small><strong style={{display:'block',marginTop:6}}>{commencement?formatDate(commencement.submitted_at):'Awaiting'}</strong></div><div><small>Delivery health</small><strong style={{display:'block',marginTop:6}}>{openExceptions.length?'Blocked':deliveryHealthLabel(latestProgress?.progress_state)}</strong></div><div><small>Progress reported</small><strong style={{display:'block',marginTop:6}}>{latestProgress?.percent_complete===null||latestProgress?.percent_complete===undefined?'Not stated':`${latestProgress.percent_complete}%`}</strong></div><div><small>Forecast</small><strong style={{display:'block',marginTop:6}}>{formatDate(latestProgress?.forecast_delivery_date||commencement?.forecast_delivery_date)}</strong></div></div>{latestProgress?<small>Latest update received {formatDate(latestProgress.submitted_at)}.</small>:null}</article>

      <div className="grid gap-5 md:grid-cols-2">
        <article id="partner-exceptions" className="card stack"><div><p className="eyebrow">Partner exceptions</p><h2>{openExceptions.length?`${openExceptions.length} open`:'None open'}</h2><p>{openExceptions.length?'Resolve only the exceptions that are blocking or changing delivery.':'No Partner exceptions need attention.'}</p></div>{exceptions.length?exceptions.slice(0,5).map(item=><div key={item.id} style={{borderTop:'1px solid var(--op-border)',paddingTop:12}}><strong>{item.title}</strong><p>{stateLabel(item.severity)} · {stateLabel(item.status)} · {formatDate(item.raised_at)}</p>{['open','acknowledged'].includes(item.status)?<form action={resolveExecutionExceptionAction} className="stack" style={{gap:8,marginTop:10}}><input type="hidden" name="project_id" value={id}/><input type="hidden" name="exception_id" value={item.id}/><label>Resolution note<textarea name="resolution_note" rows={2} required placeholder="What resolved the blocker?"/></label><button className="button secondary" type="submit">Resolve exception</button></form>:item.resolution_note?<small>Resolution · {item.resolution_note}</small>:null}</div>):null}</article>
        <article className="card stack"><div><p className="eyebrow">Partner delivery</p><h2>{submissions.length?`${submissions.length} received`:'Nothing received yet'}</h2><p>{submissions.length?'Submitted deliveries are available for review in delivery work.':'The Partner has not submitted a delivery package yet.'}</p></div>{submissions.length?submissions.slice(0,5).map(item=><div key={item.id} style={{borderTop:'1px solid var(--op-border)',paddingTop:12}}><strong>{deliverySubmissionLabel(item.execution_cycle,item.revision)}</strong><p>{item.delivery_summary}</p><small>{formatDate(item.submitted_at)} · {stateLabel(item.review_status)}</small></div>):null}<Link className="button secondary" href={`/workspace/projects/${id}/delivery`}>Open delivery work →</Link></article>
      </div>
    </>:null}

    <details id="execution-setup" className="vp-disclosure" open={!assignment||partnerMismatch||noCommercialPartner}>
      <summary>Partner setup &amp; access</summary>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]" style={{paddingTop:18}}>
        <article className="card stack" style={{gap:20}}>
          <div><p className="eyebrow">Partner setup</p><h2>{assignment?'Partner assignment':'Set up Partner work'}</h2><p>The Partner comes from the accepted commercial position. Confirm the approved scope, dates and reporting cadence used for this project.</p></div>
          <form action={saveExecutionAssignmentAction} className="stack" style={{gap:16}}>
            <input type="hidden" name="project_id" value={id}/>
            <label>Execution Partner<select name="partner_id" required defaultValue={commercialPartnerId||''}><option value={commercialPartnerId||''}>{commercialPartner?.company_name||'Commercial Partner unavailable'}</option></select><small>Inherited from the accepted commercial position. The Partner cannot be replaced here.</small></label>
            <div className="grid gap-4 md:grid-cols-2"><label>Partner contact name<input name="partner_contact_name" defaultValue={assignment?.partner_contact_name||commercialPartner?.contact_name||''}/></label><label>Partner contact email<input name="partner_contact_email" type="email" required defaultValue={assignment?.partner_contact_email||commercialPartner?.email||''}/></label></div>
            <label>Approved scope<select name="scope_document_id" required defaultValue={assignment?.scope_document_id||''}><option value="" disabled>Select approved scope</option>{documents.map(doc=><option key={doc.id} value={doc.id}>{doc.reference} · {doc.title} · {String(doc.status).replaceAll('_',' ')}</option>)}</select><small>Only the current approved or issued Scope of Work / Statement of Work can be used.</small></label>
            <div className="grid gap-4 md:grid-cols-3"><label>Planned start<input name="planned_start_date" type="date" defaultValue={assignment?.planned_start_date||project.start_date||''}/></label><label>Committed due<input name="committed_due_date" type="date" defaultValue={assignment?.committed_due_date||project.due_date||''}/></label><label>Reporting cadence<select name="reporting_cadence" defaultValue={assignment?.reporting_cadence||'milestone'}><option value="milestone">Milestone only</option><option value="daily">Daily</option><option value="every_2_business_days">Every 2 business days</option><option value="weekly">Weekly</option><option value="on_change">On change / exception</option></select></label></div>
            <label>Partner instructions<textarea name="release_notes" rows={4} defaultValue={assignment?.release_notes||''} placeholder="Instructions visible to the Partner."/></label>
            <button className="button" type="submit" disabled={noCommercialPartner||partnerMismatch||documents.length===0}>{assignment?'Save Partner setup':'Set up Partner work'}</button>
          </form>
        </article>

        <aside className="card stack" style={{gap:18}}><div><p className="eyebrow">Partner access</p><h2>Workspace access</h2><p>Create or replace the Partner access link only when needed.</p></div>{assignment?<><dl className="project-os-summary" style={{margin:0}}><div><dt>Partner</dt><dd>{partnerName}</dd></div><div><dt>Recipient</dt><dd>{assignment.partner_contact_email}</dd></div><div><dt>Link status</dt><dd>{sessionUsable?'Active':session?stateLabel(session.status):'Not created'}</dd></div><div><dt>Last opened</dt><dd>{session?.last_opened_at?formatDate(session.last_opened_at):'Never'}</dd></div></dl>{currentExecutionLink?<><a className="button" href={currentExecutionLink} target="_blank" rel="noreferrer">Open Partner workspace</a><label>Current Partner access link<input readOnly value={currentExecutionLink}/><small>Copy this URL when it needs to be sent to the assigned Partner.</small></label><details className="vp-disclosure"><summary>Replace Partner access link</summary><form action={generateExecutionLinkAction} style={{paddingTop:12}}><input type="hidden" name="project_id" value={id}/><button className="button secondary" type="submit" disabled={partnerMismatch||!assignment.scope_document_id}>Replace access link</button><small style={{display:'block',marginTop:8}}>Replacing the link revokes the current one. Do this only when the existing link should no longer be used.</small></form></details></>:<form action={generateExecutionLinkAction}><input type="hidden" name="project_id" value={id}/><button className="button" type="submit" disabled={partnerMismatch||!assignment.scope_document_id}>Create Partner access link</button></form>}<small>The access link only exposes this Partner's project context and lets them confirm start, report progress or exceptions, and submit delivery evidence.</small></>:<p>Complete Partner setup first.</p>}</aside>
      </div>
    </details>
  </section>;
}