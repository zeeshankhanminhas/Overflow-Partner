import type { SupabaseClient } from '@supabase/supabase-js';

export type ProjectStartPaymentGate = {
  authorised: boolean;
  reason: string;
  required: number;
  received: number;
  quoteTotal: number;
  depositPercent: number;
  basis: string | null;
  currency: string;
};

function amount(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function gateFromEvidence({
  terms,
  payments,
  validInvoiceIds,
  quote,
}: {
  terms: any | null;
  payments: any[];
  validInvoiceIds: Set<string>;
  quote: any | null;
}): ProjectStartPaymentGate {
  const quoteTotal = amount(quote?.total);
  const currency = String(quote?.currency || 'GBP').trim() || 'GBP';
  const received = payments.reduce(
    (sum, payment) => validInvoiceIds.has(String(payment.invoice_id || '')) ? sum + amount(payment.amount) : sum,
    0,
  );
  const depositPercent = amount(terms?.deposit_percent);
  const explicitRequired = amount(terms?.deposit_required_amount);
  const basis = terms?.authorisation_basis ? String(terms.authorisation_basis) : null;

  if (quoteTotal <= 0) {
    return {
      authorised: true,
      reason: 'Zero-value Project has no client start-payment requirement.',
      required: 0,
      received,
      quoteTotal,
      depositPercent,
      basis,
      currency,
    };
  }

  if (!terms) {
    return {
      authorised: false,
      reason: 'Start-payment terms have not been configured from the accepted commercial position.',
      required: 0,
      received,
      quoteTotal,
      depositPercent: 0,
      basis: null,
      currency,
    };
  }

  const required = explicitRequired > 0
    ? explicitRequired
    : depositPercent > 0
      ? Math.round((quoteTotal * depositPercent / 100) * 100) / 100
      : 0;

  if (required <= 0) {
    return {
      authorised: false,
      reason: 'Positive-value work requires an explicit start-payment amount or percentage before mobilisation can complete.',
      required,
      received,
      quoteTotal,
      depositPercent,
      basis,
      currency,
    };
  }

  const authorised = received + 0.009 >= required;
  return {
    authorised,
    reason: authorised
      ? 'Required client start payment has been received and cleared.'
      : 'Required client start payment is still outstanding.',
    required,
    received,
    quoteTotal,
    depositPercent,
    basis,
    currency,
  };
}

/**
 * Batched canonical interpretation used by registers/read models.
 * The lifecycle truth is identical to the single-project resolver, but repeated
 * Project rows no longer trigger an N+1 chain of Project/terms/payment/quote/invoice reads.
 */
export async function resolveProjectStartPaymentGates(
  supabase: SupabaseClient,
  organisationId: string,
  projectIds: string[],
): Promise<Map<string, ProjectStartPaymentGate>> {
  const ids = Array.from(new Set(projectIds.map(String).filter(Boolean)));
  if (!ids.length) return new Map();

  const [{ data: projects, error: projectError }, { data: termsRows, error: termsError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from('projects').select('id,quote_id').eq('organisation_id', organisationId).in('id', ids),
    supabase.from('commercial_terms').select('project_id,authorisation_basis,deposit_required_amount,deposit_percent').eq('organisation_id', organisationId).in('project_id', ids),
    supabase.from('payments').select('project_id,amount,status,invoice_id').eq('organisation_id', organisationId).in('project_id', ids).eq('status', 'cleared'),
  ]);
  if (projectError) throw new Error(projectError.message);
  if (termsError) throw new Error(termsError.message);
  if (paymentsError) throw new Error(paymentsError.message);

  const projectMap = new Map((projects || []).map((project: any) => [String(project.id), project]));
  const missing = ids.find(id => !projectMap.has(id));
  if (missing) throw new Error('Project not found.');

  const quoteIds = Array.from(new Set((projects || []).map((project: any) => String(project.quote_id || '')).filter(Boolean)));
  const invoiceIds = Array.from(new Set((payments || []).map((payment: any) => String(payment.invoice_id || '')).filter(Boolean)));
  const [{ data: quotes, error: quotesError }, { data: invoices, error: invoicesError }] = await Promise.all([
    quoteIds.length
      ? supabase.from('quotes').select('id,total,currency').eq('organisation_id', organisationId).in('id', quoteIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    invoiceIds.length
      ? supabase.from('invoices').select('id,project_id,status').eq('organisation_id', organisationId).in('project_id', ids).in('id', invoiceIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);
  if (quotesError) throw new Error(quotesError.message);
  if (invoicesError) throw new Error(invoicesError.message);

  const quoteMap = new Map((quotes || []).map((quote: any) => [String(quote.id), quote]));
  const termsMap = new Map((termsRows || []).map((terms: any) => [String(terms.project_id), terms]));
  const paymentsMap = new Map<string, any[]>();
  for (const payment of payments || []) {
    const key = String((payment as any).project_id);
    paymentsMap.set(key, [...(paymentsMap.get(key) || []), payment]);
  }
  const validInvoicesByProject = new Map<string, Set<string>>();
  for (const invoice of invoices || []) {
    if (['draft', 'cancelled', 'refunded'].includes(String((invoice as any).status))) continue;
    const key = String((invoice as any).project_id);
    const set = validInvoicesByProject.get(key) || new Set<string>();
    set.add(String((invoice as any).id));
    validInvoicesByProject.set(key, set);
  }

  const result = new Map<string, ProjectStartPaymentGate>();
  for (const id of ids) {
    const project: any = projectMap.get(id);
    const quoteId = String(project?.quote_id || '');
    if (quoteId && !quoteMap.has(quoteId)) throw new Error('Accepted Client Quote could not be resolved.');
    result.set(id, gateFromEvidence({
      terms: termsMap.get(id) || null,
      payments: paymentsMap.get(id) || [],
      validInvoiceIds: validInvoicesByProject.get(id) || new Set<string>(),
      quote: quoteId ? quoteMap.get(quoteId) || null : null,
    }));
  }
  return result;
}

/**
 * Canonical application-side interpretation of the hard Project start-payment gate.
 * Commercial terms own the required start-payment basis. Payments owns settlement.
 * Project/Execution only consume the resulting gate and must never ask the operator
 * to re-key the requirement.
 */
export async function resolveProjectStartPaymentGate(
  supabase: SupabaseClient,
  organisationId: string,
  projectId: string,
): Promise<ProjectStartPaymentGate> {
  const gates = await resolveProjectStartPaymentGates(supabase, organisationId, [projectId]);
  const gate = gates.get(projectId);
  if (!gate) throw new Error('Project not found.');
  return gate;
}

export async function assertProjectStartPaymentReceived(
  supabase: SupabaseClient,
  organisationId: string,
  projectId: string,
) {
  const gate = await resolveProjectStartPaymentGate(supabase, organisationId, projectId);
  if (!gate.authorised) {
    throw new Error(`${gate.reason} Required: ${gate.currency} ${gate.required.toFixed(2)}; cleared: ${gate.currency} ${gate.received.toFixed(2)}.`);
  }
  return gate;
}
