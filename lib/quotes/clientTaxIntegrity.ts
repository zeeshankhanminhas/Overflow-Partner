/**
 * Fail closed when client-facing quotation wording conflicts with charged tax.
 * Partner cost exclusions are not automatically acceptable client exclusions.
 * Run this before issuing a NEW controlled quote; never rewrite a sent revision.
 */
export function assertClientQuoteTaxIntegrity(input:{
  subtotal:number;vat:number;total:number;exclusions?:string|null;
}):void {
  const {subtotal,vat,total}=input;
  if (![subtotal,vat,total].every(Number.isFinite) || subtotal<0 || vat<0 || total<0) {
    throw new Error('Client quotation tax amounts must be valid non-negative numbers.');
  }
  const pence=(v:number)=>Math.round(v*100);
  if (Math.abs(pence(subtotal)+pence(vat)-pence(total))>1) {
    throw new Error('Client quotation subtotal, VAT and total do not reconcile.');
  }
  // VAT mentioned in an exclusions clause is ambiguous to the customer when
  // charged on this quotation. Require explicit commercial review rather than
  // silently deleting a contractual exclusion or producing a contradictory PDF.
  if (vat>0 && /\b(?:VAT|value[\s-]*added\s+tax)\b/i.test(input.exclusions||'')) {
    throw new Error('Client quote exclusions mention VAT while VAT is charged. Correct and approve the client-facing terms before issuing a new controlled quotation revision.');
  }
}
