import type { SupabaseClient } from '@supabase/supabase-js';
import { projectStageMeta, type ProjectStage, normaliseProjectStage } from '@/lib/projects/stages';
import { resolveBillingEligibility, type BillingInvoiceType } from '@/lib/finance/state';
import { resolveCaseOwnership, resolveProspectOwnership } from '@/lib/lifecycle/ownership';

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function projectForCase(supabase: SupabaseClient, organisationId: string, leadId: string) {
  const { data, error } = await supabase.from('projects').select('id,status,project_stage').eq('organisation_id', organisationId).eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function assertProspectIsActive(supabase: SupabaseClient, organisationId: string, prospectId: string) {
  const ownership = await resolveProspectOwnership(supabase, organisationId, prospectId);
  ensure(ownership.owner === 'prospect', `This opportunity is no longer owned by Acquisition. Continue in ${ownership.activeWorkspace === 'project_360' ? 'Project 360' : ownership.activeWorkspace === 'case_360' ? 'Case 360' : 'Archive'}.`);
  return ownership;
}

export async function assertCaseIsActive(supabase: SupabaseClient, organisationId: string, leadId: string) {
  const ownership = await resolveCaseOwnership(supabase, organisationId, leadId);
  ensure(ownership.owner === 'case', `This Case is historical because delivery has already moved to ${ownership.activeWorkspace === 'project_360' ? 'Project 360' : 'Archive'}.`);
  return ownership;
}

export async function assertCanInviteTechnicalIntake(supabase: SupabaseClient, organisationId: string, prospectId: string) {
  await assertProspectIsActive(supabase, organisationId, prospectId);
  const [{ data: prospect, error: prospectError }, { data: active, error: activeError }, { data: submitted, error: submittedError }] = await Promise.all([
    supabase.from('prospects').select('id,status').eq('organisation_id', organisationId).eq('id', prospectId).single(),
    supabase.from('intake_sessions').select('id,status').eq('organisation_id', organisationId).eq('prospect_id', prospectId).in('status', ['invited','opened','in_progress']).limit(1).maybeSingle(),
    supabase.from('intake_sessions').select('id,status').eq('organisation_id', organisationId).eq('prospect_id', prospectId).eq('status', 'submitted').limit(1).maybeSingle(),
  ]);
  if (prospectError) throw new Error(prospectError.message);
  if (activeError) throw new Error(activeError.message);
  if (submittedError) throw new Error(submittedError.message);
  ensure(prospect.status !== 'qualified', 'This Prospect is already qualified and cannot be sent back to Technical Intake.');
  ensure(!active, 'An active Technical Intake already exists for this Prospect.');
  ensure(!submitted, 'A submitted Technical Intake already exists. Continue with technical review instead of creating another invitation.');
}

export async function assertCanQualifyProspect(supabase: SupabaseClient, organisationId: string, prospectId: string) {
  await assertProspectIsActive(supabase, organisationId, prospectId);
  const [{ data: prospect, error: prospectError }, { data: session, error: sessionError }, { data: review, error: reviewError }] = await Promise.all([
    supabase.from('prospects').select('id,status,company_name,project_type,requirement_summary').eq('organisation_id', organisationId).eq('id', prospectId).single(),
    supabase.from('intake_sessions').select('id,status').eq('organisation_id', organisationId).eq('prospect_id', prospectId).eq('status', 'submitted').order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('prospect_technical_reviews').select('id,status,decision').eq('organisation_id', organisationId).eq('prospect_id', prospectId).eq('status', 'approved').in('decision', ['feasible','feasible_with_clarification']).order('approved_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (prospectError) throw new Error(prospectError.message);
  if (sessionError) throw new Error(sessionError.message);
  if (reviewError) throw new Error(reviewError.message);
  ensure(Boolean(prospect.company_name?.trim() && prospect.project_type?.trim() && prospect.requirement_summary?.trim()), 'Company, project type and requirement summary are required before qualification.');
  ensure(Boolean(session), 'A submitted Technical Intake is required before qualification.');
  ensure(Boolean(review), 'An approved feasible technical review is required before qualification.');
  return { prospect, session, review };
}

export async function assertCanConvertProspect(supabase: SupabaseClient, organisationId: string, prospectId: string) {
  await assertProspectIsActive(supabase, organisationId, prospectId);
  const { prospect, review } = await assertCanQualifyProspect(supabase, organisationId, prospectId);
  ensure(prospect.status === 'qualified', 'Only a qualified Prospect can become a Case.');
  return { prospect, review };
}

export async function assertCanCreateTechnicalScope(supabase: SupabaseClient, organisationId: string, leadId: string) {
  await assertCaseIsActive(supabase, organisationId, leadId);
  const { data: existing, error } = await supabase.from('technical_intakes').select('id,status').eq('organisation_id', organisationId).eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  ensure(!existing, 'A Technical Scope already exists for this Case. Continue the existing governed scope instead of creating another.');
}

export async function assertCanApproveTechnical(supabase: SupabaseClient, organisationId: string, intakeId: string) {
  const { data: intake, error } = await supabase.from('technical_intakes').select('id,lead_id,status').eq('organisation_id', organisationId).eq('id', intakeId).single();
  if (error || !intake) throw new Error(error?.message || 'Technical Scope not found.');
  await assertCaseIsActive(supabase, organisationId, intake.lead_id);
  ensure(['submitted','under_review','draft'].includes(String(intake.status)), 'This Technical Scope is not in an approvable state.');
  return intake;
}

export async function assertCanCreateCommercialReview(supabase: SupabaseClient, organisationId: string, partnerQuoteId: string) {
  const { data: quote, error } = await supabase.from('partner_quotes').select('id,lead_id,status').eq('organisation_id', organisationId).eq('id', partnerQuoteId).single();
  if (error || !quote) throw new Error(error?.message || 'Partner pricing not found.');
  await assertCaseIsActive(supabase, organisationId, quote.lead_id);
  ensure(['selected','received','approved'].includes(String(quote.status)), 'Commercial review requires received and accepted partner pricing.');
  const { data: existing, error: existingError } = await supabase.from('commercial_reviews').select('id,status').eq('organisation_id', organisationId).eq('lead_id', quote.lead_id).in('status', ['draft','pending_approval','approved']).limit(1).maybeSingle();
  if (existingError) throw new Error(existingError.message);
  ensure(!existing, 'An active Commercial Review already exists for this Case.');
  return quote;
}

export async function assertCanGenerateQuote(supabase: SupabaseClient, organisationId: string, commercialReviewId: string) {
  const { data: review, error } = await supabase.from('commercial_reviews').select('id,lead_id,status,client_price').eq('organisation_id', organisationId).eq('id', commercialReviewId).single();
  if (error || !review) throw new Error(error?.message || 'Commercial Review not found.');
  await assertCaseIsActive(supabase, organisationId, review.lead_id);
  ensure(['pending_approval','approved'].includes(String(review.status)), 'The Commercial Review is not ready for quote generation.');
  ensure(Number(review.client_price || 0) > 0, 'A valid client selling price is required before quote generation.');
  const { data: existing, error: existingError } = await supabase.from('quotes').select('id,status').eq('organisation_id', organisationId).eq('lead_id', review.lead_id).in('status', ['draft','internal_review','issued','accepted']).limit(1).maybeSingle();
  if (existingError) throw new Error(existingError.message);
  ensure(!existing, 'An active Client Quote already exists for this Case. Revise the existing quote instead of creating another.');
  return review;
}

export async function assertCanIssueQuote(supabase: SupabaseClient, organisationId: string, quoteId: string) {
  const { data: quote, error } = await supabase.from('quotes').select('id,lead_id,status').eq('organisation_id', organisationId).eq('id', quoteId).single();
  if (error || !quote) throw new Error(error?.message || 'Client Quote not found.');
  await assertCaseIsActive(supabase, organisationId, quote.lead_id);
  ensure(['draft','internal_review'].includes(String(quote.status)), 'Only a draft or internally reviewed quote can be issued.');
  const { data: document, error: documentError } = await supabase.from('documents').select('id,status').eq('organisation_id', organisationId).eq('lead_id', quote.lead_id).eq('quote_id', quote.id).in('document_type', ['client-quote','quote']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (documentError) throw new Error(documentError.message);
  ensure(Boolean(document), 'A controlled client quotation document is required before commercial issue.');
  ensure(['approved','issued','published'].includes(String(document?.status)), 'The controlled client quotation must be approved before commercial issue.');
  return quote;
}

export async function assertCanAcceptQuote(supabase: SupabaseClient, organisationId: string, quoteId: string) {
  const { data: quote, error } = await supabase.from('quotes').select('id,lead_id,status').eq('organisation_id', organisationId).eq('id', quoteId).single();
  if (error || !quote) throw new Error(error?.message || 'Client Quote not found.');
  await assertCaseIsActive(supabase, organisationId, quote.lead_id);
  ensure(quote.status === 'issued', 'Only an issued quote can be recorded as accepted.');
  const existing = await projectForCase(supabase, organisationId, quote.lead_id);
  ensure(!existing, 'A Project already exists for this Case. Open the existing Project 360 record.');
  return quote;
}

export async function assertCanMutateCase(supabase: SupabaseClient, organisationId: string, leadId: string) {
  return assertCaseIsActive(supabase, organisationId, leadId);
}

export async function assertCanAdvanceProjectStage(
  supabase: SupabaseClient,
  organisationId: string,
  projectId: string,
  targetStage: ProjectStage,
) {
  const { data: project, error } = await supabase.from('projects').select('id,status,project_stage,project_manager_id,start_date,due_date').eq('organisation_id', organisationId).eq('id', projectId).single();
  if (error || !project) throw new Error(error?.message || 'Project not found.');
  const current = normaliseProjectStage(project.project_stage);
  ensure(current !== 'closed', 'Closed Projects cannot be advanced.');
  const normalNext = projectStageMeta[current].next;
  const correctionRoute = current === 'internal_review' && targetStage === 'partner_correction';
  const correctionReturn = current === 'partner_correction' && targetStage === 'in_progress';
  ensure(targetStage === normalNext || correctionRoute || correctionReturn, `Invalid lifecycle transition: ${current} → ${targetStage}.`);

  const { data: readiness, error: readinessError } = await supabase.rpc('op_project_stage_readiness', { p_project_id: projectId });
  if (readinessError) throw new Error(readinessError.message);
  if (!correctionRoute && !correctionReturn) ensure(Boolean(readiness?.ready), `Current project gate is blocked: ${(readiness?.reasons || []).join('; ') || 'required evidence or activities are incomplete.'}`);

  if (current === 'mobilisation' && targetStage === 'ready_for_execution') {
    ensure(Boolean(project.project_manager_id && project.start_date && project.due_date), 'Project manager, start date and due date are required before execution can be authorised.');
    const { data: gate, error: gateError } = await supabase.rpc('op_project_financial_gate', { p_project_id: projectId });
    if (gateError) throw new Error(gateError.message);
    ensure(Boolean(gate?.authorised), `Financial mobilisation gate blocked: ${gate?.reason || 'Commercial authorisation is incomplete.'}`);
  }

  if (targetStage === 'closed') {
    const [{ data: invoices, error: invoiceError }, { data: payables, error: payableError }, { data: tasks, error: taskError }, { data: docs, error: docError }] = await Promise.all([
      supabase.from('invoices').select('id,status,total,amount_paid').eq('organisation_id', organisationId).eq('project_id', projectId),
      supabase.from('partner_payables').select('id,status,total,amount_paid').eq('organisation_id', organisationId).eq('project_id', projectId),
      supabase.from('tasks').select('id,status').eq('organisation_id', organisationId).eq('entity_type', 'project').eq('entity_id', projectId),
      supabase.from('documents').select('id,status').eq('organisation_id', organisationId).eq('project_id', projectId),
    ]);
    if (invoiceError) throw new Error(invoiceError.message);
    if (payableError) throw new Error(payableError.message);
    if (taskError) throw new Error(taskError.message);
    if (docError) throw new Error(docError.message);
    const openReceivables = (invoices || []).filter(item => !['cancelled','refunded'].includes(item.status) && Number(item.amount_paid || 0) < Number(item.total || 0));
    const openPayables = (payables || []).filter(item => !['cancelled','disputed'].includes(item.status) && Number(item.amount_paid || 0) < Number(item.total || 0));
    const openTasks = (tasks || []).filter(item => !['completed','cancelled'].includes(item.status));
    const issuedEvidence = (docs || []).some(item => ['issued','published','archived'].includes(item.status));
    ensure(openReceivables.length === 0, 'Project cannot close while client receivables remain outstanding.');
    ensure(openPayables.length === 0, 'Project cannot close while partner liabilities remain outstanding.');
    ensure(openTasks.length === 0, 'Project cannot close while delivery activities remain open.');
    ensure(issuedEvidence, 'Project cannot close without final issued controlled evidence.');
  }
  return project;
}

async function billingContext(supabase: SupabaseClient, organisationId: string, projectId: string, invoiceType: BillingInvoiceType) {
  const [{ data: project, error: projectError }, { data: terms, error: termsError }, { data: tasks, error: taskError }, { data: sourceInvoices, error: invoiceError }] = await Promise.all([
    supabase.from('projects').select('id,status,project_stage').eq('organisation_id', organisationId).eq('id', projectId).single(),
    supabase.from('commercial_terms').select('authorisation_basis,deposit_required_amount,deposit_percent').eq('organisation_id', organisationId).eq('project_id', projectId).maybeSingle(),
    supabase.from('tasks').select('id,status').eq('organisation_id', organisationId).eq('entity_type', 'project').eq('entity_id', projectId),
    supabase.from('invoices').select('id,status').eq('organisation_id', organisationId).eq('project_id', projectId).neq('status', 'draft'),
  ]);
  if (projectError || !project) throw new Error(projectError?.message || 'Project not found.');
  if (termsError) throw new Error(termsError.message);
  if (taskError) throw new Error(taskError.message);
  if (invoiceError) throw new Error(invoiceError.message);
  const deliveryTasks = tasks || [];
  const deliveryMilestoneAchieved = deliveryTasks.length > 0 && deliveryTasks.every(task => ['completed','cancelled'].includes(task.status));
  const decision = resolveBillingEligibility({
    invoiceType,
    projectStage: project.project_stage,
    projectStatus: project.status,
    authorisationBasis: terms?.authorisation_basis,
    depositRequiredAmount: terms?.deposit_required_amount,
    depositPercent: terms?.deposit_percent,
    deliveryMilestoneAchieved,
    hasEligibleSourceInvoice: (sourceInvoices || []).some(invoice => !['cancelled','refunded'].includes(invoice.status)),
  });
  return { project, terms, decision };
}

export async function assertCanCreateInvoice(supabase: SupabaseClient, organisationId: string, projectId: string, invoiceType: BillingInvoiceType) {
  const context = await billingContext(supabase, organisationId, projectId, invoiceType);
  ensure(context.decision.permitted, context.decision.reason);
  return context;
}

export async function assertCanIssueInvoice(supabase: SupabaseClient, organisationId: string, invoiceId: string) {
  const { data: invoice, error } = await supabase.from('invoices').select('id,project_id,status,invoice_type').eq('organisation_id', organisationId).eq('id', invoiceId).single();
  if (error || !invoice) throw new Error(error?.message || 'Invoice not found.');
  ensure(invoice.status === 'draft', 'Only a draft invoice can be issued.');
  await assertCanCreateInvoice(supabase, organisationId, invoice.project_id, invoice.invoice_type as BillingInvoiceType);
  return invoice;
}

export async function assertCanCreatePayable(supabase: SupabaseClient, organisationId: string, projectId: string) {
  const [{ data: project, error: projectError }, { data: tasks, error: taskError }, { data: docs, error: docError }] = await Promise.all([
    supabase.from('projects').select('id,status,project_stage').eq('organisation_id', organisationId).eq('id', projectId).single(),
    supabase.from('tasks').select('id,status').eq('organisation_id', organisationId).eq('entity_type', 'project').eq('entity_id', projectId),
    supabase.from('documents').select('id,status').eq('organisation_id', organisationId).eq('project_id', projectId),
  ]);
  if (projectError || !project) throw new Error(projectError?.message || 'Project not found.');
  if (taskError) throw new Error(taskError.message);
  if (docError) throw new Error(docError.message);
  const stage = normaliseProjectStage(project.project_stage);
  const eligibleStages = new Set<ProjectStage>(['internal_review','partner_correction','ready_for_client_issue','issued_to_client','client_review','completion','closed']);
  ensure(eligibleStages.has(stage), 'Partner payable cannot be recorded before governed delivery evidence exists.');
  const hasCompletedWork = (tasks || []).some(task => task.status === 'completed');
  const hasGovernedEvidence = (docs || []).some(doc => ['approved','issued','published','archived'].includes(doc.status));
  ensure(hasCompletedWork || hasGovernedEvidence, 'Partner payable requires completed delivery activity or approved controlled evidence.');
  return project;
}

export async function assertCanApprovePayable(supabase: SupabaseClient, organisationId: string, payableId: string) {
  const { data: payable, error } = await supabase.from('partner_payables').select('id,project_id,status,evidence_confirmed').eq('organisation_id', organisationId).eq('id', payableId).single();
  if (error || !payable) throw new Error(error?.message || 'Partner payable not found.');
  ensure(['received','matched'].includes(payable.status), 'This payable is not in an approvable state.');
  ensure(Boolean(payable.evidence_confirmed), 'Delivery evidence must be confirmed before approval.');
  await assertCanCreatePayable(supabase, organisationId, payable.project_id);
  return payable;
}

export async function assertCanPayPartner(supabase: SupabaseClient, organisationId: string, payableId: string) {
  const { data: payable, error } = await supabase.from('partner_payables').select('id,project_id,status,total,amount_paid').eq('organisation_id', organisationId).eq('id', payableId).single();
  if (error || !payable) throw new Error(error?.message || 'Partner payable not found.');
  ensure(['approved','scheduled'].includes(payable.status), 'Partner payment requires an approved payable.');
  ensure(Number(payable.amount_paid || 0) < Number(payable.total || 0), 'This partner payable is already settled.');
  return payable;
}
