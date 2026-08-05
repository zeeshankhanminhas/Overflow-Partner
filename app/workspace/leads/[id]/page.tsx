import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { listWorkflowCases } from '@/lib/orchestration/service';
import { acceptQuoteAction, approveCommercialAction, approveIntakeAction, createCommercialReviewAction, createIntakeShellAction, issueQuoteAction } from '../../orchestration/actions';
import { createPartnerReviewRequestAction, decidePartnerReviewAction } from './actions';
import { eventLabel, partnerReviewNextAction, workspaceLabel } from '@/lib/presentation/vocabulary';
import MarginSimulator from './MarginSimulator';

const dateTime = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Not recorded';

function Field({ name, value, source }: { name: string; value: string | number | null | undefined; source?: string }) {
  return <div><p className="eyebrow" style={{ marginBottom: 5 }}>{name}</p><strong>{value ?? 'Not recorded'}</strong>{source ? <p style={{ margin: '4px 0 0', fontSize: 12 }}>Source: {source}</p> : null}</div>;
}

function Check({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, borderTop: '1px solid var(--line)', paddingTop: 11, marginTop: 11 }}><span>{label}{detail ? <small style={{ display: 'block', marginTop: 3 }}>{detail}</small> : null}</span><strong>{ok ? '✓' : '—'}</strong></div>;
}

function money(currency: string | null | undefined, amount: number | string | null | undefined) {
  if (amount === null || amount === undefined) return 'Not recorded';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(Number(amount));
}

export default async function Case360Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const workflow = (await listWorkflowCases(supabase, organisationId)).find((item) => item.lead.id === id);
  if (!workflow) notFound();

  const [activityResult, documentsResult, partnersResult, reviewsResult] = await Promise.all([
    supabase.from('activity_events').select('*').eq('organisation_id', organisationId).eq('entity_type', 'lead').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('documents').select('*').eq('organisation_id', organisationId).eq('entity_type', 'lead').eq('entity_id', id).order('created_at', { ascending: false }),
    supabase.from('partners').select('id,company_name,status,nda_signed').eq('organisation_id', organisationId).eq('status', 'approved').eq('nda_signed', true).order('company_name'),
    supabase.from('partner_review_requests').select('*, partner:partners(id,company_name,nda_signed), responses:partner_review_responses(*), decisions:partner_review_internal_decisions(*), files:partner_review_files(id)').eq('organisation_id', organisationId).eq('lead_id', id).order('created_at', { ascending: false }),
  ]);

  const activity = activityResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const partners = partnersResult.data ?? [];
  const reviewSchemaReady = !reviewsResult.error;
  const review = ((reviewsResult.data ?? []) as any[])[0] as any | undefined;
  const response = [...(review?.responses ?? [])].sort((a: any, b: any) => Number(b.revision) - Number(a.revision))[0];
  const decision = [...(review?.decisions ?? [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  const technicalApproved = workflow.technicalIntake?.status === 'approved';
  const partnerApproved = ['approved', 'approved_with_conditions'].includes(review?.status);
  const lastActivity = activity[0]?.created_at || workflow.lead.updated_at || workflow.lead.created_at;

  let currentStatus = 'New enquiry';
  let currentPosition = 'Case qualification';
  let nextAction = 'Create inherited technical scope';
  let reason = 'The case exists, but its governed technical scope has not been created.';
  let completion = 'Create the technical scope from the existing case context.';
  let blocker: string | null = null;
  let actionKey = 'create_scope';

  if (workflow.technicalIntake && !technicalApproved) { currentStatus = 'Technical scope under review'; currentPosition = 'Technical scope'; nextAction = 'Approve technical scope'; reason = 'The inherited scope is ready for an internal engineering decision.'; completion = 'Approve the scope before any partner access is allowed.'; actionKey = 'approve_scope'; }
  if (technicalApproved && !review) { currentStatus = 'Ready for partner review'; currentPosition = 'Partner selection'; nextAction = 'Select execution partner'; reason = 'The approved scope is ready to be issued to an NDA-compliant partner.'; completion = 'Choose a partner, due date, files and visibility settings.'; actionKey = 'create_partner_review'; }
  if (review && !response) { currentStatus = 'Awaiting partner response'; currentPosition = 'Partner review'; nextAction = partnerReviewNextAction(review.status, false); reason = 'The controlled request has been issued and no structured response has been received.'; completion = 'The partner submits a combined technical and commercial response.'; blocker = 'Waiting on the execution partner.'; actionKey = 'wait_partner'; }
  if (review?.status === 'submitted' && response) { currentStatus = 'Partner response received'; currentPosition = 'Internal technical decision'; nextAction = 'Complete internal technical decision'; reason = 'The partner submitted technical feasibility and commercial pricing together.'; completion = 'Approve, approve with conditions, request clarification, or reject.'; blocker = 'Commercial progression remains locked until this decision is recorded.'; actionKey = 'decide_partner'; }
  if (review?.status === 'clarification_required') { currentStatus = 'Clarification required'; currentPosition = 'Partner revision'; nextAction = 'Await revised partner response'; reason = 'A formal clarification request is open.'; completion = 'The partner submits a revision through the same controlled review.'; blocker = 'Waiting on revised partner evidence.'; actionKey = 'wait_partner'; }
  if (partnerApproved && workflow.partnerQuote && !workflow.commercialReview) { currentStatus = 'Ready for commercial review'; currentPosition = 'Commercial decision'; nextAction = 'Set commercial margin'; reason = 'Technical approval and partner pricing are complete.'; completion = 'Choose the markup. All other commercial facts are inherited.'; actionKey = 'create_commercial'; }
  if (workflow.commercialReview && !workflow.clientQuote) { currentStatus = 'Commercial decision required'; currentPosition = 'Quote approval'; nextAction = 'Approve commercial position and generate quote'; reason = 'The client price has been calculated from the approved partner cost and margin.'; completion = 'Approve the commercial position. Quote values will be generated without re-keying.'; actionKey = 'generate_quote'; }
  if (workflow.clientQuote && ['draft', 'internal_review'].includes(workflow.clientQuote.status)) { currentStatus = 'Draft quote ready'; currentPosition = 'Client quote'; nextAction = 'Issue client quote'; reason = 'A controlled draft quote has been generated from the approved commercial decision.'; completion = 'Issue the quote to move the case to client decision.'; actionKey = 'issue_quote'; }
  if (workflow.clientQuote?.status === 'issued' && !workflow.project) { currentStatus = 'Awaiting client decision'; currentPosition = 'Client decision'; nextAction = 'Record acceptance and create project'; reason = 'The quote is issued and awaiting the client outcome.'; completion = 'Record acceptance to create the project transactionally.'; actionKey = 'accept_quote'; }
  if (workflow.project) { currentStatus = workflow.project.status === 'active' ? 'Active project' : 'Project ready'; currentPosition = 'Project delivery'; nextAction = 'Open active project'; reason = 'The accepted case has been converted into a governed delivery record.'; completion = 'Continue delivery from the project workspace.'; actionKey = 'open_project'; }

  const caseReference = review?.case_reference || `OP-CASE-${workflow.lead.id.slice(0, 8).toUpperCase()}`;
  const healthChecks = [Boolean(workflow.lead.company_name), Boolean(workflow.lead.contact_name || workflow.lead.contact_email), Boolean(workflow.technicalIntake), technicalApproved, !review || Boolean(review.partner), !response || !response.missing_information, !response || Number(response.confidence_percent || 0) >= 70, !workflow.partnerQuote || Number(workflow.partnerQuote.price || 0) > 0];
  const health = Math.round((healthChecks.filter(Boolean).length / healthChecks.length) * 100);
  const warnings = [response?.missing_information, response?.technical_risks, blocker].filter(Boolean).length;
  const milestones = [
    ['Case qualified', true],
    ['Technical scope approved', technicalApproved],
    ['Partner review issued', Boolean(review)],
    ['Partner response received', Boolean(response)],
    ['Technical decision recorded', partnerApproved],
    ['Commercial position approved', Boolean(workflow.commercialReview)],
    ['Quote generated', Boolean(workflow.clientQuote)],
    ['Quote issued', ['issued', 'accepted'].includes(workflow.clientQuote?.status || '')],
    ['Project created', Boolean(workflow.project)],
  ] as const;

  const successTitle = query.success || (query.partnerReviewDecision ? 'Technical decision recorded' : query.partnerReviewCreated ? 'Partner review created' : null);

  return <section>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div><p className="eyebrow">Case 360 · {caseReference}</p><h1>{workflow.lead.title || workflow.lead.company_name}</h1><p className="lede">Where the case is, why it is there, and the one decision that moves it forward.</p></div>
      <Link className="button secondary" href="/workspace/leads">All cases</Link>
    </header>

    {successTitle ? <section className="card" style={{ marginTop: 20, borderLeft: '3px solid var(--accent)' }}><p className="eyebrow">Decision recorded</p><h3>{String(successTitle)}</h3><p>Current status: <strong>{currentStatus}</strong></p><p>Next: <strong>{nextAction}</strong></p>{query.reviewUrl ? <p style={{ overflowWrap: 'anywhere' }}>{String(query.reviewUrl)}</p> : null}</section> : null}
    {query.error ? <section className="card" style={{ marginTop: 20, borderLeft: '3px solid #b42318' }}><p className="eyebrow">Action could not be completed</p><h3>{String(query.error)}</h3><p>The current case and its evidence have been preserved.</p></section> : null}

    <section className="card" style={{ marginTop: 24, borderLeft: '4px solid var(--accent)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 18 }}>
        <Field name="Case" value={caseReference} /><Field name="Company" value={workflow.lead.company_name} /><Field name="Owner" value={workflow.lead.owner_id ? 'Assigned' : 'Unassigned'} /><Field name="Deadline" value={workflow.technicalIntake?.deadline || 'Not recorded'} /><Field name="Health" value={`${health}%`} /><Field name="Current decision" value={currentPosition} />
      </div>
    </section>

    <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0,1fr) minmax(310px,370px)', gap: 22, marginTop: 22, alignItems: 'start' }}>
      <aside style={{ display: 'grid', gap: 18 }}>
        <section className="card"><p className="eyebrow">Case health</p><h2>{health}%</h2><Field name="Warnings" value={warnings || 'None'} /><div style={{ marginTop: 14 }}><Field name="Missing information" value={response?.missing_information ? 'Recorded' : 'None'} /></div><div style={{ marginTop: 14 }}><Field name="Partner confidence" value={response ? `${response.confidence_percent}%` : 'Not yet available'} /></div><div style={{ marginTop: 14 }}><Field name="Risk" value={response?.technical_risks ? 'Review required' : 'Low'} /></div></section>
        <section className="card"><p className="eyebrow">Milestones</p>{milestones.map(([label, done]) => <div key={label} style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 10 }}><strong>{done ? '✓' : '○'}</strong><span>{label}</span></div>)}</section>
      </aside>

      <main style={{ display: 'grid', gap: 20 }}>
        <section className="card"><p className="eyebrow">Case decision</p><h2>{currentPosition}</h2><p>{reason}</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginTop: 18 }}><Field name="Current status" value={currentStatus} /><Field name="Next decision" value={nextAction} /><Field name="Completion" value={completion} /><Field name="Blocked by" value={blocker || 'Nothing'} /></div></section>

        <details className="card" open><summary><strong>Inherited case context</strong></summary><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 18, marginTop: 18 }}><Field name="Project" value={workflow.lead.title || workflow.lead.company_name} source="Case record" /><Field name="Project type" value={workflow.technicalIntake?.project_type || workflow.lead.project_type} source="Customer intake" /><Field name="Discipline" value={workflow.technicalIntake?.discipline} source="Technical scope" /><Field name="Deliverables" value={workflow.technicalIntake?.deliverables || workflow.lead.service} source="Technical scope" /><Field name="Documents" value={documents.length} source="Controlled documents" /></div><div style={{ marginTop: 18 }}><Field name="Scope" value={workflow.technicalIntake?.description || workflow.lead.notes} source="Approved case context" /></div></details>

        {response ? <details className="card" open={actionKey === 'decide_partner'}><summary><strong>Partner evidence pack · Revision {response.revision}</strong></summary><div style={{ marginTop: 18 }}><h3>Technical</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}><Field name="Feasibility" value={workspaceLabel(response.feasibility, 'feasibility')} /><Field name="Confidence" value={`${response.confidence_percent}%`} /><Field name="Capacity" value={workspaceLabel(response.capacity_status, 'capacity')} /><Field name="Hours" value={response.estimated_engineering_hours} /><Field name="Lead time" value={response.estimated_lead_time_days ? `${response.estimated_lead_time_days} days` : null} /></div><div style={{ display: 'grid', gap: 14, marginTop: 16 }}><Field name="Approach" value={response.proposed_delivery_approach} /><Field name="Assumptions" value={response.assumptions} /><Field name="Risks" value={response.technical_risks} /><Field name="Missing information" value={response.missing_information} /><Field name="Exclusions" value={response.exclusions} /></div></div>{workflow.partnerQuote ? <div style={{ borderTop: '1px solid var(--line)', marginTop: 20, paddingTop: 18 }}><h3>Commercial</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}><Field name="Price" value={money(workflow.partnerQuote.currency, workflow.partnerQuote.price)} /><Field name="Valid until" value={workflow.partnerQuote.valid_until} /><Field name="Payment terms" value={(workflow.partnerQuote as any).payment_terms} /><Field name="Delivery commitment" value={(workflow.partnerQuote as any).delivery_commitment} /><Field name="Quote reference" value={(workflow.partnerQuote as any).quote_reference} /></div></div> : null}</details> : null}

        {actionKey === 'decide_partner' ? <section className="card"><p className="eyebrow">Decision evidence</p><h2>Technical approval basis</h2><Check label="Technical feasibility confirmed" ok={['feasible', 'feasible_with_conditions'].includes(response.feasibility)} /><Check label="Capacity available" ok={response.capacity_status === 'available'} /><Check label="Commercial response submitted" ok={Boolean(workflow.partnerQuote)} /><Check label="Missing information cleared" ok={!response.missing_information} /><Check label="Confidence threshold met" ok={Number(response.confidence_percent) >= 70} detail={`${response.confidence_percent}% submitted`} /></section> : null}

        {workflow.commercialReview ? <section className="card"><p className="eyebrow">Quote preview</p><h2>{workflow.clientQuote ? workflow.clientQuote.quote_number : 'Controlled draft values'}</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16 }}><Field name="Client" value={workflow.lead.company_name} /><Field name="Project" value={workflow.lead.title || workflow.lead.company_name} /><Field name="Subtotal" value={money(workflow.partnerQuote?.currency, workflow.commercialReview.client_price)} /><Field name="VAT · 20%" value={money(workflow.partnerQuote?.currency, Number(workflow.commercialReview.client_price || 0) * 0.2)} /><Field name="Total" value={money(workflow.partnerQuote?.currency, Number(workflow.commercialReview.client_price || 0) * 1.2)} /></div></section> : null}

        {workflow.project ? <section className="card"><p className="eyebrow">Project readiness</p><h2>Accepted case handover</h2><Check label="Commercial approved" ok={Boolean(workflow.commercialReview)} /><Check label="Client accepted" ok={workflow.clientQuote?.status === 'accepted'} /><Check label="Technical scope" ok={technicalApproved} /><Check label="Execution partner" ok={Boolean(review?.partner)} /><Check label="Controlled documents" ok={documents.length > 0} /></section> : null}

        <details className="card"><summary><strong>Case history</strong></summary><div style={{ marginTop: 16 }}>{activity.length ? activity.slice(0, 10).map((event: any) => <div key={event.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}><strong>{eventLabel(event.event_type)}</strong><p>{dateTime(event.created_at)}</p></div>) : <p>No case activity recorded.</p>}</div></details>
      </main>

      <aside className="card" style={{ borderTop: '4px solid var(--accent)', position: 'sticky', top: 20 }}>
        <p className="eyebrow">Next permitted action</p><h2>{nextAction}</h2><p>{reason}</p><div style={{ borderTop: '1px solid var(--line)', marginTop: 18, paddingTop: 18 }}><p className="eyebrow">Completion</p><p>{completion}</p></div>{blocker ? <div style={{ borderTop: '1px solid var(--line)', marginTop: 18, paddingTop: 18 }}><p className="eyebrow">Blocked by</p><strong>{blocker}</strong></div> : null}
        {!reviewSchemaReady ? <p>Partner review is unavailable until its schema is ready.</p> : null}
        <div style={{ marginTop: 22 }}>
          {actionKey === 'create_scope' ? <form action={createIntakeShellAction}><input type="hidden" name="lead_id" value={id} /><button className="button">Create technical scope</button></form> : null}
          {actionKey === 'approve_scope' ? <form action={approveIntakeAction}><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="intake_id" value={workflow.technicalIntake?.id} /><button className="button">Approve technical scope</button></form> : null}
          {actionKey === 'create_partner_review' ? <form action={createPartnerReviewRequestAction} className="stack"><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="technical_intake_id" value={workflow.technicalIntake?.id} /><label>Execution partner<select name="partner_id" required defaultValue=""><option value="">Select partner</option>{partners.map((partner: any) => <option key={partner.id} value={partner.id}>{partner.company_name}</option>)}</select></label><label>Response due<input name="response_due_at" type="datetime-local" required /></label><label>Files to share<select name="file_selection" defaultValue="all"><option value="all">All approved case documents</option><option value="none">No files</option></select></label><label>Optional instructions<textarea name="review_instructions" rows={3} /></label><label>Client identity<select name="show_client_identity" defaultValue="false"><option value="false">Hide</option><option value="true">Show</option></select></label><label>Commercial identity<select name="show_commercial_identity" defaultValue="false"><option value="false">Hide</option><option value="true">Show</option></select></label><button className="button">Send partner review</button></form> : null}
          {actionKey === 'decide_partner' ? <form action={decidePartnerReviewAction} className="stack"><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="request_id" value={review.id} /><input type="hidden" name="response_id" value={response.id} /><label>Decision<select name="decision" required defaultValue=""><option value="">Select decision</option><option value="approved">Approve</option><option value="approved_with_conditions">Approve with conditions</option><option value="clarification_required">Request clarification</option><option value="rejected">Reject</option></select></label><label>Decision note<textarea name="review_notes" rows={3} /></label><label>Clarification request<textarea name="clarification_request" rows={3} /></label><button className="button">Record technical decision</button></form> : null}
          {actionKey === 'create_commercial' ? <form action={createCommercialReviewAction} className="stack"><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="partner_quote_id" value={workflow.partnerQuote?.id} /><MarginSimulator cost={Number(workflow.partnerQuote?.price || 0)} currency={workflow.partnerQuote?.currency || 'GBP'} /><label>Optional commercial note<textarea name="commercial_note" rows={3} /></label><button className="button">Approve commercial position</button></form> : null}
          {actionKey === 'generate_quote' ? <form action={approveCommercialAction}><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="commercial_review_id" value={workflow.commercialReview?.id} /><button className="button">Generate quote</button></form> : null}
          {actionKey === 'issue_quote' ? <form action={issueQuoteAction}><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="quote_id" value={workflow.clientQuote?.id} /><button className="button">Issue client quote</button></form> : null}
          {actionKey === 'accept_quote' ? <form action={acceptQuoteAction}><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="quote_id" value={workflow.clientQuote?.id} /><button className="button">Record acceptance and create project</button></form> : null}
          {actionKey === 'open_project' ? <Link className="button" href={`/workspace/projects?project=${workflow.project?.id}&lead=${id}`}>Open active project</Link> : null}
          {actionKey === 'wait_partner' ? <p><strong>No internal action is currently required.</strong></p> : null}
        </div>
        {decision ? <div style={{ borderTop: '1px solid var(--line)', marginTop: 20, paddingTop: 16 }}><p className="eyebrow">Latest internal decision</p><strong>{workspaceLabel(decision.decision, 'decision')}</strong></div> : null}
      </aside>
    </div>
  </section>;
}
