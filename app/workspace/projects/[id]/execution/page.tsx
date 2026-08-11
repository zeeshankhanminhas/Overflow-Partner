import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { generateExecutionLinkAction, resolveExecutionExceptionAction, saveExecutionAssignmentAction } from './actions';

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function stateLabel(value?: string | null) { return String(value || 'not_released').replaceAll('_',' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
const metricValueStyle={fontSize:'clamp(1.45rem, 2.2vw, 2.2rem)',lineHeight:1.08,overflowWrap:'normal' as const,wordBreak:'normal' as const,hyphens:'none' as const};

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

  return <section className="stack" style={{gap:24,maxWidth:1180}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}><div><Link href={`/workspace/projects/${id}`} className="project-os-back">← Project 360</Link><p className="eyebrow" style={{marginTop:18}}>Partner execution · Controlled delivery</p><h1 style={{marginTop:8}}>{project.title}</h1><p className="lede">Control release, commencement, progress, exceptions and engineering delivery against the Partner and scope already approved by the commercial lifecycle.</p></div><span className={`status-pill ${commencementPending||partnerMismatch||noCommercialPartner?'attention':'success'}`}>{partnerMismatch?'Partner lineage mismatch':noCommercialPartner?'Commercial Partner missing':commencementPending?'Waiting on Partner commencement':'Controlled Partner execution'}</span></div>

    {query.success?<div className="card" style={{borderLeft:'3px solid var(--op-success)'}}><strong>{query.success}</strong></div>:null}
    {query.error?<div className="card" style={{borderLeft:'3px solid var(--op-danger)'}}><strong>{query.error}</strong></div>:null}
    {query.execution_link?<div className="card stack" style={{gap:10}}><p className="eyebrow">Secure Partner link</p><strong>Copy this now. Only the token hash is stored.</strong><input readOnly value={query.execution_link} onFocus={(event)=>event.currentTarget.select()}/><small>Generating another link revokes the previous active session.</small></div>:null}
    {partnerMismatch?<div className="card" style={{borderLeft:'3px solid var(--op-danger)'}}><strong>Execution assignment does not match the accepted commercial Partner.</strong><p>Do not release further work until the lineage is corrected. Normal Partner replacement is intentionally blocked.</p></div>:null}
    {noCommercialPartner?<div className="card" style={{borderLeft:'3px solid var(--op-danger)'}}><strong>Commercial Partner lineage is missing.</strong><p>Project execution cannot be configured until the accepted quotation resolves to governed Partner pricing.</p></div>:null}

    <div className="metric-grid"><article className="metric"><span>Project stage</span><strong style={metricValueStyle}>{stateLabel(project.project_stage)}</strong></article><article className="metric"><span>Execution state</span><strong style={metricValueStyle}>{stateLabel(assignment?.execution_state)}</strong></article><article className="metric"><span>Open Partner exceptions</span><strong style={metricValueStyle}>{openExceptions.length}</strong></article><article className="metric"><span>Partner updates</span><strong style={metricValueStyle}>{progress.length}</strong></article></div>

    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <article className="card stack" style={{gap:20}}>
        <div><p className="eyebrow">Execution assignment</p><h2>{assignment?'Controlled Partner assignment':'Configure Partner execution'}</h2><p>The accepted commercial Partner is the authorised execution party. The release must identify the current controlled Scope of Work or Statement of Work.</p></div>
        <form action={saveExecutionAssignmentAction} className="stack" style={{gap:16}}>
          <input type="hidden" name="project_id" value={id}/>
          <label>Execution Partner<select name="partner_id" required value={commercialPartnerId||''} readOnly><option value={commercialPartnerId||''}>{commercialPartner?.company_name||'Commercial Partner unavailable'}</option></select><small>Inherited from the accepted commercial position. Partner replacement requires separate change control.</small></label>
          <div className="grid gap-4 md:grid-cols-2"><label>Partner contact name<input name="partner_contact_name" defaultValue={assignment?.partner_contact_name||commercialPartner?.contact_name||''}/></label><label>Partner contact email<input name="partner_contact_email" type="email" required defaultValue={assignment?.partner_contact_email||commercialPartner?.email||''}/></label></div>
          <label>Controlled execution scope<select name="scope_document_id" required defaultValue={assignment?.scope_document_id||''}><option value="" disabled>Select approved controlled scope</option>{documents.map(doc=><option key={doc.id} value={doc.id}>{doc.reference} · {doc.title} · {String(doc.status).replaceAll('_',' ')}</option>)}</select><small>Only current approved/issued Scope of Work or Statement of Work records are eligible.</small></label>
          <div className="grid gap-4 md:grid-cols-3"><label>Planned start<input name="planned_start_date" type="date" defaultValue={assignment?.planned_start_date||project.start_date||''}/></label><label>Committed due<input name="committed_due_date" type="date" defaultValue={assignment?.committed_due_date||project.due_date||''}/></label><label>Reporting cadence<select name="reporting_cadence" defaultValue={assignment?.reporting_cadence||'milestone'}><option value="milestone">Milestone only</option><option value="daily">Daily</option><option value="every_2_business_days">Every 2 business days</option><option value="weekly">Weekly</option><option value="on_change">On change / exception</option></select></label></div>
          <label>Release notes<textarea name="release_notes" rows={4} defaultValue={assignment?.release_notes||''} placeholder="Instructions visible in the controlled execution context."/></label>
          <button className="button" type="submit" disabled={noCommercialPartner||partnerMismatch||documents.length===0}>{assignment?'Save execution controls':'Create execution assignment'}</button>
        </form>
      </article>

      <aside className="card stack" style={{gap:18}}><div><p className="eyebrow">Secure workspace</p><h2>Partner access</h2></div>{assignment?<><dl className="project-os-summary" style={{margin:0}}><div><dt>Partner</dt><dd>{commercialPartner?.company_name||'Not recorded'}</dd></div><div><dt>Recipient</dt><dd>{assignment.partner_contact_email}</dd></div><div><dt>Session</dt><dd>{session?stateLabel(session.status):'Not issued'}</dd></div><div><dt>Last opened</dt><dd>{session?.last_opened_at?formatDate(session.last_opened_at):'Never'}</dd></div></dl><form action={generateExecutionLinkAction}><input type="hidden" name="project_id" value={id}/><button className="button" type="submit" disabled={partnerMismatch||!assignment.scope_document_id}>{session?'Rotate secure execution link':'Generate secure execution link'}</button></form><small>The secure link exposes only the controlled execution context and lets the assigned Partner submit commencement, progress, exceptions and delivery evidence.</small></>:<p>Create the controlled execution assignment first.</p>}</aside>
    </div>

    {assignment?<>
      <article className="card stack" style={{gap:16}}><div><p className="eyebrow">Partner-reported execution</p><h2>Execution intelligence</h2><p>Partner reports remain attributable Partner evidence. Commencement controls entry into execution; routine progress reports do not independently move Project stage.</p></div><div className="grid gap-4 md:grid-cols-4"><div><small>Commencement</small><strong style={{display:'block',marginTop:6}}>{commencement?formatDate(commencement.submitted_at):'Awaiting'}</strong></div><div><small>Latest Partner state</small><strong style={{display:'block',marginTop:6}}>{latestProgress?stateLabel(latestProgress.progress_state):'No update'}</strong></div><div><small>Partner-reported progress</small><strong style={{display:'block',marginTop:6}}>{latestProgress?.percent_complete===null||latestProgress?.percent_complete===undefined?'Not stated':`${latestProgress.percent_complete}%`}</strong></div><div><small>Partner forecast</small><strong style={{display:'block',marginTop:6}}>{formatDate(latestProgress?.forecast_delivery_date||commencement?.forecast_delivery_date)}</strong></div></div>{latestProgress?<div style={{borderTop:'1px solid var(--op-border)',paddingTop:14}}><strong>Latest update · {formatDate(latestProgress.submitted_at)}</strong><p>{latestProgress.work_in_progress}</p></div>:<p>No Partner progress update has been submitted yet.</p>}</article>

      <div className="grid gap-5 md:grid-cols-2">
        <article className="card stack"><div><p className="eyebrow">Exceptions</p><h2>{openExceptions.length} open</h2></div>{exceptions.length?exceptions.slice(0,5).map(item=><div key={item.id} style={{borderTop:'1px solid var(--op-border)',paddingTop:12}}><strong>{item.title}</strong><p>{stateLabel(item.severity)} · {stateLabel(item.status)} · {formatDate(item.raised_at)}</p>{['open','acknowledged'].includes(item.status)?<form action={resolveExecutionExceptionAction} className="stack" style={{gap:8,marginTop:10}}><input type="hidden" name="project_id" value={id}/><input type="hidden" name="exception_id" value={item.id}/><label>Resolution note<textarea name="resolution_note" rows={2} required placeholder="What resolved the execution blocker?"/></label><button className="button secondary" type="submit">Resolve exception</button></form>:item.resolution_note?<small>Resolution · {item.resolution_note}</small>:null}</div>):<p>No Partner exceptions reported.</p>}</article>
        <article className="card stack"><div><p className="eyebrow">Delivery submissions</p><h2>{submissions.length} received</h2></div>{submissions.length?submissions.slice(0,5).map(item=><div key={item.id} style={{borderTop:'1px solid var(--op-border)',paddingTop:12}}><strong>{item.revision||`Execution cycle ${item.execution_cycle||1}`}</strong><p>{item.delivery_summary}</p><small>{formatDate(item.submitted_at)} · {stateLabel(item.review_status)}</small></div>):<p>No delivery submission received.</p>}</article>
      </div>
    </>:null}
  </section>;
}
