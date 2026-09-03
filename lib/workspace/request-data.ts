import { cache } from 'react';
import { requireUserContext } from '@/lib/auth/context';
import { getOperationalExceptions } from '@/lib/operations/exceptions';
import { getApprovalQueue } from '@/lib/presentation/approvals';

/** Request-scoped workspace chrome data, shared by layouts and pages. */
export const getWorkspaceChromeData = cache(async () => {
  const context = await requireUserContext();
  const [approvals, exceptions] = await Promise.all([
    getApprovalQueue(context.supabase, context.organisationId),
    getOperationalExceptions(context.supabase, context.organisationId),
  ]);
  return { context, approvals, exceptions };
});
