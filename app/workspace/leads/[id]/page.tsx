import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { listWorkflowCases } from '@/lib/orchestration/service';
import { acceptQuoteAction, approveCommercialAction, approveIntakeAction, createCommercialReviewAction, createIntakeShellAction, issueQuoteAction } from '../../orchestration/actions';
import { createPartnerReviewRequestAction, decidePartnerReviewAction, revokePartnerReviewAction } from './actions';
import { eventLabel, partnerReviewNextAction, workspaceLabel } from '@/lib/presentation/vocabulary';

const dateTime = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Not recorded';

function Field({ name, value }: { name: string; value: string | number | null | undefined }) {
  return <div><p className="eyebrow" style={{ marginBottom: 5 }}>{name}</p><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{value ?? 'Not recorded'}</p></div>;
}

export default async function Lead360Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const workflow = (await listWorkflowCases(supabase, organisationId)).find((item) => item.lead.id === id);
  if (!workflow) notFound();

  const [activityResult, documentsResult, tasksResult, partnersResult, reviewsResult] = await Promise.all([
    supabase.from('activity_events').select('*').eq('organisation_id', organisationId).eq('entity_type', 'lead').eq('entity_id', id).order('created_at', { ascending: false }).limit(40),
    supabase.from('documents').select('*').eq('organisation_id', organisationId).eq('entity_type', 'lead').eq('entity_id', id).order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').eq('organisation_id', organisationId).eq('entity_type', 'lead').eq('entity_id', id).order('created_at', { ascending: false }),
    supabase.from('partners').select('id,company_name,status,nda_signed,nda_signed_at,services').eq('organisation_id', organisationId).eq('status', 'approved').eq('nda_signed', true).order('company_name'),
    supabase.from('partner_review_requests').select('*, partner:partners(id,company_name,nda_signed), responses:partner_review_responses(*), decisions:partner_review_internal_decisions(*), files:partner_review_files(id)').eq('organisation_id', organisationId).eq('lead_id', id).order('created_at', { ascending: false }),
  ]);

  const activity = activityResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const partners = partnersResult.data ?? [];
  const reviewSchemaReady = !reviewsResult.error;
  const review = ((reviewsResult.data ?? []) as any[])[0] as any | undefined;
  const response = [...(review?.responses ?? [])].sort((a: any, b: any) => Number(b.revision) - Number(a.revision))[0];
  const decision = [...(review?.decisions ?? [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  const technicalApproved = workflow.technicalIntake?.status === 'approved';

  let currentStatus = workspaceLabel(workflow.lead.status, 'lead');
  let currentStage = 'Lead created';
  if (workflow.project) { currentStage = 'Project delivery'; currentStatus = workspaceLabel(workflow.project.status, 'project'); }
  else if (workflow.clientQuote) { currentStage = 'Client quote'; currentStatus = workspaceLabel(workflow.clientQuote.status, 'clientQuote'); }
  else if (workflow.commercialReview) { currentStage = 'Commercial review'; currentStatus = workspaceLabel(workflow.commercialReview.status, 'commercialReview'); }
  else if (review) { currentStage = 'Partner response'; currentStatus = workspaceLabel(review.status, 'partnerReview'); }
  else if (workflow.technicalIntake) { currentStage = 'Technical scope'; currentStatus = workspaceLabel(workflow.technicalIntake.status, 'technical'); }

  let nextAction = !technicalApproved
    ? 'Complete and approve technical scope'
    : !review
      ? 'Create controlled partner review request'
      : partnerReviewNextAction(review.status, Boolean(response));
  if (['approved', 'approved_with_conditions'].includes(review?.status) && workflow.partnerQuote && !workflow.commercialReview) nextAction = 'Create commercial review from the submitted partner price';
  if (workflow.commercialReview && !workflow.clientQuote) nextAction = 'Approve commercial position and draft client quote';
  if (workflow.clientQuote && ['draft', 'internal_review'].includes(workflow.clientQuote.status)) nextAction = 'Approve and issue client quote';
  if (workflow.clientQuote?.status === 'issued' && !workflow.project) nextAction = 'Record client acceptance and create project';
  if (workflow.project) nextAction = 'Manage controlled project delivery';

  const blockedReason = !technicalApproved
    ? 'Partner review is locked until the technical scope is approved.'
    : review?.status === 'submitted'
      ? 'Commercial selection is locked until the partner response receives an internal technical decision.'
      : review?.status === 'clarification_required'
        ? 'Progression is paused while the partner prepares a revised response.'
        : null;

  return <section>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div><p className="eyebrow">Lead 360 · {currentStage}</p><h1>{workflow.lead.title || workflow.lead.company_name}</h1><p className="lede">One governed engineering case. The workspace shows its present position and the next permitted decision.</p></div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Link className="button secondary" href="/workspace/leads">All leads</Link>{workflow.lead.company_id ? <Link className="button secondary" href={`/workspace/companies/${workflow.lead.company_id}`}>Company 360°</Link> : null}</div>
    </div>

    {query.error ? <p className="card" style={{ marginTop: 20 }}>{String(query.error)}</p> : null}
    {query.partnerReviewCreated ? <div className="card" style={{ marginTop: 20, borderLeft: '3px solid var(--accent)' }}><p className="eyebrow">Partner request created</p><h3>Secure review link</h3><p style={{ overflowWrap: 'anywhere' }}>{String(query.reviewUrl || '')}</p><p>This raw token is shown once. The database stores only its hash.</p></div> : null}
    {query.partnerReviewDecision ? <p className="card" style={{ marginTop: 20 }}>Internal technical decision recorded.</p> : null}
    {!reviewSchemaReady ? <p className="card" style={{ marginTop: 20, borderLeft: '3px solid #b45309' }}><strong>Partner review schema unavailable.</strong> This stage remains locked until the database migration is applied.</p> : null}

    <section className="card" style={{ width: '100%', marginTop: 24, borderLeft: '3px solid var(--accent)' }}>
      <p className="eyebrow">Current status</p><h2 style={{ marginTop: 6 }}>{currentStatus}</h2>
      <div style={{ borderTop: '1px solid var(--line)', marginTop: 18, paddingTop: 18 }}><p className="eyebrow">Next action</p><h3 style={{ marginTop: 6 }}>{nextAction}</h3>{blockedReason ? <p>{blockedReason}</p> : null}</div>
    </section>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', gap: 20, marginTop: 24 }}>
      <div style={{ display: 'grid', gap: 20 }}>
        <section className="card" style={{ width: '100%' }}><p className="eyebrow">Case identity</p><h2>Commercial and engineering context</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 18, marginTop: 18 }}><Field name="Company" value={workflow.lead.company_name} /><Field name="Contact" value={workflow.lead.contact_name} /><Field name="Project type" value={workflow.lead.project_type} /><Field name="Service" value={workflow.lead.service} /><Field name="Priority" value={workspaceLabel(workflow.lead.priority)} /><Field name="Source" value={workspaceLabel(workflow.lead.source)} /></div>{workflow.lead.notes ? <div style={{ marginTop: 20 }}><p className="eyebrow">Requirement</p><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{workflow.lead.notes}</p></div> : null}</section>

        <section className="card" style={{ width: '100%' }}><p className="eyebrow">Technical scope</p><h2>{workflow.technicalIntake ? workspaceLabel(workflow.technicalIntake.status, 'technical') : 'Technical scope not created'}</h2><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>{!workflow.technicalIntake ? <form action={createIntakeShellAction}><input type="hidden" name="lead_id" value={id} /><button className="button">Create inherited technical scope</button></form> : null}{workflow.technicalIntake && workflow.technicalIntake.status !== 'approved' ? <form action={approveIntakeAction}><input type="hidden" name="intake_id" value={workflow.technicalIntake.id} /><button className="button">Approve technical scope</button></form> : null}</div></section>

        <section className="card" style={{ width: '100%' }}>
          <p className="eyebrow">Partner response</p><h2>{review ? workspaceLabel(review.status, 'partnerReview') : 'No partner request issued'}</h2><p>Technical feasibility and commercial pricing are collected together through one controlled partner response.</p>

          {!review && technicalApproved && reviewSchemaReady ? <form action={createPartnerReviewRequestAction} className="stack" style={{ marginTop: 22 }}><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="technical_intake_id" value={workflow.technicalIntake?.id} /><label>Approved NDA partner<select name="partner_id" required defaultValue=""><option value="">Select partner</option>{partners.map((partner: any) => <option key={partner.id} value={partner.id}>{partner.company_name}</option>)}</select></label><label>Response due<input name="response_due_at" type="datetime-local" required /></label><label>Scope summary<textarea name="scope_summary" rows={4} required defaultValue={workflow.technicalIntake?.description || workflow.lead.notes || ''} /></label><label>Review instructions<textarea name="review_instructions" rows={4} /></label><label>Client identity visibility<select name="show_client_identity" defaultValue="false"><option value="false">Hide client identity</option><option value="true">Show client identity</option></select></label><label>Commercial identity visibility<select name="show_commercial_identity" defaultValue="false"><option value="false">Hide commercial identity</option><option value="true">Show commercial identity</option></select></label><button className="button">Create secure partner request</button></form> : null}
          {technicalApproved && partners.length === 0 ? <p style={{ marginTop: 18 }}>No approved NDA-compliant partner is available. Update the Execution Partners directory first.</p> : null}

          {review ? <div style={{ marginTop: 22, display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16 }}><Field name="Partner" value={review.partner?.company_name} /><Field name="NDA" value={review.partner?.nda_signed ? 'Confirmed' : 'Outstanding'} /><Field name="Case reference" value={review.case_reference} /><Field name="Response due" value={dateTime(review.response_due_at)} /><Field name="Files shared" value={review.files?.length ?? 0} /></div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}><p className="eyebrow">Request evidence</p><p>Created {dateTime(review.created_at)}{review.first_opened_at ? ` · Opened ${dateTime(review.first_opened_at)}` : ''}{review.submitted_at ? ` · Submitted ${dateTime(review.submitted_at)}` : ''}</p></div>

            {response ? <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}><p className="eyebrow">Structured response · Revision {response.revision}</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16, marginTop: 14 }}><Field name="Feasibility" value={workspaceLabel(response.feasibility, 'feasibility')} /><Field name="Confidence" value={`${response.confidence_percent}%`} /><Field name="Capacity" value={workspaceLabel(response.capacity_status, 'capacity')} /><Field name="Engineering hours" value={response.estimated_engineering_hours} /><Field name="Lead time" value={response.estimated_lead_time_days ? `${response.estimated_lead_time_days} days` : null} /><Field name="Pricing" value={workspaceLabel(response.pricing_readiness, 'pricingReadiness')} /></div>{response.missing_information ? <div style={{ marginTop: 16 }}><Field name="Missing information" value={response.missing_information} /></div> : null}{response.technical_risks ? <div style={{ marginTop: 16 }}><Field name="Technical risks" value={response.technical_risks} /></div> : null}{response.assumptions ? <div style={{ marginTop: 16 }}><Field name="Assumptions" value={response.assumptions} /></div> : null}</div> : null}

            {workflow.partnerQuote ? <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}><p className="eyebrow">Commercial response</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16, marginTop: 14 }}><Field name="Price" value={`${workflow.partnerQuote.currency} ${Number(workflow.partnerQuote.price).toFixed(2)}`} /><Field name="Selection status" value={workspaceLabel(workflow.partnerQuote.status, 'partnerQuote')} /><Field name="Valid until" value={workflow.partnerQuote.valid_until || null} /><Field name="Partner reference" value={(workflow.partnerQuote as any).quote_reference || null} /></div>{!['approved', 'approved_with_conditions'].includes(review.status) ? <p style={{ marginTop: 16 }}>Commercial selection is locked pending internal technical approval.</p> : null}</div> : null}

            {response && review.status === 'submitted' ? <form action={decidePartnerReviewAction} className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="request_id" value={review.id} /><input type="hidden" name="response_id" value={response.id} /><label>Internal decision<select name="decision" required defaultValue=""><option value="">Select decision</option><option value="approved">Approve</option><option value="approved_with_conditions">Approve with conditions</option><option value="clarification_required">Request clarification</option><option value="rejected">Reject</option></select></label><label>Review notes<textarea name="review_notes" rows={3} /></label><label>Accepted assumptions<textarea name="accepted_assumptions" rows={3} /></label><label>Accepted risks<textarea name="accepted_risks" rows={3} /></label><label>Clarification request<textarea name="clarification_request" rows={3} /></label><button className="button">Record internal decision</button></form> : null}
            {decision ? <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}><p className="eyebrow">Internal decision</p><h3>{workspaceLabel(decision.decision, 'decision')}</h3><p>{decision.review_notes || 'No review notes recorded.'}</p></div> : null}
            {!['revoked', 'expired', 'approved', 'approved_with_conditions', 'rejected'].includes(review.status) ? <form action={revokePartnerReviewAction}><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="request_id" value={review.id} /><button className="button secondary">Revoke partner access</button></form> : null}
          </div> : null}
        </section>

        <section className="card" style={{ width: '100%' }}><p className="eyebrow">Commercial progression</p><h2>{workflow.commercialReview ? workspaceLabel(workflow.commercialReview.status, 'commercialReview') : workflow.partnerQuote ? workspaceLabel(workflow.partnerQuote.status, 'partnerQuote') : 'No commercial response yet'}</h2><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>{review && ['approved', 'approved_with_conditions'].includes(review.status) && workflow.partnerQuote && !workflow.commercialReview ? <form action={createCommercialReviewAction}><input type="hidden" name="partner_quote_id" value={workflow.partnerQuote.id} /><label>Markup %<input name="markup_percent" type="number" min="0" max="500" step=".1" defaultValue="30" /></label><button className="button">Create commercial review</button></form> : null}{workflow.commercialReview && !workflow.clientQuote ? <form action={approveCommercialAction}><input type="hidden" name="commercial_review_id" value={workflow.commercialReview.id} /><input name="currency" defaultValue="GBP" /><input name="vat_rate" type="number" defaultValue="20" /><button className="button">Approve and draft quote</button></form> : null}{workflow.clientQuote && ['draft', 'internal_review'].includes(workflow.clientQuote.status) ? <form action={issueQuoteAction}><input type="hidden" name="quote_id" value={workflow.clientQuote.id} /><button className="button">Issue client quote</button></form> : null}{workflow.clientQuote?.status === 'issued' && !workflow.project ? <form action={acceptQuoteAction}><input type="hidden" name="quote_id" value={workflow.clientQuote.id} /><button className="button">Record acceptance and create project</button></form> : null}{workflow.project ? <Link className="button" href="/workspace/projects">Open project</Link> : null}</div></section>
      </div>

      <aside style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
        <section className="card"><p className="eyebrow">Open actions</p><h3>{tasks.filter((task: any) => task.status !== 'completed').length} outstanding</h3>{tasks.slice(0, 6).map((task: any) => <div key={task.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}><strong>{task.title}</strong><p>{workspaceLabel(task.status, 'task')} · {workspaceLabel(task.priority)}</p></div>)}</section>
        <section className="card"><p className="eyebrow">Documents</p><h3>{documents.length} attached</h3>{documents.slice(0, 6).map((document: any) => <div key={document.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}><strong>{document.title || document.name || 'Controlled document'}</strong></div>)}</section>
        <section className="card"><p className="eyebrow">Evidence history</p><h3>Recent case activity</h3>{activity.slice(0, 14).map((event: any) => <div key={event.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}><strong>{eventLabel(event.event_type)}</strong><p>{dateTime(event.created_at)}</p></div>)}</section>
      </aside>
    </div>
  </section>;
}
