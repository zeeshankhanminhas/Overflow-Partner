'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { companyInputSchema } from '@/lib/validation/companies';
import { createCompany } from '@/lib/repositories/companies';
import { recordActivity } from '@/lib/repositories/activity';

export async function createCompanyAction(formData: FormData) {
  const { supabase, user, profile, organisationId } = await requireUserContext();
  assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);

  const parsed = companyInputSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    redirect(`/workspace/companies?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid company details')}`);
  }

  try {
    const company = await createCompany(supabase, organisationId, user.id, parsed.data);
    await recordActivity(supabase, {
      organisationId,
      entityType: 'company',
      entityId: company.id,
      userId: user.id,
      eventType: 'company.created',
      newValue: company,
    });
    revalidatePath('/workspace/companies');
    revalidatePath('/workspace');
    redirect('/workspace/companies?created=1');
  } catch (error) {
    redirect(`/workspace/companies?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unable to create company')}`);
  }
}
