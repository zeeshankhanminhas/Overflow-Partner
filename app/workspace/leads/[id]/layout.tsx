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

  const items = [
    { slug: 'client-requirements' as const, enabled: Boolean(intake), reason: 'Publish the inherited customer requirement and clarification basis.', blockedReason: 'Create the technical intake first.' },
    { slug: 'scope-of-work' as const, enabled: scopeApproved, reason: 'Publish the approved technical and delivery scope.', blockedReason: 'Approve the technical intake first.' },
    { slug: 'partner-technical-assessment-report' as const, enabled: partnerResponseReady, reason: 'Publish the partner feasibility, capacity, risks and declared response.', blockedReason: 'A partner review response is required.' },
    { slug: 'vendor-safe-package' as const, enabled: scopeApproved, reason: 'Create the controlled partner-facing scope and document package.', blockedReason: 'Approve the technical intake first.' },
    { slug: 'commercial-approval' as const, enabled: commercialApproved, reason: 'Publish the internal approved cost, price and margin decision.', blockedReason: 'Approve the commercial position first.' },
    { slug: 'client-quote' as const, enabled: quoteExists, reason: 'Create the client-facing controlled quote from the approved commercial record.', blockedReason: 'Generate the client quote first.' },
    { slug: 'statement-of-work' as const, enabled: scopeApproved && quoteExists, reason: 'Publish the agreed scope, responsibilities, programme and change-control basis.', blockedReason: 'Approved scope and client quote are required.' },
  ];

  return <>
    {children}
    <DocumentGenerationPanel context="case" recordId={id} quoteId={quote?.id} returnTo={`/workspace/leads/${id}`} items={items}/>
  </>;
}
