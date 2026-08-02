'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { partnerSchema, partnerQuoteSchema, commercialReviewSchema, clientQuoteSchema, projectSchema, taskSchema } from '@/lib/validation/workflow';
import { createPartner, createPartnerQuote, createCommercialReview, createClientQuote, createProject, createTask } from '@/lib/repositories/workflow';
import { recordActivity } from '@/lib/repositories/activity';

const roles = ['owner', 'admin', 'operator', 'engineering', 'commercial', 'business_development'] as const;

async function run<T>(formData: FormData, config: { schema: { safeParse: (value: unknown) => any }; create: (ctx: any, input: any) => Promise<T>; entityType: string; eventType: string; path: string }) {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, [...roles]);
    const parsed = config.schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message || 'Invalid form data.' };
    const data = await config.create({ supabase, user, organisationId }, parsed.data);
    await recordActivity(supabase, { organisationId, entityType: config.entityType, entityId: (data as { id: string }).id, userId: user.id, eventType: config.eventType, newValue: data });
    revalidatePath(config.path); revalidatePath('/workspace');
    return { ok: true as const, data };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : 'Operation failed.' }; }
}

export async function createPartnerFormAction(formData: FormData) {
  const result = await run(formData, { schema: partnerSchema, create: ({ supabase, user, organisationId }, input) => createPartner(supabase, organisationId, user.id, input), entityType: 'partner', eventType: 'partner.created', path: '/workspace/partners' });
  redirect(result.ok ? '/workspace/partners?created=1' : `/workspace/partners?error=${encodeURIComponent(result.error)}`);
}
export async function createPartnerQuoteFormAction(formData: FormData) {
  const result = await run(formData, { schema: partnerQuoteSchema, create: ({ supabase, user, organisationId }, input) => createPartnerQuote(supabase, organisationId, user.id, input), entityType: 'partner_quote', eventType: 'partner_quote.created', path: '/workspace/partner-quotes' });
  redirect(result.ok ? '/workspace/partner-quotes?created=1' : `/workspace/partner-quotes?error=${encodeURIComponent(result.error)}`);
}
export async function createCommercialReviewFormAction(formData: FormData) {
  const result = await run(formData, { schema: commercialReviewSchema, create: ({ supabase, user, organisationId }, input) => createCommercialReview(supabase, organisationId, user.id, input), entityType: 'commercial_review', eventType: 'commercial_review.created', path: '/workspace/commercial-reviews' });
  redirect(result.ok ? '/workspace/commercial-reviews?created=1' : `/workspace/commercial-reviews?error=${encodeURIComponent(result.error)}`);
}
export async function createClientQuoteFormAction(formData: FormData) {
  const result = await run(formData, { schema: clientQuoteSchema, create: ({ supabase, user, organisationId }, input) => createClientQuote(supabase, organisationId, user.id, input), entityType: 'quote', eventType: 'quote.created', path: '/workspace/quotes' });
  redirect(result.ok ? '/workspace/quotes?created=1' : `/workspace/quotes?error=${encodeURIComponent(result.error)}`);
}
export async function createProjectFormAction(formData: FormData) {
  const result = await run(formData, { schema: projectSchema, create: ({ supabase, user, organisationId }, input) => createProject(supabase, organisationId, user.id, input), entityType: 'project', eventType: 'project.created', path: '/workspace/projects' });
  redirect(result.ok ? '/workspace/projects?created=1' : `/workspace/projects?error=${encodeURIComponent(result.error)}`);
}
export async function createTaskFormAction(formData: FormData) {
  const result = await run(formData, { schema: taskSchema, create: ({ supabase, user, organisationId }, input) => createTask(supabase, organisationId, user.id, input), entityType: 'task', eventType: 'task.created', path: '/workspace/tasks' });
  redirect(result.ok ? '/workspace/tasks?created=1' : `/workspace/tasks?error=${encodeURIComponent(result.error)}`);
}
