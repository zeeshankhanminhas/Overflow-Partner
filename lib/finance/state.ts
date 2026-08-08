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

const terminalInvoiceStates = new Set(['cancelled', 'refunded']);
const terminalPayableStates = new Set(['cancelled', 'disputed']);

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
