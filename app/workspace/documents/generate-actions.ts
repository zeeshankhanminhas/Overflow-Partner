'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { getWorkspaceDocument, type WorkspaceDocumentSlug } from '@/components/workspace/documents/documentRegistry';

const roles = ['owner','admin','operator','engineering','commercial','business_development'] as const;

const caseDocuments: WorkspaceDocumentSlug[] = [
  'client-requirements','scope-of-work','partner-technical-assessment-report','vendor-safe-package','vendor-instructions','rfq-response','commercial-approval','client-quote','commercial-qualification-record','proposal','quote','statement-of-work','technical-review','requirement-sheet',
];

const projectDocuments: WorkspaceDocumentSlug[] = [
  'scope-of-work','statement-of-work','handover-pack','completion-report','invoice','document-register',
];

function safePrefix(slug: string) {
  return slug.split('-').map((part) => part[0]?.toUpperCase()).join('').slice(0, 6) || 'DOC';
}

export async function generateControlledDocumentAction(formData: FormData) {
  const slug = String(formData.get('document_slug') || '') as WorkspaceDocumentSlug;
  const leadId = String(formData.get('lead_id') || '') || null;
  const projectId = String(formData.get('project_id') || '') || null;
  const quoteId = String(formData.get('quote_id') || '') || null;
  const returnTo = String(formData.get('return_to') || '/workspace/documents');
  const definition = getWorkspaceDocument(slug);

  if (!definition || (!leadId && !projectId && !quoteId)) {
    redirect(`${returnTo}?error=${encodeURIComponent('A valid document type and governed record are required.')}`);
  }

  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, [...roles]);

    let resolvedLeadId = leadId;
    let resolvedQuoteId = quoteId;
    let auditEntityType = 'lead';
    let auditEntityId = leadId;

    if (projectId) {
      if (!projectDocuments.includes(slug)) throw new Error('This document is not permitted from the project workspace.');
      const { data: project, error } = await supabase.from('projects').select('id,lead_id,quote_id,project_stage,status').eq('organisation_id', organisationId).eq('id', projectId).single();
      if (error || !project) throw new Error('Project could not be found.');
      resolvedLeadId = project.lead_id;
      resolvedQuoteId = project.quote_id;
      auditEntityType = 'project';
      auditEntityId = project.id;

      const stage = project.project_stage || 'mobilisation';
      if (slug === 'handover-pack' && !['mobilisation','ready_for_execution','ready_for_client_issue','issued_to_client','client_review','completion','closed'].includes(stage)) throw new Error('The Handover Pack is not available at the current delivery stage.');
      if (slug === 'completion-report' && !['completion','closed'].includes(stage)) throw new Error('The Completion Report is available only at Completion or Closed.');
      if (slug === 'invoice' && !['completion','closed'].includes(stage)) throw new Error('The Invoice is available only after delivery reaches Completion.');
    } else {
      if (!caseDocuments.includes(slug)) throw new Error('This document is not permitted from Case 360.');
      const { data: lead, error } = await supabase.from('leads').select('id,status').eq('organisation_id', organisationId).eq('id', leadId).single();
      if (error || !lead) throw new Error('Case could not be found.');
      auditEntityType = 'lead';
      auditEntityId = lead.id;

      const [{ data: intake }, { data: review }, { data: commercial }, { data: quote }] = await Promise.all([
        supabase.from('technical_intakes').select('id,status').eq('organisation_id', organisationId).eq('lead_id', lead.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
        supabase.from('partner_review_requests').select('id,status').eq('organisation_id', organisationId).eq('lead_id', lead.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
        supabase.from('commercial_reviews').select('id,status').eq('organisation_id', organisationId).eq('lead_id', lead.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
        supabase.from('quotes').select('id,status').eq('organisation_id', organisationId).eq('lead_id', lead.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
      ]);
      if (slug === 'scope-of-work' && intake?.status !== 'approved') throw new Error('Scope of Work requires an approved technical intake.');
      if (slug === 'partner-technical-assessment-report' && !review) throw new Error('Partner Technical Assessment requires a partner review record.');
      if (['commercial-approval','commercial-qualification-record'].includes(slug) && commercial?.status !== 'approved') throw new Error('Commercial approval documents require an approved commercial decision.');
      if (['client-quote','quote'].includes(slug) && !quote) throw new Error('A client quote must exist before this publication can be generated.');
      resolvedQuoteId = resolvedQuoteId || quote?.id || null;
    }

    let versionQuery = supabase.from('documents').select('id',{count:'exact',head:true}).eq('organisation_id', organisationId).eq('document_type', slug);
    versionQuery = projectId ? versionQuery.eq('project_id', projectId) : versionQuery.eq('lead_id', resolvedLeadId);
    const { count } = await versionQuery;
    const version = Number(count || 0) + 1;
    const reference = `OP-${safePrefix(slug)}-${new Date().getUTCFullYear()}-${String(version).padStart(3,'0')}`;

    const { data: record, error: insertError } = await supabase.from('documents').insert({
      organisation_id: organisationId,
      created_by: user.id,
      lead_id: resolvedLeadId,
      project_id: projectId,
      quote_id: resolvedQuoteId,
      document_type: slug,
      reference,
      title: definition.title,
      status: 'draft',
      version,
    }).select('id,reference').single();
    if (insertError) throw new Error(insertError.message);

    await supabase.from('activity_events').insert({
      organisation_id: organisationId,
      entity_type: auditEntityType,
      entity_id: auditEntityId,
      user_id: user.id,
      event_type: 'document.generated',
      event_data: { document_id: record.id, document_type: slug, reference },
      new_value: { document_id: record.id, reference, version, status: 'draft' },
    });

    revalidatePath(returnTo);
    revalidatePath('/workspace/documents');
    const context = projectId ? `project=${projectId}` : resolvedQuoteId && ['client-quote','quote','invoice'].includes(slug) ? `quote=${resolvedQuoteId}` : `case=${resolvedLeadId}`;
    redirect(`/workspace/documents/templates/${slug}?${context}&document_record=${record.id}&generated=${encodeURIComponent(reference)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Document could not be generated.';
    redirect(`${returnTo}?error=${encodeURIComponent(message)}`);
  }
}
