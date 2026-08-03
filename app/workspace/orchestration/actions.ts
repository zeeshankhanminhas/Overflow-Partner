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
} from '@/lib/orchestration/service';

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

async function execute(action: () => Promise<unknown>, success: string) {
  try {
    await action();
    revalidatePath('/workspace');
    revalidatePath('/workspace/orchestration');
    redirect(`/workspace/orchestration?success=${encodeURIComponent(success)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workflow action failed.';
    redirect(`/workspace/orchestration?error=${encodeURIComponent(message)}`);
  }
}

export async function createIntakeShellAction(formData: FormData) {
  const leadId = required(formData, 'lead_id');
  const { supabase, organisationId, user } = await requireUserContext();
  return execute(
    () => ensureTechnicalIntakeShell(supabase, organisationId, user.id, leadId),
    'Technical intake created from inherited lead data.',
  );
}

export async function approveIntakeAction(formData: FormData) {
  const intakeId = required(formData, 'intake_id');
  const { supabase, organisationId, user } = await requireUserContext();
  return execute(
    () => approveTechnicalIntake(supabase, organisationId, user.id, intakeId),
    'Technical intake approved and partner-pricing task created.',
  );
}

export async function createCommercialReviewAction(formData: FormData) {
  const partnerQuoteId = required(formData, 'partner_quote_id');
  const markupPercent = Number(formData.get('markup_percent') ?? 30);
  if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 500) {
    redirect('/workspace/orchestration?error=Markup%20must%20be%20between%200%20and%20500.');
  }
  const { supabase, organisationId, user } = await requireUserContext();
  return execute(
    () => createCommercialReviewFromPartnerQuote(supabase, organisationId, user.id, partnerQuoteId, markupPercent),
    'Commercial review generated from partner pricing.',
  );
}

export async function approveCommercialAction(formData: FormData) {
  const reviewId = required(formData, 'commercial_review_id');
  const { supabase, organisationId, user } = await requireUserContext();
  return execute(
    () => approveCommercialAndGenerateQuote(supabase, organisationId, user.id, reviewId),
    'Commercial review approved and client quote generated.',
  );
}

export async function acceptQuoteAction(formData: FormData) {
  const quoteId = required(formData, 'quote_id');
  const { supabase, organisationId, user } = await requireUserContext();
  return execute(
    () => acceptQuoteAndCreateProject(supabase, organisationId, user.id, quoteId),
    'Quote accepted; project and controlled document shells created.',
  );
}
