export type InvoiceLike = {
  id: string;
  status?: string | null;
  total?: number | string | null;
  amount_paid?: number | string | null;
  due_date?: string | null;
};

export type PayableLike = {
  id: string;
  status?: string | null;
  total?: number | string | null;
  amount_paid?: number | string | null;
  evidence_confirmed?: boolean | null;
};

export type FinancialGateLike = {
  authorised?: boolean | null;
  basis?: string | null;
  required?: number | string | null;
  received?: number | string | null;
  reason?: string | null;
};

export type ResolvedInvoiceState = {
  status: string;
  displayStatus: string;
  balance: number;
  overdue: boolean;
  canIssue: boolean;
  canRecordPayment: boolean;
  settled: boolean;
};

export type ResolvedPayableState = {
  status: string;
  displayStatus: string;
  balance: number;
  canApprove: boolean;
  approvalBlockedReason: string | null;
  canRecordPayment: boolean;
  settled: boolean;
};

export type ResolvedFinancialGate = {
  authorised: boolean;
  displayState: 'Authorised' | 'Blocked';
  reason: string;
  required: number;
  received: number;
  shortfall: number;
  basis: string;
};

export type BillingInvoiceType = 'deposit' | 'milestone' | 'final' | 'credit_note';
export type BillingEligibilityInput = {
  invoiceType: BillingInvoiceType;
  projectStage?: string | null;
  projectStatus?: string | null;
  authorisationBasis?: string | null;
  depositRequiredAmount?: number | string | null;
  depositPercent?: number | string | null;
  deliveryMilestoneAchieved?: boolean;
  hasEligibleSourceInvoice?: boolean;
};
export type BillingEligibility = {
  permitted: boolean;
  invoiceType: BillingInvoiceType;
  reason: string;
  blockingRule: string | null;
  nextAction: string;
};

const terminalInvoiceStates = new Set(['cancelled', 'refunded']);
const terminalPayableStates = new Set(['cancelled', 'disputed']);
const milestoneStages = new Set(['internal_review','partner_correction','ready_for_client_issue','issued_to_client','client_review','completion','closed']);
const finalStages = new Set(['completion','closed']);

function amount(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ');
}

export function resolveInvoiceState(invoice: InvoiceLike, now = new Date()): ResolvedInvoiceState {
  const status = String(invoice.status || 'draft');
  const total = amount(invoice.total);
  const paid = amount(invoice.amount_paid);
  const balance = Math.max(0, total - paid);
  const dueAt = invoice.due_date ? new Date(invoice.due_date) : null;
  const overdue = Boolean(
    dueAt &&
    !Number.isNaN(dueAt.getTime()) &&
    dueAt.getTime() < now.getTime() &&
    balance > 0 &&
    !['draft', 'paid', 'cancelled', 'refunded'].includes(status)
  );
  const settled = balance <= 0 || status === 'paid' || status === 'refunded';
  const canIssue = status === 'draft';
  const canRecordPayment = !settled && !terminalInvoiceStates.has(status) && status !== 'draft';

  return {
    status,
    displayStatus: overdue ? 'overdue' : statusLabel(status),
    balance,
    overdue,
    canIssue,
    canRecordPayment,
    settled,
  };
}

export function resolvePayableState(payable: PayableLike): ResolvedPayableState {
  const status = String(payable.status || 'received');
  const total = amount(payable.total);
  const paid = amount(payable.amount_paid);
  const balance = Math.max(0, total - paid);
  const evidenceConfirmed = Boolean(payable.evidence_confirmed);
  const eligibleForApproval = ['received', 'matched'].includes(status);
  const canApprove = eligibleForApproval && evidenceConfirmed;
  const approvalBlockedReason = eligibleForApproval && !evidenceConfirmed
    ? 'Delivery evidence must be confirmed before this payable can be approved.'
    : null;
  const settled = balance <= 0 || status === 'paid';
  const canRecordPayment = ['approved', 'scheduled', 'paid'].includes(status) && !settled && !terminalPayableStates.has(status);

  return {
    status,
    displayStatus: statusLabel(status),
    balance,
    canApprove,
    approvalBlockedReason,
    canRecordPayment,
    settled,
  };
}

export function resolveFinancialGate(gate: FinancialGateLike | null | undefined): ResolvedFinancialGate {
  const required = amount(gate?.required);
  const received = amount(gate?.received);
  const authorised = Boolean(gate?.authorised);
  return {
    authorised,
    displayState: authorised ? 'Authorised' : 'Blocked',
    reason: String(gate?.reason || 'Commercial terms have not been configured.'),
    required,
    received,
    shortfall: Math.max(0, required - received),
    basis: String(gate?.basis || 'not_set').replaceAll('_', ' '),
  };
}

export function resolveBillingEligibility(input: BillingEligibilityInput): BillingEligibility {
  const stage = String(input.projectStage || 'mobilisation');
  const status = String(input.projectStatus || 'planning');
  if (['cancelled'].includes(status)) {
    return { permitted:false, invoiceType:input.invoiceType, reason:'Billing is unavailable for a cancelled project.', blockingRule:'PROJECT_CANCELLED', nextAction:'Review project status' };
  }

  if (input.invoiceType === 'deposit') {
    const basis = String(input.authorisationBasis || '');
    const depositRequired = amount(input.depositRequiredAmount) > 0 || amount(input.depositPercent) > 0;
    const permitted = basis === 'deposit' && depositRequired && ['mobilisation','ready_for_execution'].includes(stage);
    return permitted
      ? { permitted:true, invoiceType:'deposit', reason:'A deposit is part of the agreed pre-execution commercial terms.', blockingRule:null, nextAction:'Create deposit invoice' }
      : { permitted:false, invoiceType:'deposit', reason:'A deposit invoice is allowed only when the commercial terms require a deposit before execution.', blockingRule:'DEPOSIT_NOT_REQUIRED', nextAction:'Review commercial terms' };
  }

  if (input.invoiceType === 'milestone') {
    const achieved = Boolean(input.deliveryMilestoneAchieved) && milestoneStages.has(stage);
    return achieved
      ? { permitted:true, invoiceType:'milestone', reason:'The project has reached an evidenced billable delivery milestone.', blockingRule:null, nextAction:'Create milestone invoice' }
      : { permitted:false, invoiceType:'milestone', reason:'Milestone billing is unavailable until governed delivery work reaches an evidenced billable milestone.', blockingRule:'MILESTONE_NOT_ACHIEVED', nextAction:'Complete delivery milestone' };
  }

  if (input.invoiceType === 'final') {
    const permitted = finalStages.has(stage);
    return permitted
      ? { permitted:true, invoiceType:'final', reason:'The project has reached completion and is eligible for final billing.', blockingRule:null, nextAction:'Create final invoice' }
      : { permitted:false, invoiceType:'final', reason:'Final billing is unavailable until the project reaches Completion.', blockingRule:'PROJECT_NOT_COMPLETE', nextAction:'Complete project delivery' };
  }

  const permitted = Boolean(input.hasEligibleSourceInvoice);
  return permitted
    ? { permitted:true, invoiceType:'credit_note', reason:'An issued project invoice exists against which a credit can be raised.', blockingRule:null, nextAction:'Create credit note' }
    : { permitted:false, invoiceType:'credit_note', reason:'A credit note requires an existing issued or settled invoice on this project.', blockingRule:'NO_SOURCE_INVOICE', nextAction:'Select an eligible invoice' };
}
