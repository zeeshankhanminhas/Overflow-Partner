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

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Workflow action failed.';
}

function refreshCase(leadId?: string | null) {
  revalidatePath('/workspace');
  revalidatePath('/workspace/leads');
  revalidatePath('/workspace/quotes');
  revalidatePath('/workspace/projects');
  revalidatePath('/workspace/commercial-reviews');
  if (leadId) revalidatePath(`/workspace/leads/${leadId}`);
}

export async function createIntakeShellAction(formData: FormData) {
  const leadId = required(formData, 'lead_id');
  let destination = `/workspace/leads/${leadId}`;
  try {
    const { supabase, organisationId, user } = await requireUserContext();
    await ensureTechnicalIntakeShell(supabase, organisationId, user.id, leadId);
    refreshCase(leadId);
    destination = `/workspace/leads/${leadId}?technicalScopeCreated=1`;
  } catch (error) {
    destination = `/workspace/leads/${leadId}?error=${encodeURIComponent(message(error))}`;
  }
  redirect(destination);
}

export async function approveIntakeAction(formData: FormData) {
  const intakeId = required(formData, 'intake_id');
  const leadId = String(formData.get('lead_id') ?? '').trim();
  let destination = leadId ? `/workspace/leads/${leadId}` : '/workspace/leads';
  try {
    const { supabase, organisationId, user } = await requireUserContext();
    const intake = await approveTechnicalIntake(supabase, organisationId, user.id, intakeId);
    const resolvedLeadId = leadId || intake.lead_id;
    refreshCase(resolvedLeadId);
    destination = `/workspace/leads/${resolvedLeadId}?technicalScopeApproved=1`;
  } catch (error) {
    destination = `${destination}?error=${encodeURIComponent(message(error))}`;
  }
  redirect(destination);
}

export async function createCommercialReviewAction(formData: FormData) {
  const partnerQuoteId = required(formData, 'partner_quote_id');
  const leadId = String(formData.get('lead_id') ?? '').trim();
  const markupPercent = Number(formData.get('markup_percent') ?? 30);
  let destination = leadId ? `/workspace/leads/${leadId}` : '/workspace/leads';
  try {
    if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 500) {
      throw new Error('Markup must be between 0 and 500.');
    }
    const { supabase, organisationId, user } = await requireUserContext();
    const review = await createCommercialReviewFromPartnerQuote(
      supabase, organisationId, user.id, partnerQuoteId, markupPercent,
    );
    const resolvedLeadId = leadId || review.lead_id;
    refreshCase(resolvedLeadId);
    destination = `/workspace/leads/${resolvedLeadId}?commercialReviewCreated=1`;
  } catch (error) {
    destination = `${destination}?error=${encodeURIComponent(message(error))}`;
  }
  redirect(destination);
}

export async function approveCommercialAction(formData: FormData) {
  const reviewId = required(formData, 'commercial_review_id');
  const leadId = String(formData.get('lead_id') ?? '').trim();
  const currency = String(formData.get('currency') ?? 'GBP').trim().toUpperCase();
  const vatRate = Number(formData.get('vat_rate') ?? 20);
  let destination = leadId ? `/workspace/leads/${leadId}` : '/workspace/quotes';
  try {
    const { supabase, organisationId, user } = await requireUserContext();
    const quote = await approveCommercialAndGenerateQuote(
      supabase, organisationId, user.id, reviewId, currency, vatRate,
    );
    refreshCase(quote.lead_id);
    destination = `/workspace/quotes?created=1&quote=${encodeURIComponent(quote.id)}&lead=${encodeURIComponent(quote.lead_id)}`;
  } catch (error) {
    destination = `${destination}?error=${encodeURIComponent(message(error))}`;
  }
  redirect(destination);
}

export async function issueQuoteAction(formData: FormData) {
  const quoteId = required(formData, 'quote_id');
  const leadId = String(formData.get('lead_id') ?? '').trim();
  let destination = `/workspace/quotes?quote=${encodeURIComponent(quoteId)}`;
  try {
    const { supabase, organisationId, user } = await requireUserContext();
    const quote = await issueClientQuote(supabase, organisationId, user.id, quoteId);
    refreshCase(leadId || quote.lead_id);
    destination = `/workspace/quotes?issued=1&quote=${encodeURIComponent(quote.id)}&lead=${encodeURIComponent(quote.lead_id)}`;
  } catch (error) {
    destination = `${destination}&error=${encodeURIComponent(message(error))}`;
  }
  redirect(destination);
}

export async function acceptQuoteAction(formData: FormData) {
  const quoteId = required(formData, 'quote_id');
  const leadId = String(formData.get('lead_id') ?? '').trim();
  let destination = `/workspace/quotes?quote=${encodeURIComponent(quoteId)}`;
  try {
    const { supabase, organisationId, user } = await requireUserContext();
    const project = await acceptQuoteAndCreateProject(supabase, organisationId, user.id, quoteId);
    refreshCase(leadId || project.lead_id);
    destination = `/workspace/projects?created=1&project=${encodeURIComponent(project.id)}&lead=${encodeURIComponent(project.lead_id)}`;
  } catch (error) {
    destination = `${destination}&error=${encodeURIComponent(message(error))}`;
  }
  redirect(destination);
}
