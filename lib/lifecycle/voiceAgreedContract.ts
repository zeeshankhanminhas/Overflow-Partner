/** Authoritative product decisions from the OPOS operator's 21 October lifecycle walkthrough.
 * Existing records and database invariants remain authoritative until their gated migrations ship.
 */
export const OPOS_POLICY = {
  defaultGrossMarginPct: 33,
  quotationValidityDays: 14,
  openingPaymentRatio: 0.30,
  clientReviewWorkingDays: 7,
  includedConsolidatedCorrectionRounds: 1,
  separateRevisionAndOutOfScopePricing: true,
  reviewMode: 'partner_led_senior_engineer',
  clientReviewRelease: 'manual_opos_approval',
  finalFilesRelease: 'manual_after_full_payment',
  partnerPayment: 'manual_record_after_final_delivery',
  projectClosure: 'manual',
} as const;

export const OPOS_PHASES = [
  'opportunity','requirements','feasibility','commercial_offer','contractual_commitment',
  'mobilisation','execution','quality_assurance','delivery','payment_settlement','closure',
] as const;

export type ClientFeedbackCategory = 'in_scope_correction' | 'revision' | 'out_of_scope_change';
export type ClientFeedbackDecision =
  | 'included_correction' | 'partner_defect_rework' | 'new_paid_variation' | 'correction_round_exhausted';

export function grossMarginToMarkup(marginPct: number) {
  if(!Number.isFinite(marginPct) || marginPct < 0 || marginPct >= 100) throw new Error('Gross margin must be from 0 up to but not including 100.');
  return marginPct / (100 - marginPct) * 100;
}
export function openingPayment(quoteTotal: number, ratio = OPOS_POLICY.openingPaymentRatio) {
  if(!Number.isFinite(quoteTotal)||quoteTotal <= 0) throw new Error('A positive contractual quote amount is required.');
  if(!Number.isFinite(ratio)||ratio <= 0||ratio>=1) throw new Error('Deposit share must be greater than zero and below 100%.');
  return Math.round((quoteTotal * ratio + Number.EPSILON) * 100) / 100;
}
export function finalBalance(quoteTotal: number, deposit = openingPayment(quoteTotal)) {
  if(!Number.isFinite(quoteTotal)||!Number.isFinite(deposit)||deposit<0||deposit>quoteTotal)throw new Error('Invalid final settlement amount.');
  return Math.round((quoteTotal - deposit + Number.EPSILON) * 100) / 100;
}
/** Weekends excluded. UK bank holidays require a specific calendar integration and are not excluded here. */
export function clientReviewDeadline(issuedOn: Date, workingDays = OPOS_POLICY.clientReviewWorkingDays) {
  if(Number.isNaN(issuedOn.getTime()) || !Number.isInteger(workingDays)||workingDays<=0)throw new Error('Valid issue date and working-day count required.');
  const deadline=new Date(issuedOn);
  deadline.setUTCHours(23,59,59,999);
  let counted=0;
  while(counted<workingDays){
    deadline.setUTCDate(deadline.getUTCDate()+1);
    if(deadline.getUTCDay()!==0 && deadline.getUTCDay()!==6) counted++;
  }
  return deadline;
}
export function classifyClientFeedback(input: {
  category: ClientFeedbackCategory;
  correctionRoundsUsed: number;
  defectAgainstApprovedScope: boolean;
}): ClientFeedbackDecision {
  if(input.defectAgainstApprovedScope) return 'partner_defect_rework';
  if(input.category==='revision'||input.category==='out_of_scope_change') return 'new_paid_variation';
  return input.correctionRoundsUsed < OPOS_POLICY.includedConsolidatedCorrectionRounds
    ? 'included_correction' : 'correction_round_exhausted';
}
export function canReleaseClientReview(input: {partnerSeniorQcApproved:boolean; documentsCurrent:boolean; ownerApproved:boolean}) {
  return input.partnerSeniorQcApproved && input.documentsCurrent && input.ownerApproved;
}
export function canReleaseFinalFiles(input: {clientReviewResolved:boolean; finalPaymentVerified:boolean; ownerApproved:boolean; approvedRevisionCurrent:boolean}) {
  return input.clientReviewResolved && input.finalPaymentVerified && input.ownerApproved && input.approvedRevisionCurrent;
}
export function canRecordPartnerPaid(input: {clientFullyPaid:boolean; finalPackageReleased:boolean; partnerInvoicePresent:boolean; ownerApproved:boolean; bankPaymentReference:string}) {
  return input.clientFullyPaid && input.finalPackageReleased && input.partnerInvoicePresent && input.ownerApproved && Boolean(input.bankPaymentReference.trim());
}
export function canCloseProject(input: {clientPaid:boolean; partnerPaid:boolean; deliveryRecorded:boolean; controlledDocsComplete:boolean; ownerApproved:boolean}) {
  return input.clientPaid&&input.partnerPaid&&input.deliveryRecorded&&input.controlledDocsComplete&&input.ownerApproved;
}
