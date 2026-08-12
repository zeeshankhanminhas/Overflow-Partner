import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { createExecutionSessionToken } from '@/lib/execution/sessionToken';
import { resolveProjectStartPaymentGate } from '@/lib/finance/startPayment';
import { resolveExecutionExceptionAction } from './actions';
import { guardedGenerateExecutionLinkAction, guardedReleasePartnerExecutionAction } from './guardedActions';
import { ActionDialog, ContextDrawer, EvidenceRow, ProductDisclosure } from '@/components/workspace/InteractionPrimitives';

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

  const state=!paymentReady&&!assignment?'Awaiting client payment':partnerMismatch?'Release basis needs attention':noCommercialPartner?'Commercial Partner missing':!assignment||!sessionUsable?'Ready to release':!commencement?'Waiting for Partner commencement':'Partner execution';
  const tone=partnerMismatch||noCommercialPartner?'attention':!paymentReady&&!assignment?'neutral':commencement?'success':'neutral';

  return <section className="stack" style={{gap:24,maxWidth:1040}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><Link href={`/workspace/projects/${id}`} className="project-os-back">← Project 360</Link><p className="eyebrow" style={{marginTop:18}}>Partner execution</p><h1 style={{marginTop:8}}>{project.title}</h1><p className="lede">Release the approved work to the Execution Partner, then follow only the Partner update, exceptions and delivery that need your attention.</p></div>
      <span className={`status-pill ${tone}`}>{state}</span>
    </div>

    {query.success?<div className="card" style={{borderLeft:'3px solid var(--op-success)'}}><strong>{query.success}</strong></div>:null}
    {query.error?<div className="card" style={{borderLeft:'3px solid var(--op-danger)'}}><strong>{query.error}</strong></div>:null}

    {!paymentReady&&!assignment ? <article className="card stack" style={{gap:14}}>
      <div><p className="eyebrow">Commercial start gate</p><h2>Awaiting client payment</h2><p>Partner release is unavailable until the required client start payment has actually been received and cleared.</p></div>
      <div className="grid gap-4 md:grid-cols-2"><EvidenceRow label="Required to start" value={money(startPaymentGate.required,startPaymentGate.currency)} tone="waiting"/><EvidenceRow label="Received" value={money(startPaymentGate.received,startPaymentGate.currency)} /></div>
      <Link className="button" href={`/workspace/payments?project=${id}`}>Record payment</Link>
    </article> : null}

    {paymentReady&&(!assignment||!sessionUsable) ? <article className="card stack" style={{gap:18}}>
      <div><p className="eyebrow">Next action</p><h2>Release to {partnerName}</h2><p>The system inherits the accepted Partner, current controlled scope and Project dates. You do not need to create or manage an assignment record.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div><small>Execution Partner</small><strong style={{display:'block',marginTop:5}}>{partnerName}</strong>{commercialPartner?<span style={{display:'block',marginTop:4}}>{commercialPartner.status==='approved'&&commercialPartner.nda_signed?'Approved · NDA ready':'Partner readiness incomplete'}</span>:null}</div>
        <div><small>Controlled scope</small><strong style={{display:'block',marginTop:5}}>{releaseScope?`${releaseScope.reference} · ${releaseScope.title}`:currentScopes.length>1?'Multiple current scopes need resolution':'No current approved scope'}</strong></div>
        <div><small>Recipient</small><strong style={{display:'block',marginTop:5}}>{commercialPartner?.contact_name||'Partner contact'}{commercialPartner?.email?` · ${commercialPartner.email}`:' · Email required'}</strong></div>
        <div><small>Due</small><strong style={{display:'block',marginTop:5}}>{formatDate(project.due_date)}</strong></div>
      </div>
      {partnerMismatch?<p className="vp-callout">The existing execution record does not match the accepted commercial Partner. Resolve the lineage before release.</p>:null}
      {currentScopes.length>1?<p className="vp-callout">More than one current controlled execution scope is available. Resolve the current scope in Documents before release.</p>:null}
      <ActionDialog
        title={`Release work to ${partnerName}`}
        description="This creates the governed execution assignment and Partner access underneath one operator action. The client start-payment gate is rechecked server-side before release."
        triggerLabel={`Release to ${partnerName}`}
        disabled={!readyForRelease||partnerMismatch}
      >
        <div className="stack" style={{gap:16}}>
          <EvidenceRow label="Start payment" value="Received and cleared" tone="complete" />
          <EvidenceRow label="Execution Partner" value={partnerName} />
          <EvidenceRow label="Controlled scope" value={releaseScope?`${releaseScope.reference} · ${releaseScope.title}`:'Current approved scope required'} />
          <EvidenceRow label="Recipient" value={commercialPartner?.email||'Email required'} />
          <EvidenceRow label="Committed due" value={formatDate(project.due_date)} />
          <form action={guardedReleasePartnerExecutionAction}><input type="hidden" name="project_id" value={id}/><button className="button" type="submit">Confirm release</button></form>
        </div>
      </ActionDialog>
    </article> : null}

    {assignment&&sessionUsable ? <article className="card stack" style={{gap:18}}>
      <div><p className="eyebrow">Current execution</p><h2>{commencement?`${partnerName} is executing Cycle ${assignment.execution_cycle||1}`:`Waiting for ${partnerName} to start`}</h2><p>{commencement?`Commencement confirmed ${formatDate(commencement.submitted_at)}. The next Partner evidence is a progress update or delivery package.`:'Work has been released. The Project will move forward when the Partner confirms commencement from the secure workspace.'}</p></div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{currentExecutionLink?<a className="button" href={currentExecutionLink} target="_blank" rel="noreferrer">Open Partner workspace</a>:null}{currentExecutionLink?<ContextDrawer title="Advanced Partner access" description="Security and access controls are exceptional context, not permanent Project controls." triggerLabel="Advanced Partner access"><div className="stack" style={{gap:16}}><EvidenceRow label="Recipient" value={assignment.partner_contact_email}/><EvidenceRow label="Access status" value="Active secure workspace" tone="complete" meta={`Expires ${formatDate(session.expires_at)}`}/><label>Current secure Partner link<input readOnly value={currentExecutionLink}/></label><form action={guardedGenerateExecutionLinkAction}><input type="hidden" name="project_id" value={id}/><button className="button secondary" type="submit">Replace Partner link</button><small style={{display:'block',marginTop:8}}>Replacing the link revokes the current one. Use this only for an access problem.</small></form></div></ContextDrawer>:null}</div>
      <ProductDisclosure summary="Release evidence">
        <EvidenceRow label="Partner" value={partnerName} tone="complete" />
        <EvidenceRow label="Scope" value={assignedScope?`${assignedScope.reference} · ${assignedScope.title}`:'Controlled scope recorded'} />
        <EvidenceRow label="Recipient" value={assignment.partner_contact_email} />
        <EvidenceRow label="Committed due" value={formatDate(assignment.committed_due_date||project.due_date)} />
      </ProductDisclosure>
    </article> : null}

    {latestProgress ? <article className="card stack" style={{gap:14}}>
      <div><p className="eyebrow">Latest Partner update</p><h2>{stateLabel(latestProgress.progress_state)}</h2></div>
      <div className="grid gap-4 md:grid-cols-3"><div><small>Progress</small><strong style={{display:'block',marginTop:5}}>{latestProgress.percent_complete===null||latestProgress.percent_complete===undefined?'Not stated':`${latestProgress.percent_complete}%`}</strong></div><div><small>Forecast</small><strong style={{display:'block',marginTop:5}}>{formatDate(latestProgress.forecast_delivery_date||commencement?.forecast_delivery_date)}</strong></div><div><small>Updated</small><strong style={{display:'block',marginTop:5}}>{formatDate(latestProgress.submitted_at)}</strong></div></div>{latestProgress.work_in_progress?<p>{latestProgress.work_in_progress}</p>:null}
    </article> : null}

    {openExceptions.length>0 ? <article className="card stack" style={{gap:16}}>
      <div><p className="eyebrow">Needs attention</p><h2>{openExceptions.length} Partner exception{openExceptions.length===1?'':'s'}</h2></div>
      {openExceptions.map(item=><div key={item.id} style={{borderTop:'1px solid var(--op-border)',paddingTop:12}}><strong>{item.title}</strong><p>{stateLabel(item.severity)} · raised {formatDate(item.raised_at)}</p><form action={resolveExecutionExceptionAction} className="stack" style={{gap:8,marginTop:10}}><input type="hidden" name="project_id" value={id}/><input type="hidden" name="exception_id" value={item.id}/><label>Resolution note<textarea name="resolution_note" rows={2} required placeholder="What resolved the execution blocker?"/></label><button className="button secondary" type="submit">Resolve exception</button></form></div>)}
    </article> : null}

    {submissions.length>0 ? <article className="card stack" style={{gap:14}}>
      <div><p className="eyebrow">Partner delivery</p><h2>{submissions.length} submission{submissions.length===1?'':'s'} received</h2></div>
      {submissions.slice(0,5).map(item=><div key={item.id} style={{borderTop:'1px solid var(--op-border)',paddingTop:12}}><strong>{item.revision||`Execution cycle ${item.execution_cycle||1}`}</strong><p>{item.delivery_summary}</p><small>{formatDate(item.submitted_at)} · {stateLabel(item.review_status)}</small></div>)}
      <Link className="button secondary" href={`/workspace/projects/${id}/delivery`}>Review delivery</Link>
    </article> : null}
  </section>;
}