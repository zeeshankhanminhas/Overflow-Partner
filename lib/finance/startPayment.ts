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

/**
 * Canonical application-side interpretation of the hard Project start-payment gate.
 *
 * Commercial terms own the required start-payment basis. Payments owns settlement.
 * Project/Execution only consume the resulting gate and must never ask the operator
 * to re-key the requirement.
 */
export async function resolveProjectStartPaymentGate(
  supabase: SupabaseClient,
  organisationId: string,
  projectId: string,
): Promise<ProjectStartPaymentGate> {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id,quote_id')
    .eq('organisation_id', organisationId)
    .eq('id', projectId)
    .single();
  if (projectError || !project) throw new Error(projectError?.message || 'Project not found.');

  const [{ data: terms, error: termsError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase
      .from('commercial_terms')
      .select('authorisation_basis,deposit_required_amount,deposit_percent')
      .eq('organisation_id', organisationId)
      .eq('project_id', projectId)
      .maybeSingle(),
    supabase
      .from('payments')
      .select('amount,status,invoice_id')
      .eq('organisation_id', organisationId)
      .eq('project_id', projectId)
      .eq('status', 'cleared'),
  ]);
  if (termsError) throw new Error(termsError.message);
  if (paymentsError) throw new Error(paymentsError.message);

  let quoteTotal = 0;
  let currency = 'GBP';
  if (project.quote_id) {
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('total,currency')
      .eq('organisation_id', organisationId)
      .eq('id', project.quote_id)
      .single();
    if (quoteError || !quote) throw new Error(quoteError?.message || 'Accepted Client Quote could not be resolved.');
    quoteTotal = amount(quote.total);
    currency = String(quote.currency || 'GBP').trim() || 'GBP';
  }

  const invoiceIds = Array.from(new Set((payments || []).map(payment => String(payment.invoice_id || '')).filter(Boolean)));
  let validInvoiceIds = new Set<string>();
  if (invoiceIds.length > 0) {
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id,status')
      .eq('organisation_id', organisationId)
      .eq('project_id', projectId)
      .in('id', invoiceIds);
    if (invoicesError) throw new Error(invoicesError.message);
    validInvoiceIds = new Set(
      (invoices || [])
        .filter(invoice => !['draft','cancelled','refunded'].includes(String(invoice.status)))
        .map(invoice => String(invoice.id)),
    );
  }

  // Only cleared money tied to a governed, non-draft Project invoice can unlock execution.
  const received = (payments || []).reduce(
    (sum, payment) => validInvoiceIds.has(String(payment.invoice_id || '')) ? sum + amount(payment.amount) : sum,
    0,
  );
  const depositPercent = amount(terms?.deposit_percent);
  const explicitRequired = amount(terms?.deposit_required_amount);
  const basis = terms?.authorisation_basis ? String(terms.authorisation_basis) : null;

  // Zero-value work has no monetary start requirement. Positive-value work always does.
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
