import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceDocumentSlug } from './documentRegistry';
import { documentDataContracts, evidenceLabels, type DocumentEvidenceKey } from './documentDataContracts';

export type DocumentAdapterInput = { organisationId: string; caseId?: string | null; projectId?: string | null; quoteId?: string | null; invoiceId?: string | null };
export type DocumentAdapterFact = { label: string; value: string };
export type DocumentAdapterSection = { title: string; facts: DocumentAdapterFact[] };
export type AdaptedDocumentData = { connected: boolean; sourceLabel: string; reference: string; revision: string; issueState: string; subject: string; facts: DocumentAdapterFact[]; sections: DocumentAdapterSection[]; warnings: string[]; issueReady: boolean };
type Row = Record<string, unknown>;

const absent = (value: unknown) => value === null || value === undefined || value === '';
const text = (value: unknown, fallback = 'Not recorded') => absent(value) ? fallback : String(value);
const number = (value: unknown) => { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; };
const money = (value: unknown, currency: unknown) => { try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: text(currency, 'GBP') }).format(number(value)); } catch { return `${text(currency, 'GBP')} ${number(value).toFixed(2)}`; } };
const date = (value: unknown) => { if (!value) return 'Not recorded'; const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? text(value) : parsed.toLocaleDateString('en-GB'); };
const status = (value: unknown) => { const valueText = text(value); return valueText === 'Not recorded' ? valueText : valueText.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()); };
const fact = (label: string, value: unknown, fallback?: string): DocumentAdapterFact => ({ label, value: text(value, fallback) });
const recorded = (row: Row | null, ...fields: string[]) => Boolean(row && fields.every(field => !absent(row[field])));

async function maybeOne(supabase: SupabaseClient, table: string, organisationId: string, filters: Record<string,string>) {
  let query = supabase.from(table).select('*').eq('organisation_id', organisationId);
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { data } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data ?? null) as Row | null;
}
async function many(supabase: SupabaseClient, table: string, organisationId: string, filters: Record<string,string>) {
  let query = supabase.from(table).select('*').eq('organisation_id', organisationId);
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { data } = await query.order('created_at', { ascending: true });
  return (data ?? []) as Row[];
}
const joined = (rows: Row[], field: string, fallback = 'None recorded') => rows.map(row => text(row[field], '')).filter(Boolean).join('\n') || fallback;

export async function buildDocumentAdapter(supabase: SupabaseClient, slug: WorkspaceDocumentSlug, input: DocumentAdapterInput): Promise<AdaptedDocumentData> {
  let [project, quote, lead] = await Promise.all([
    input.projectId ? maybeOne(supabase, 'projects', input.organisationId, { id: input.projectId }) : null,
    input.quoteId ? maybeOne(supabase, 'quotes', input.organisationId, { id: input.quoteId }) : null,
    input.caseId ? maybeOne(supabase, 'leads', input.organisationId, { id: input.caseId }) : null,
  ]);
  if (!lead && project?.lead_id) lead = await maybeOne(supabase, 'leads', input.organisationId, { id: String(project.lead_id) });
  if (!quote && project?.quote_id) quote = await maybeOne(supabase, 'quotes', input.organisationId, { id: String(project.quote_id) });
  if (!lead && quote?.lead_id) lead = await maybeOne(supabase, 'leads', input.organisationId, { id: String(quote.lead_id) });
  if (!quote && lead?.id) quote = await maybeOne(supabase, 'quotes', input.organisationId, { lead_id: String(lead.id) });
  if (!project && lead?.id) project = await maybeOne(supabase, 'projects', input.organisationId, { lead_id: String(lead.id) });

  if (!lead) return { connected: false, sourceLabel: 'Template preview', reference: `OP-${slug.replaceAll('-', '/').toUpperCase()}-001`, revision: 'A', issueState: 'Preview only', subject: 'No live case selected', facts: [], sections: [], issueReady: false, warnings: ['Open this template with a case, quotation or project context to populate controlled data.'] };

  const leadId = String(lead.id);
  const projectId = project?.id ? String(project.id) : '';
  const [intake, reviewRequest, commercial, owner, documents, deliverables, submissions, transmittals, invoices] = await Promise.all([
    maybeOne(supabase, 'technical_intakes', input.organisationId, { lead_id: leadId }),
    maybeOne(supabase, 'partner_review_requests', input.organisationId, { lead_id: leadId }),
    maybeOne(supabase, 'commercial_reviews', input.organisationId, { lead_id: leadId }),
    lead.owner_id ? maybeOne(supabase, 'profiles', input.organisationId, { id: String(lead.owner_id) }) : null,
    projectId ? many(supabase, 'documents', input.organisationId, { project_id: projectId }) : many(supabase, 'documents', input.organisationId, { lead_id: leadId }),
    projectId ? many(supabase, 'project_delivery_items', input.organisationId, { project_id: projectId }) : [],
    projectId ? many(supabase, 'partner_delivery_submissions', input.organisationId, { project_id: projectId }) : [],
    projectId ? many(supabase, 'project_client_transmittals', input.organisationId, { project_id: projectId }) : [],
    projectId ? many(supabase, 'invoices', input.organisationId, { project_id: projectId }) : [],
  ]);
  const response = reviewRequest?.id ? await maybeOne(supabase, 'partner_review_responses', input.organisationId, { partner_review_request_id: String(reviewRequest.id) }) : null;
  const partnerQuote = reviewRequest?.id ? await maybeOne(supabase, 'partner_quotes', input.organisationId, { partner_review_request_id: String(reviewRequest.id) }) : null;
  const invoice = input.invoiceId ? await maybeOne(supabase, 'invoices', input.organisationId, { id: input.invoiceId }) : invoices.at(-1) || null;
  const referenceBase = text(lead.case_reference || lead.reference || lead.id).slice(0, 36);
  const ownerName = owner?.full_name || [owner?.first_name, owner?.last_name].filter(Boolean).join(' ') || owner?.email || 'Overflow Partner';
  const common = [fact('Requirement reference', referenceBase), fact('Client', lead.company_name), fact('Requirement', lead.title || lead.project_type), fact('Contact', lead.contact_name), fact('Owner', ownerName)];
  const scope = [fact('Project type', intake?.project_type || lead.project_type), fact('Discipline', intake?.discipline), fact('Scope', intake?.description), fact('Deliverables', intake?.deliverables), fact('Required date', date(intake?.deadline)), fact('Special requirements', intake?.special_requirements)];
  const sections: DocumentAdapterSection[] = [{ title: 'Record identity', facts: common }];

  if (['client-requirements','requirement-sheet','scope-of-work','statement-of-work','proposal'].includes(slug)) sections.push({ title: 'Agreed technical basis', facts: scope });
  if (['partner-technical-assessment-report','technical-review','commercial-qualification-record','commercial-approval'].includes(slug)) sections.push({ title: 'Technical assessment', facts: [fact('Feasibility', response?.feasibility), fact('Confidence', response?.confidence_percent !== undefined ? `${response.confidence_percent}%` : null), fact('Capability', response?.capability_status), fact('Capacity', response?.capacity_status), fact('Earliest start', date(response?.earliest_start_date)), fact('Estimated hours', response?.estimated_engineering_hours), fact('Lead time', response?.estimated_lead_time_days !== undefined ? `${response.estimated_lead_time_days} days` : null), fact('Assumptions', response?.assumptions), fact('Technical risks', response?.technical_risks), fact('Missing information', response?.missing_information), fact('Exclusions', response?.exclusions)] });
  if (['rfq-response','commercial-approval','commercial-qualification-record'].includes(slug)) sections.push({ title: 'Commercial evidence', facts: [fact('Partner quote reference', partnerQuote?.quote_reference), fact('Partner price', money(partnerQuote?.price, partnerQuote?.currency || quote?.currency)), fact('Partner lead time', partnerQuote?.lead_time_days !== undefined ? `${partnerQuote.lead_time_days} days` : null), fact('Partner quote validity', date(partnerQuote?.valid_until)), fact('Payment terms', partnerQuote?.payment_terms), fact('Commercial assumptions', partnerQuote?.commercial_assumptions), fact('Commercial exclusions', partnerQuote?.commercial_exclusions)] });
  if (['commercial-approval','commercial-qualification-record','client-quote'].includes(slug)) sections.push({ title: 'Approved pricing', facts: [fact('Partner cost', money(commercial?.cost_price, quote?.currency)), fact('Client price', money(commercial?.client_price, quote?.currency)), fact('Margin amount', money(commercial?.margin_amount, quote?.currency)), fact('Margin', commercial?.margin_percent !== undefined ? `${number(commercial.margin_percent).toFixed(1)}%` : null), fact('Approval state', status(commercial?.status)), fact('Approved at', date(commercial?.approved_at))] });
  if (['client-quote','quote','proposal','statement-of-work','handover-pack'].includes(slug)) sections.push({ title: 'Client quotation', facts: [fact('Quote number', quote?.quote_number), fact('Revision', quote?.revision), fact('Subtotal', money(quote?.subtotal, quote?.currency)), fact('VAT', money(quote?.vat, quote?.currency)), fact('Total', money(quote?.total, quote?.currency)), fact('Valid until', date(quote?.valid_until)), fact('Quotation status', status(quote?.status)), fact('Accepted at', date(quote?.accepted_at))] });
  if (['statement-of-work','vendor-instructions','handover-pack','completion-report','invoice','document-register'].includes(slug)) sections.push({ title: 'Project control', facts: [fact('Project number', project?.project_number), fact('Delivery stage', status(project?.project_stage || project?.status)), fact('Start date', date(project?.start_date)), fact('Due date', date(project?.due_date)), fact('Project owner', project?.owner_id || ownerName), fact('Delivery items', deliverables.length), fact('Controlled documents', documents.length)] });
  if (['vendor-safe-package','vendor-instructions','rfq-response'].includes(slug)) sections.push({ title: 'Partner package', facts: [fact('Controlled case', referenceBase), fact('Scope summary', reviewRequest?.scope_summary || intake?.description), fact('Review instructions', reviewRequest?.review_instructions), fact('Response due', date(reviewRequest?.response_due_at)), fact('Review status', status(reviewRequest?.status)), fact('Client identity disclosed', reviewRequest?.show_client_identity === true ? 'Authorised' : 'Withheld'), fact('Commercial identity disclosed', reviewRequest?.show_commercial_identity === true ? 'Authorised' : 'Withheld'), fact('Controlled documents', documents.length)] });
  if (['completion-report','handover-pack'].includes(slug)) sections.push({ title: 'Delivery evidence', facts: [fact('Delivery items', joined(deliverables, 'title')), fact('Partner submissions', submissions.length), fact('Client transmittals', transmittals.length), fact('Latest submission status', status(submissions.at(-1)?.status)), fact('Latest client issue status', status(transmittals.at(-1)?.status))] });
  if (slug === 'invoice') sections.push({ title: 'Invoice', facts: [fact('Invoice number', invoice?.invoice_number), fact('Issue date', date(invoice?.issued_at)), fact('Due date', date(invoice?.due_date)), fact('External reference', invoice?.external_reference), fact('Description', invoice?.description), fact('Net amount', money(invoice?.subtotal, invoice?.currency)), fact('Tax', money(invoice?.vat, invoice?.currency)), fact('Total', money(invoice?.total, invoice?.currency)), fact('Amount paid', money(invoice?.amount_paid, invoice?.currency)), fact('Amount due', money(number(invoice?.total) - number(invoice?.amount_paid), invoice?.currency)), fact('Currency', invoice?.currency), fact('Invoice status', status(invoice?.status))] });
  if (slug === 'document-register') sections.push({ title: 'Current controlled records', facts: documents.map(document => fact(text(document.reference, 'Unreferenced document'), `${text(document.title)} · ${status(document.status)} · Revision ${text(document.revision_code || document.version)}`)) });

  const evidence: Record<DocumentEvidenceKey, boolean> = {
    clientIdentity: recorded(lead, 'company_name', 'contact_name'), technicalIntake: recorded(intake, 'description', 'deliverables'), partnerAssessment: recorded(response, 'feasibility'), partnerQuote: recorded(partnerQuote, 'price', 'currency'),
    commercialApproval: Boolean(commercial && commercial.status === 'approved' && !absent(commercial.client_price)), clientQuote: recorded(quote, 'quote_number', 'total', 'currency', 'valid_until'), acceptedQuote: Boolean((quote && ['accepted','paid'].includes(String(quote.status))) || quote?.accepted_at),
    project: recorded(project, 'project_number'), deliveryEvidence: deliverables.length > 0 && (submissions.length > 0 || transmittals.length > 0), documentControl: documents.length > 0,
    invoice: recorded(invoice, 'invoice_number', 'due_date') && !absent(invoice?.total || invoice?.amount_due),
  };
  const contract = documentDataContracts[slug];
  const warnings = contract.required.filter(key => !evidence[key]).map(key => `Missing required evidence: ${evidenceLabels[key]}.`);
  if (!contract.canonical) warnings.unshift('Legacy template: create the corresponding canonical document instead of issuing this version.');
  const issueReady = contract.canonical && warnings.length === 0;
  return { connected: true, sourceLabel: project ? 'Live project evidence' : quote ? 'Live quotation evidence' : 'Live case evidence', reference: invoice?.invoice_number && slug === 'invoice' ? String(invoice.invoice_number) : `OP-${slug.replaceAll('-', '/').toUpperCase()}-${referenceBase}`, revision: text(quote?.revision, 'A'), issueState: issueReady ? 'Evidence complete / Approval required' : 'Draft / Missing evidence', subject: text(lead.title || lead.project_type || lead.company_name), facts: sections.flatMap(section => section.facts), sections, warnings, issueReady };
}
