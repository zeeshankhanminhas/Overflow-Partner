/** Authoritative OP commercial lifecycle contract (policy, not a database migration).
 * Every case follows the same spine; the depth of evidence is risk-sensitive.
 * No UI-derived 'ready' state may override a server-side commercial release gate.
 */
export const OP_LIFECYCLE = [
  { key: 'acquisition', label: 'Opportunity and qualification', exit: 'Qualified opportunity and accountable contact' },
  { key: 'definition', label: 'Client requirements and technical definition', exit: 'Approved requirements and scoped deliverables' },
  { key: 'partner_assessment', label: 'Execution Partner feasibility and costing', exit: 'Approved formal assessment, capacity and partner cost' },
  { key: 'commercial_review', label: 'OP commercial review and quotation', exit: 'Authorised current quotation and expiry' },
  { key: 'client_release', label: 'Client acceptance and commercial release', exit: 'Secure authorised acceptance and verified agreed release condition' },
  { key: 'mobilisation', label: 'Project creation, SOW and partner mobilisation', exit: 'Exactly one project, partner commitment and controlled SOW' },
  { key: 'execution', label: 'Partner execution, progress and quality controls', exit: 'Partner deliverables and review evidence complete' },
  { key: 'delivery', label: 'OP verification and authorised client delivery', exit: 'OP release, controlled transmittal and client acceptance' },
  { key: 'closeout', label: 'Outstanding settlements and closure', exit: 'Receivables, payables and contractual obligations reconciled' },
] as const;

export type LifecycleStage = (typeof OP_LIFECYCLE)[number]['key'];
export type GovernanceTier = 'standard' | 'enhanced';
export type PartnerReviewPurpose = 'preliminary_consultation' | 'formal_assessment';
export type ReleaseCondition = 'full_advance' | 'deposit' | 'approved_purchase_order' | 'approved_credit' | 'no_advance_due';
export type ExceptionType = 'clarification' | 'scope_revision' | 're_quotation' | 'change_order' | 'delay' | 'partner_failure' | 'dispute' | 'cancellation' | 'refund';

/** Classification is policy driven. Never automatically downgrade a high-risk job because its price is low. */
export function classifyGovernance(input: {
  contractValueGbp: number;
  technicalComplexity: 'routine' | 'complex';
  deliveryRisk: 'low' | 'high';
  regulatedOrSafetyCritical: boolean;
  thresholdGbp?: number;
}): GovernanceTier {
  if (!Number.isFinite(input.contractValueGbp) || input.contractValueGbp < 0) throw new Error('Valid contract value required');
  if (input.technicalComplexity === 'complex' || input.deliveryRisk === 'high' || input.regulatedOrSafetyCritical) return 'enhanced';
  return input.contractValueGbp >= (input.thresholdGbp ?? 5000) ? 'enhanced' : 'standard';
}

/** Preliminary consultation can inform requirements; only formal assessment can authorise a priced offer. */
export function canUsePartnerReviewForCommercialOffer(purpose: PartnerReviewPurpose, approved: boolean): boolean {
  return purpose === 'formal_assessment' && approved;
}

/** Acceptance alone never releases a project. Terms are frozen in the accepted quotation. */
export function evaluateCommercialRelease(input: {
  acceptanceVerified: boolean;
  quotationCurrent: boolean;
  conditionInAcceptedQuote: ReleaseCondition;
  evidence: { paymentVerified?: boolean; depositVerified?: boolean; purchaseOrderApproved?: boolean; creditApproved?: boolean; noAdvanceApproved?: boolean };
}): { permitted: boolean; reason: string } {
  if (!input.quotationCurrent) return { permitted: false, reason: 'Quotation is expired, withdrawn or superseded.' };
  if (!input.acceptanceVerified) return { permitted: false, reason: 'Authorised client acceptance is required.' };
  const evidence = input.evidence;
  const satisfied: Record<ReleaseCondition, boolean> = {
    full_advance: evidence.paymentVerified === true,
    deposit: evidence.depositVerified === true,
    approved_purchase_order: evidence.purchaseOrderApproved === true,
    approved_credit: evidence.creditApproved === true,
    no_advance_due: evidence.noAdvanceApproved === true,
  };
  return satisfied[input.conditionInAcceptedQuote]
    ? { permitted: true, reason: 'Agreed contractual release condition verified.' }
    : { permitted: false, reason: 'The release condition in the accepted quotation is not verified.' };
}

export const CONTROLLED_EXCEPTION_TYPES: readonly ExceptionType[] = [
  'clarification', 'scope_revision', 're_quotation', 'change_order', 'delay',
  'partner_failure', 'dispute', 'cancellation', 'refund',
] as const;
