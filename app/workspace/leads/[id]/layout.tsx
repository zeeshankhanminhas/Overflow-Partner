import type { ReactNode } from 'react';
import { requireUserContext } from '@/lib/auth/context';
import DocumentGenerationPanel from '@/components/workspace/documents/DocumentGenerationPanel';

export default async function CaseLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organisationId } = await requireUserContext();

  const [{ data: intake }, { data: review }, { data: commercial }, { data: quote }] = await Promise.all([
    supabase.from('technical_intakes').select('id,status').eq('organisation_id', organisationId).eq('lead_id', id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('partner_review_requests').select('id,status').eq('organisation_id', organisationId).eq('lead_id', id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('commercial_reviews').select('id,status').eq('organisation_id', organisationId).eq('lead_id', id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('quotes').select('id,status').eq('organisation_id', organisationId).eq('lead_id', id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
  ]);

  const scopeApproved = intake?.status === 'approved';
  const partnerResponseReady = Boolean(review && ['submitted','approved','approved_with_conditions','clarification_required'].includes(review.status));
  const commercialApproved = commercial?.status === 'approved';
  const quoteExists = Boolean(quote);

  const stageLabel = quoteExists
    ? 'Commercial · Client quotation'
    : commercialApproved
      ? 'Commercial · Approval'
      : partnerResponseReady
        ? 'Assess · Partner response'
        : scopeApproved
          ? 'Assess · Partner engagement'
          : intake
            ? 'Acquire · Technical definition'
            : 'Acquire · Lead intake';

  const items = [
    {
      slug: 'client-requirements' as const,
      enabled: Boolean(intake),
      requiredNow: Boolean(intake) && !scopeApproved,
      minimumStatus: 'approved' as const,
      reason: 'Publish the inherited customer requirement and clarification basis as the approved technical-input record.',
      blockedReason: 'Create the technical intake first.',
    },
    {
      slug: 'scope-of-work' as const,
      enabled: scopeApproved,
      requiredNow: scopeApproved && !review,
      minimumStatus: 'approved' as const,
      reason: 'Publish the approved technical and delivery scope before controlled partner engagement.',
      blockedReason: 'Approve the technical intake first.',
    },
    {
      slug: 'vendor-safe-package' as const,
      enabled: scopeApproved,
      requiredNow: scopeApproved && !partnerResponseReady,
      minimumStatus: 'issued' as const,
      reason: 'Issue the controlled partner-facing scope and authorised document package.',
      blockedReason: 'Approve the technical intake first.',
    },
    {
      slug: 'partner-technical-assessment-report' as const,
      enabled: partnerResponseReady,
      requiredNow: partnerResponseReady && !commercialApproved,
      minimumStatus: 'approved' as const,
      reason: 'Approve the partner feasibility, capacity, assumptions, risks and pricing-readiness evidence.',
      blockedReason: 'A partner review response is required.',
    },
    {
      slug: 'commercial-approval' as const,
      enabled: commercialApproved,
      requiredNow: commercialApproved && !quoteExists,
      minimumStatus: 'approved' as const,
      reason: 'Retain the approved internal cost, price, margin and commercial decision before client quotation.',
      blockedReason: 'Approve the commercial position first.',
    },
    {
      slug: 'client-quote' as const,
      enabled: quoteExists,
      requiredNow: quoteExists,
      minimumStatus: quote?.status === 'issued' ? 'issued' as const : 'approved' as const,
      reason: quote?.status === 'issued'
        ? 'The controlled client quotation must remain at Issued state while the commercial decision is live.'
        : 'Sign and approve the controlled quotation before commercial issue to the client.',
      blockedReason: 'Generate the client quote first.',
    },
    {
      slug: 'statement-of-work' as const,
      enabled: scopeApproved && quoteExists,
      requiredNow: Boolean(quote && ['accepted'].includes(quote.status)),
      minimumStatus: 'approved' as const,
      reason: 'Publish the agreed scope, responsibilities, programme and change-control basis for project mobilisation.',
      blockedReason: 'Approved scope and client quotation are required.',
    },
  ];

  return <>
    {children}
    <DocumentGenerationPanel
      context="case"
      recordId={id}
      quoteId={quote?.id}
      returnTo={`/workspace/leads/${id}`}
      stageLabel={stageLabel}
      items={items}
    />
  </>;
}
