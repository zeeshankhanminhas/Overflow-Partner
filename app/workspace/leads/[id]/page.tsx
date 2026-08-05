import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { listWorkflowCases } from '@/lib/orchestration/service';
import { acceptQuoteAction, approveCommercialAction, approveIntakeAction, createCommercialReviewAction, createIntakeShellAction, issueQuoteAction } from '../../orchestration/actions';
import { createPartnerReviewRequestAction, decidePartnerReviewAction } from './actions';
import { eventLabel, partnerReviewNextAction, workspaceLabel } from '@/lib/presentation/vocabulary';

const dateTime = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Not recorded';

function Field({ name, value, source }: { name: string; value: string | number | null | undefined; source?: string }) {
  return <div><p className="eyebrow" style={{ marginBottom: 5 }}>{name}</p><strong>{value ?? 'Not recorded'}</strong>{source ? <p style={{ margin: '4px 0 0', fontSize: 12 }}>Source: {source}</p> : null}</div>;
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
  let nextAction = 'Create inherited technical scope';
  let reason = 'The case exists, but its governed technical scope has not been created.';
  let completion = 'Create the technical scope from the existing case context.';
  let blocker: string | null = null;
  let actionKey = 'create_scope';

  if (workflow.technicalIntake && !technicalApproved) {
    currentStatus = 'Technical scope under review';
    nextAction = 'Approve technical scope';
    reason = 'The inherited scope is ready for an internal engineering decision.';
    completion = 'Approve the scope before any partner access is allowed.';
    actionKey = 'approve_scope';
  }
  if (technicalApproved && !review) {
    currentStatus = 'Technical scope required';
    nextAction = 'Select execution partner';
    reason = 'The approved scope is ready to be issued to an NDA-compliant partner.';
    completion = 'Choose a partner, due date, files and visibility settings.';
    actionKey = 'create_partner_review';
  }
  if (review && !response) {
    currentStatus = 'Awaiting partner response';
    nextAction = partnerReviewNextAction(review.status, false);
    reason = 'The controlled request has been issued and no structured response has been received.';
    completion = 'Wait for the partner response or manage the request outside this primary decision panel.';
    blocker = 'Waiting on the execution partner.';
    actionKey = 'wait_partner';
  }
  if (review?.status === 'submitted' && response) {
    currentStatus = 'Partner response received';
    nextAction = 'Complete internal technical decision';
    reason = 'The partner submitted technical feasibility and commercial pricing together.';
    completion = 'Approve, approve with conditions, request clarification, or reject.';
    blocker = 'Commercial progression remains locked until this decision is recorded.';
    actionKey = 'decide_partner';
  }
  if (review?.status === 'clarification_required') {
    currentStatus = 'Clarification required';
    nextAction = 'Await revised partner response';
    reason = 'A formal clarification request is open.';
    completion = 'The partner must submit a revision through the same controlled review.';
    blocker = 'Waiting on revised partner evidence.';
    actionKey = 'wait_partner';
  }
  if (partnerApproved && workflow.partnerQuote && !workflow.commercialReview) {
    currentStatus = 'Ready for commercial review';
    nextAction = 'Set commercial margin';
    reason = 'Technical approval and partner pricing are complete.';
    completion = 'Choose the markup. All other commercial facts are inherited.';
    actionKey = 'create_commercial';
  }
  if (workflow.commercialReview && !workflow.clientQuote) {
    currentStatus = 'Commercial decision required';
    nextAction = 'Approve commercial position and generate quote';
    reason = 'The client price has been calculated from the approved partner cost and margin.';
    completion = 'Approve the commercial position. Quote values will be generated without re-keying.';
    actionKey = 'generate_quote';
  }
  if (workflow.clientQuote && ['draft', 'internal_review'].includes(workflow.clientQuote.status)) {
    currentStatus = 'Draft quote ready';
    nextAction = 'Issue client quote';
    reason = 'A controlled draft quote has been generated from the approved commercial decision.';
    completion = 'Issue the quote to move the case to client decision.';
    actionKey = 'issue_quote';
  }
  if (workflow.clientQuote?.status === 'issued' && !workflow.project) {
    currentStatus = 'Awaiting client decision';
    nextAction = 'Record acceptance and create project';
    reason = 'The quote is issued and awaiting the client outcome.';
    completion = 'Record acceptance to create the project transactionally.';
    actionKey = 'accept_quote';
  }
  if (workflow.project) {
    currentStatus = workflow.project.status === 'active' ? 'Active project' : 'Project ready';
    nextAction = 'Open active project';
    reason = 'The accepted case has been converted into a governed delivery record.';
    completion = 'Continue delivery from the project workspace.';
    actionKey = 'open_project';
  }

  const caseReference = review?.case_reference || `OP-CASE-${workflow.lead.id.slice(0, 8).toUpperCase()}`;

  return <section>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div><p className="eyebrow">Case 360 · {caseReference}</p><h1>{workflow.lead.title || workflow.lead.company_name}</h1><p className="lede">One case. One current status. One next permitted action.</p></div>
      <Link className="button secondary" href="/workspace/leads">All cases</Link>
    </header>

    {query.success ? <section className="card" style={{ marginTop: 20, borderLeft: '3px solid var(--accent)' }}><p className="eyebrow">Action completed</p><h3>{String(query.success)}</h3>{query.resultStatus ? <p>Current status: <strong>{String(query.resultStatus)}</strong></p> : null}</section> : null}
    {query.error ? <section className="card" style={{ marginTop: 20, borderLeft: '3px solid #b42318' }}><p className="eyebrow">Action could not be completed</p><h3>{String(query.error)}</h3><p>The current case and its evidence have been preserved.</p></section> : null}
    {query.partnerReviewCreated ? <section className="card" style={{ marginTop: 20, borderLeft: '3px solid var(--accent)' }}><p className="eyebrow">Partner request created</p><h3>Controlled review link generated</h3><p style={{ overflowWrap: 'anywhere' }}>{String(query.reviewUrl || '')}</p></section> : null}

    <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0,1fr) minmax(300px,360px)', gap: 22, marginTop: 24, alignItems: 'start' }}>
      <aside className="card" style={{ display: 'grid', gap: 18 }}>
        <Field name="Current status" value={currentStatus} />
        <Field name="Company" value={workflow.lead.company_name} />
        <Field name="Contact" value={workflow.lead.contact_name || workflow.lead.contact_email} />
        <Field name="Owner" value={workflow.lead.owner_id ? 'Assigned' : 'Unassigned'} />
        <Field name="Priority" value={workspaceLabel(workflow.lead.priority)} />
        <Field name="Deadline" value={workflow.technicalIntake?.deadline || 'Not recorded'} />
        <Field name="Last activity" value={dateTime(lastActivity)} />
        {blocker ? <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}><p className="eyebrow">Blocker</p><strong>{blocker}</strong></div> : null}
      </aside>

      <main style={{ display: 'grid', gap: 20 }}>
        <section className="card">
          <p className="eyebrow">Inherited case context</p><h2>Approved facts carried forward</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 18, marginTop: 18 }}>
            <Field name="Project" value={workflow.lead.title || workflow.lead.company_name} source="Case record" />
            <Field name="Project type" value={workflow.technicalIntake?.project_type || workflow.lead.project_type} source="Customer intake" />
            <Field name="Discipline" value={workflow.technicalIntake?.discipline} source="Technical scope" />
            <Field name="Deliverables" value={workflow.technicalIntake?.deliverables || workflow.lead.service} source="Technical scope" />
            <Field name="Deadline" value={workflow.technicalIntake?.deadline} source="Customer intake" />
            <Field name="Documents" value={documents.length} source="Controlled case documents" />
          </div>
          <div style={{ marginTop: 20 }}><Field name="Scope" value={workflow.technicalIntake?.description || workflow.lead.notes} source="Approved case context" /></div>
        </section>

        {response ? <section className="card">
          <p className="eyebrow">Latest partner evidence · Revision {response.revision}</p><h2>Technical response</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16, marginTop: 16 }}>
            <Field name="Feasibility" value={workspaceLabel(response.feasibility, 'feasibility')} />
            <Field name="Confidence" value={`${response.confidence_percent}%`} />
            <Field name="Capacity" value={workspaceLabel(response.capacity_status, 'capacity')} />
            <Field name="Hours" value={response.estimated_engineering_hours} />
            <Field name="Lead time" value={response.estimated_lead_time_days ? `${response.estimated_lead_time_days} days` : null} />
            <Field name="Approach" value={response.proposed_delivery_approach} />
          </div>
          <div style={{ display: 'grid', gap: 14, marginTop: 18 }}><Field name="Assumptions" value={response.assumptions} /><Field name="Risks" value={response.technical_risks} /><Field name="Missing information" value={response.missing_information} /><Field name="Exclusions" value={response.exclusions} /></div>
        </section> : null}

        {workflow.partnerQuote ? <section className="card">
          <p className="eyebrow">Inherited commercial evidence</p><h2>Partner commercial response</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16, marginTop: 16 }}>
            <Field name="Partner price" value={money(workflow.partnerQuote.currency, workflow.partnerQuote.price)} />
            <Field name="Currency" value={workflow.partnerQuote.currency} />
            <Field name="Valid until" value={workflow.partnerQuote.valid_until} />
            <Field name="Payment terms" value={(workflow.partnerQuote as any).payment_terms} />
            <Field name="Delivery commitment" value={(workflow.partnerQuote as any).delivery_commitment} />
            <Field name="Quote reference" value={(workflow.partnerQuote as any).quote_reference} />
          </div>
          {(workflow.partnerQuote as any).commercial_assumptions ? <div style={{ marginTop: 16 }}><Field name="Commercial assumptions" value={(workflow.partnerQuote as any).commercial_assumptions} /></div> : null}
        </section> : null}

        {workflow.commercialReview ? <section className="card"><p className="eyebrow">Commercial position</p><h2>Calculated client value</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16, marginTop: 16 }}><Field name="Partner cost" value={money(workflow.partnerQuote?.currency, workflow.commercialReview.cost_price)} /><Field name="Markup / margin" value={`${Number(workflow.commercialReview.margin_percent || 0).toFixed(1)}%`} /><Field name="Margin amount" value={money(workflow.partnerQuote?.currency, workflow.commercialReview.margin_amount)} /><Field name="Client subtotal" value={money(workflow.partnerQuote?.currency, workflow.commercialReview.client_price)} /></div></section> : null}

        {workflow.clientQuote ? <section className="card"><p className="eyebrow">Generated client quote</p><h2>{workflow.clientQuote.quote_number} · Revision {workflow.clientQuote.revision}</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginTop: 16 }}><Field name="Status" value={workspaceLabel(workflow.clientQuote.status, 'clientQuote')} /><Field name="Subtotal" value={money(workflow.clientQuote.currency, workflow.clientQuote.subtotal)} /><Field name="VAT" value={money(workflow.clientQuote.currency, workflow.clientQuote.vat)} /><Field name="Total" value={money(workflow.clientQuote.currency, workflow.clientQuote.total)} /><Field name="Valid until" value={workflow.clientQuote.valid_until} /></div><Link href={`/workspace/quotes?quote=${workflow.clientQuote.id}&lead=${id}`} style={{ display: 'inline-block', marginTop: 18 }}>Open full quote →</Link></section> : null}

        <section className="card"><p className="eyebrow">Case history</p><h2>Latest important movement</h2>{activity.length ? activity.slice(0, 8).map((event: any) => <div key={event.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}><strong>{eventLabel(event.event_type)}</strong><p>{dateTime(event.created_at)}</p></div>) : <p>No case activity recorded.</p>}</section>
      </main>

      <aside className="card" style={{ borderTop: '4px solid var(--accent)' }}>
        <p className="eyebrow">Next permitted action</p><h2>{nextAction}</h2><p>{reason}</p>
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 18, paddingTop: 18 }}><p className="eyebrow">Completion</p><p>{completion}</p></div>
        {!reviewSchemaReady ? <p>Partner review is unavailable until its schema is ready.</p> : null}

        <div style={{ marginTop: 22 }}>
          {actionKey === 'create_scope' ? <form action={createIntakeShellAction}><input type="hidden" name="lead_id" value={id} /><button className="button">Create technical scope</button></form> : null}
          {actionKey === 'approve_scope' ? <form action={approveIntakeAction}><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="intake_id" value={workflow.technicalIntake?.id} /><button className="button">Approve technical scope</button></form> : null}
          {actionKey === 'create_partner_review' ? <form action={createPartnerReviewRequestAction} className="stack"><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="technical_intake_id" value={workflow.technicalIntake?.id} /><label>Execution partner<select name="partner_id" required defaultValue=""><option value="">Select partner</option>{partners.map((partner: any) => <option key={partner.id} value={partner.id}>{partner.company_name}</option>)}</select></label><label>Response due<input name="response_due_at" type="datetime-local" required /></label><label>Files to share<select name="file_selection" defaultValue="all"><option value="all">All approved case documents</option><option value="none">No files</option></select></label><label>Optional instructions<textarea name="review_instructions" rows={3} /></label><label>Client identity<select name="show_client_identity" defaultValue="false"><option value="false">Hide</option><option value="true">Show</option></select></label><label>Commercial identity<select name="show_commercial_identity" defaultValue="false"><option value="false">Hide</option><option value="true">Show</option></select></label><button className="button">Send partner review</button></form> : null}
          {actionKey === 'decide_partner' ? <form action={decidePartnerReviewAction} className="stack"><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="request_id" value={review.id} /><input type="hidden" name="response_id" value={response.id} /><label>Decision<select name="decision" required defaultValue=""><option value="">Select decision</option><option value="approved">Approve</option><option value="approved_with_conditions">Approve with conditions</option><option value="clarification_required">Request clarification</option><option value="rejected">Reject</option></select></label><label>Decision note<textarea name="review_notes" rows={3} /></label><label>Clarification request<textarea name="clarification_request" rows={3} /></label><button className="button">Record technical decision</button></form> : null}
          {actionKey === 'create_commercial' ? <form action={createCommercialReviewAction} className="stack"><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="partner_quote_id" value={workflow.partnerQuote?.id} /><label>Markup %<input name="markup_percent" type="number" min="0" max="500" step="0.1" defaultValue="30" required /></label><label>Optional commercial note<textarea name="commercial_note" rows={3} /></label><button className="button">Calculate commercial position</button></form> : null}
          {actionKey === 'generate_quote' ? <form action={approveCommercialAction}><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="commercial_review_id" value={workflow.commercialReview?.id} /><button className="button">Approve and generate quote</button></form> : null}
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
