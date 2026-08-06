'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import {
  acceptQuoteAndCreateProject,
  approveCommercialAndGenerateQuote,
  approveTechnicalIntake,
  createCommercialReviewFromPartnerQuote,
  ensureTechnicalIntakeShell,
  issueClientQuote,
} from '@/lib/orchestration/service';

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}
function message(error: unknown) { return error instanceof Error ? error.message : 'Workflow action failed.'; }
function refreshCase(leadId: string) {
  revalidatePath('/workspace'); revalidatePath('/workspace/leads'); revalidatePath(`/workspace/leads/${leadId}`);
  revalidatePath('/workspace/projects'); revalidatePath('/workspace/quotes'); revalidatePath('/workspace/documents');
}
function caseUrl(leadId: string, params: Record<string, string>) { return `/workspace/leads/${leadId}?${new URLSearchParams(params).toString()}`; }

export async function createIntakeShellAction(formData: FormData) {
  const leadId = required(formData, 'lead_id'); let destination = `/workspace/leads/${leadId}`;
  try { const { supabase, organisationId, user } = await requireUserContext(); await ensureTechnicalIntakeShell(supabase, organisationId, user.id, leadId); refreshCase(leadId); destination = caseUrl(leadId, { success: 'Technical scope created from inherited case context.', resultStatus: 'Technical scope under review' }); }
  catch (error) { destination = caseUrl(leadId, { error: message(error) }); }
  redirect(destination);
}

export async function approveIntakeAction(formData: FormData) {
  const intakeId = required(formData, 'intake_id'); const suppliedLeadId = String(formData.get('lead_id') ?? '').trim(); let destination = suppliedLeadId ? `/workspace/leads/${suppliedLeadId}` : '/workspace/leads';
  try { const { supabase, organisationId, user } = await requireUserContext(); const intake = await approveTechnicalIntake(supabase, organisationId, user.id, intakeId); const leadId = suppliedLeadId || intake.lead_id; refreshCase(leadId); destination = caseUrl(leadId, { success: 'Technical scope approved.', resultStatus: 'Ready to select an execution partner' }); }
  catch (error) { destination = suppliedLeadId ? caseUrl(suppliedLeadId, { error: message(error) }) : `/workspace/leads?error=${encodeURIComponent(message(error))}`; }
  redirect(destination);
}

export async function createCommercialReviewAction(formData: FormData) {
  const partnerQuoteId = required(formData, 'partner_quote_id'); const leadId = required(formData, 'lead_id'); const markupPercent = Number(formData.get('markup_percent') ?? 30); let destination = `/workspace/leads/${leadId}`;
  try { if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 500) throw new Error('Markup must be between 0 and 500.'); const { supabase, organisationId, user } = await requireUserContext(); await createCommercialReviewFromPartnerQuote(supabase, organisationId, user.id, partnerQuoteId, markupPercent); refreshCase(leadId); destination = caseUrl(leadId, { success: 'Commercial position calculated from the approved partner response.', resultStatus: 'Commercial decision required' }); }
  catch (error) { destination = caseUrl(leadId, { error: message(error) }); }
  redirect(destination);
}

export async function approveCommercialAction(formData: FormData) {
  const reviewId = required(formData, 'commercial_review_id'); const leadId = required(formData, 'lead_id'); let destination = `/workspace/leads/${leadId}`;
  try { const { supabase, organisationId, user } = await requireUserContext(); const quote = await approveCommercialAndGenerateQuote(supabase, organisationId, user.id, reviewId, 'GBP', 20); refreshCase(leadId); destination = caseUrl(leadId, { success: `Draft quote ${quote.quote_number} generated. Create, sign, approve and issue its controlled document before commercial issue.`, resultStatus: 'Controlled quotation required', quote: quote.id }); }
  catch (error) { destination = caseUrl(leadId, { error: message(error) }); }
  redirect(destination);
}

export async function issueQuoteAction(formData: FormData) {
  const quoteId = required(formData, 'quote_id'); const leadId = required(formData, 'lead_id'); let destination = `/workspace/leads/${leadId}`;
  try { const { supabase, organisationId, user } = await requireUserContext(); const quote = await issueClientQuote(supabase, organisationId, user.id, quoteId); refreshCase(leadId); destination = caseUrl(leadId, { success: `Quote ${quote.quote_number} issued.`, resultStatus: 'Awaiting client decision', quote: quote.id }); }
  catch (error) { destination = caseUrl(leadId, { error: message(error) }); }
  redirect(destination);
}

export async function acceptQuoteAction(formData: FormData) {
  const quoteId = required(formData, 'quote_id'); const leadId = required(formData, 'lead_id'); let destination = `/workspace/leads/${leadId}`;
  try { const { supabase, organisationId, user } = await requireUserContext(); const project = await acceptQuoteAndCreateProject(supabase, organisationId, user.id, quoteId); refreshCase(leadId); destination = caseUrl(leadId, { success: `Project ${project.project_number} created from the accepted and controlled-issued quote.`, resultStatus: 'Project ready', project: project.id }); }
  catch (error) { destination = caseUrl(leadId, { error: message(error) }); }
  redirect(destination);
}

export async function recordQuoteOutcomeAction(formData: FormData) {
  const quoteId = required(formData, 'quote_id'); const leadId = required(formData, 'lead_id'); const outcome = required(formData, 'outcome'); const note = String(formData.get('note') ?? '').trim(); let destination = `/workspace/leads/${leadId}`;
  try {
    if (!['rejected', 'expired', 'withdrawn'].includes(outcome)) throw new Error('Invalid quotation outcome.');
    const { supabase, organisationId, user } = await requireUserContext();
    const { data, error } = await supabase.rpc('op_record_quote_outcome', { p_organisation_id: organisationId, p_user_id: user.id, p_quote_id: quoteId, p_outcome: outcome, p_note: note || null });
    if (error) throw new Error(error.message);
    refreshCase(leadId); destination = caseUrl(leadId, { success: `Quotation ${String(data?.quote_number || '')} marked ${outcome}.`, resultStatus: `Quote ${outcome}` });
  } catch (error) { destination = caseUrl(leadId, { error: message(error) }); }
  redirect(destination);
}

export async function reviseQuoteAction(formData: FormData) {
  const quoteId = required(formData, 'quote_id'); const leadId = required(formData, 'lead_id'); const note = String(formData.get('note') ?? '').trim(); let destination = `/workspace/leads/${leadId}`;
  try {
    const { supabase, organisationId, user } = await requireUserContext();
    const { data, error } = await supabase.rpc('op_revise_quote', { p_organisation_id: organisationId, p_user_id: user.id, p_quote_id: quoteId, p_note: note || null });
    if (error) throw new Error(error.message);
    refreshCase(leadId); destination = caseUrl(leadId, { success: `Quotation revision ${String(data?.revision || '')} opened. Previous controlled publication archived.`, resultStatus: 'Draft revision requires new controlled document' });
  } catch (error) { destination = caseUrl(leadId, { error: message(error) }); }
  redirect(destination);
}
