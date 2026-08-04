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

async function execute(action: () => Promise<unknown>, success: string) {
  let destination = `/workspace/orchestration?success=${encodeURIComponent(success)}`;
  try {
    await action();
    revalidatePath('/workspace');
    revalidatePath('/workspace/orchestration');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workflow action failed.';
    destination = `/workspace/orchestration?error=${encodeURIComponent(message)}`;
  }
  redirect(destination);
}

export async function createIntakeShellAction(formData: FormData) {
  const leadId = required(formData, 'lead_id');
  const { supabase, organisationId, user } = await requireUserContext();
  return execute(() => ensureTechnicalIntakeShell(supabase, organisationId, user.id, leadId),
    'Technical intake created from inherited lead data.');
}

export async function approveIntakeAction(formData: FormData) {
  const intakeId = required(formData, 'intake_id');
  const { supabase, organisationId, user } = await requireUserContext();
  return execute(() => approveTechnicalIntake(supabase, organisationId, user.id, intakeId),
    'Technical intake approved. Compliant partner pricing is now required.');
}

export async function createCommercialReviewAction(formData: FormData) {
  const partnerQuoteId = required(formData, 'partner_quote_id');
  const markupPercent = Number(formData.get('markup_percent') ?? 30);
  if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 500) {
    redirect('/workspace/orchestration?error=Markup%20must%20be%20between%200%20and%20500.');
  }
  const { supabase, organisationId, user } = await requireUserContext();
  return execute(() => createCommercialReviewFromPartnerQuote(supabase, organisationId, user.id, partnerQuoteId, markupPercent),
    'Compliant partner quote selected and commercial review generated.');
}

export async function approveCommercialAction(formData: FormData) {
  const reviewId = required(formData, 'commercial_review_id');
  const currency = String(formData.get('currency') ?? 'GBP').trim().toUpperCase();
  const vatRate = Number(formData.get('vat_rate') ?? 20);
  const { supabase, organisationId, user } = await requireUserContext();
  return execute(() => approveCommercialAndGenerateQuote(supabase, organisationId, user.id, reviewId, currency, vatRate),
    'Commercial position approved and draft client quote generated.');
}

export async function issueQuoteAction(formData: FormData) {
  const quoteId = required(formData, 'quote_id');
  const { supabase, organisationId, user } = await requireUserContext();
  return execute(() => issueClientQuote(supabase, organisationId, user.id, quoteId),
    'Client quote issued. Acceptance may now be recorded.');
}

export async function acceptQuoteAction(formData: FormData) {
  const quoteId = required(formData, 'quote_id');
  const { supabase, organisationId, user } = await requireUserContext();
  return execute(() => acceptQuoteAndCreateProject(supabase, organisationId, user.id, quoteId),
    'Issued quote accepted; project and controlled documents created transactionally.');
}
