import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceDocumentSlug } from './documentRegistry';

export type DocumentAdapterInput = {
  organisationId: string;
  caseId?: string | null;
  projectId?: string | null;
  quoteId?: string | null;
};

export type DocumentAdapterFact = { label: string; value: string };
export type AdaptedDocumentData = {
  connected: boolean;
  sourceLabel: string;
  reference: string;
  revision: string;
  issueState: string;
  subject: string;
  facts: DocumentAdapterFact[];
  warnings: string[];
};

function text(value: unknown, fallback = 'Not recorded') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}
function number(value: unknown) { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; }
function money(value: unknown, currency: unknown) {
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: text(currency, 'GBP') }).format(number(value)); }
  catch { return `${text(currency, 'GBP')} ${number(value).toFixed(2)}`; }
}
function date(value: unknown) {
  if (!value) return 'Not recorded';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? text(value) : parsed.toLocaleDateString('en-GB');
}
function fact(label: string, value: unknown, fallback?: string): DocumentAdapterFact { return { label, value: text(value, fallback) }; }

async function maybeOne(supabase: SupabaseClient, table: string, organisationId: string, filters: Record<string,string>, order = 'created_at') {
  let query = supabase.from(table).select('*').eq('organisation_id', organisationId);
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { data } = await query.order(order, { ascending: false }).limit(1).maybeSingle();
  return (data ?? null) as Record<string, unknown> | null;
}

export async function buildDocumentAdapter(supabase: SupabaseClient, slug: WorkspaceDocumentSlug, input: DocumentAdapterInput): Promise<AdaptedDocumentData> {
  let project = input.projectId ? await maybeOne(supabase, 'projects', input.organisationId, { id: input.projectId }) : null;
  let quote = input.quoteId ? await maybeOne(supabase, 'quotes', input.organisationId, { id: input.quoteId }) : null;
  let lead = input.caseId ? await maybeOne(supabase, 'leads', input.organisationId, { id: input.caseId }) : null;

  if (!lead && project?.lead_id) lead = await maybeOne(supabase, 'leads', input.organisationId, { id: String(project.lead_id) });
  if (!quote && project?.quote_id) quote = await maybeOne(supabase, 'quotes', input.organisationId, { id: String(project.quote_id) });
  if (!lead && quote?.lead_id) lead = await maybeOne(supabase, 'leads', input.organisationId, { id: String(quote.lead_id) });
  if (!quote && lead?.id) quote = await maybeOne(supabase, 'quotes', input.organisationId, { lead_id: String(lead.id) });
  if (!project && lead?.id) project = await maybeOne(supabase, 'projects', input.organisationId, { lead_id: String(lead.id) });

  if (!lead) return {
    connected: false,
    sourceLabel: 'Template preview',
    reference: `OP-${slug.replaceAll('-', '/').toUpperCase()}-001`,
    revision: 'A', issueState: 'Preview only', subject: 'No live case selected', facts: [],
    warnings: ['Open this template with a case, quote or project context to populate live data.'],
  };

  const intake = await maybeOne(supabase, 'technical_intakes', input.organisationId, { lead_id: String(lead.id) });
  const reviewRequest = await maybeOne(supabase, 'partner_review_requests', input.organisationId, { lead_id: String(lead.id) });
  const response = reviewRequest?.id ? await maybeOne(supabase, 'partner_review_responses', input.organisationId, { partner_review_request_id: String(reviewRequest.id) }) : null;
  const commercial = await maybeOne(supabase, 'commercial_reviews', input.organisationId, { lead_id: String(lead.id) });
  const { count: documentCount } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('organisation_id', input.organisationId).eq('lead_id', String(lead.id));

  const referenceBase = text(lead.case_reference || lead.reference || lead.id).slice(0, 36);
  const clientCommon = [
    fact('Case reference', referenceBase),
    fact('Client', lead.company_name),
    fact('Project', lead.title || lead.project_type),
    fact('Contact', lead.contact_name),
  ];
  const internalCommon = [
    ...clientCommon,
    fact('Owner', lead.owner_id),
    fact('Priority', lead.priority),
  ];
  let facts: DocumentAdapterFact[] = internalCommon;

  switch (slug) {
    case 'partner-technical-assessment-report':
    case 'technical-review':
      facts = [...internalCommon,
        fact('Feasibility', response?.feasibility), fact('Confidence', response?.confidence_percent !== undefined ? `${response.confidence_percent}%` : null),
        fact('Capacity', response?.capacity_status), fact('Estimated hours', response?.estimated_engineering_hours),
        fact('Lead time', response?.estimated_lead_time_days !== undefined ? `${response.estimated_lead_time_days} days` : null),
        fact('Assumptions', response?.assumptions), fact('Technical risks', response?.technical_risks), fact('Missing information', response?.missing_information),
      ]; break;
    case 'commercial-approval':
    case 'commercial-qualification-record':
      facts = [...internalCommon,
        fact('Partner cost', money(commercial?.cost_price, quote?.currency)), fact('Client price', money(commercial?.client_price, quote?.currency)),
        fact('Margin amount', money(commercial?.margin_amount, quote?.currency)), fact('Margin', commercial?.margin_percent !== undefined ? `${number(commercial.margin_percent).toFixed(1)}%` : null),
        fact('Approval state', commercial?.status), fact('Approved at', date(commercial?.approved_at)),
      ]; break;
    case 'client-quote':
    case 'quote':
      facts = [...clientCommon,
        fact('Quote number', quote?.quote_number), fact('Revision', quote?.revision), fact('Quote status', quote?.status), fact('Issued date', date(quote?.issued_at)),
        fact('Valid until', date(quote?.valid_until)), fact('Scope', intake?.description), fact('Deliverables', intake?.deliverables), fact('Required date', date(intake?.deadline)),
        fact('Subtotal', money(quote?.subtotal, quote?.currency)), fact('VAT', money(quote?.vat, quote?.currency)), fact('Total', money(quote?.total, quote?.currency)), fact('Currency', quote?.currency),
      ]; break;
    case 'proposal':
      facts = [...clientCommon,
        fact('Project type', intake?.project_type || lead.project_type), fact('Discipline', intake?.discipline), fact('Scope', intake?.description),
        fact('Deliverables', intake?.deliverables), fact('Required date', date(intake?.deadline)), fact('Special requirements', intake?.special_requirements),
      ]; break;
    case 'scope-of-work':
    case 'statement-of-work':
    case 'client-requirements':
    case 'requirement-sheet':
      facts = [...clientCommon,
        fact('Project type', intake?.project_type || lead.project_type), fact('Discipline', intake?.discipline), fact('Scope', intake?.description),
        fact('Deliverables', intake?.deliverables), fact('Required date', date(intake?.deadline)), fact('Special requirements', intake?.special_requirements),
      ]; break;
    case 'vendor-safe-package':
    case 'vendor-instructions':
    case 'rfq-response':
      facts = [fact('Controlled case', referenceBase), fact('Project', lead.title || lead.project_type), fact('Discipline', intake?.discipline),
        fact('Scope', intake?.description), fact('Deliverables', intake?.deliverables), fact('Response due', date(reviewRequest?.response_due_at)),
        fact('Review status', reviewRequest?.status), fact('Controlled documents', documentCount ?? 0)]; break;
    case 'handover-pack':
      facts = [...internalCommon,
        fact('Project number', project?.project_number), fact('Delivery stage', project?.project_stage || project?.status),
        fact('Start date', date(project?.start_date)), fact('Due date', date(project?.due_date)), fact('Controlled documents', documentCount ?? 0),
        fact('Accepted value', money(quote?.total, quote?.currency)),
      ]; break;
    case 'completion-report':
      facts = [...clientCommon,
        fact('Project number', project?.project_number), fact('Delivery stage', project?.project_stage || project?.status),
        fact('Start date', date(project?.start_date)), fact('Due date', date(project?.due_date)), fact('Controlled documents', documentCount ?? 0),
        fact('Accepted value', money(quote?.total, quote?.currency)),
      ]; break;
    case 'invoice':
      facts = [...clientCommon,
        fact('Project number', project?.project_number), fact('Quote reference', quote?.quote_number),
        fact('Net amount', money(quote?.subtotal, quote?.currency)), fact('Tax', money(quote?.vat, quote?.currency)),
        fact('Amount due', money(quote?.total, quote?.currency)), fact('Currency', quote?.currency),
        fact('Payment method', 'Bank transfer'), fact('Payment reference', project?.project_number || quote?.quote_number || referenceBase),
      ]; break;
    case 'document-register':
      facts = [...internalCommon, fact('Controlled documents', documentCount ?? 0), fact('Project number', project?.project_number), fact('Current delivery stage', project?.project_stage || project?.status)]; break;
    default:
      facts = [...internalCommon, fact('Project type', intake?.project_type || lead.project_type), fact('Discipline', intake?.discipline), fact('Deliverables', intake?.deliverables)];
  }

  const warnings: string[] = [];
  if (!intake && ['scope-of-work','statement-of-work','client-requirements','requirement-sheet','partner-technical-assessment-report','proposal'].includes(slug)) warnings.push('No technical intake is linked to this case.');
  if (!quote && ['client-quote','quote','invoice'].includes(slug)) warnings.push('No client quote is linked to this case.');
  if (!project && ['handover-pack','completion-report','invoice'].includes(slug)) warnings.push('No delivery project is linked to this case.');

  return {
    connected: true,
    sourceLabel: project ? 'Live project record' : quote ? 'Live quote record' : 'Live case record',
    reference: `OP-${slug.replaceAll('-', '/').toUpperCase()}-${referenceBase}`,
    revision: text(quote?.revision, 'A'),
    issueState: warnings.length ? 'Draft / Missing information' : 'Ready for review',
    subject: text(lead.title || lead.project_type || lead.company_name),
    facts,
    warnings,
  };
}