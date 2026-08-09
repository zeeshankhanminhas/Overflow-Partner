'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { getWorkspaceDocument, type WorkspaceDocumentSlug } from '@/components/workspace/documents/documentRegistry';
import { getWorkflowCase } from '@/lib/orchestration/service';

const roles = ['owner','admin','operator','engineering','commercial','business_development'] as const;

const caseDocuments: WorkspaceDocumentSlug[] = [
  'client-requirements','scope-of-work','partner-technical-assessment-report','vendor-safe-package','vendor-instructions','rfq-response','commercial-approval','client-quote','commercial-qualification-record','proposal','quote','statement-of-work','technical-review','requirement-sheet',
];

const projectDocuments: WorkspaceDocumentSlug[] = [
  'scope-of-work','statement-of-work','handover-pack','completion-report','invoice','document-register',
];

const documentPrefixes: Partial<Record<WorkspaceDocumentSlug,string>> = {
  'client-requirements': 'CRQ',
  'scope-of-work': 'SCP',
  'statement-of-work': 'STW',
  'partner-technical-assessment-report': 'PTA',
  'vendor-safe-package': 'VSP',
  'vendor-instructions': 'VIN',
  'rfq-response': 'RFQ',
  'commercial-approval': 'CAP',
  'commercial-qualification-record': 'CQR',
  'client-quote': 'CQT',
  'quote': 'QTE',
  'proposal': 'PRP',
  'technical-review': 'TRV',
  'requirement-sheet': 'REQ',
  'handover-pack': 'HOP',
  'completion-report': 'CMR',
  'invoice': 'INV',
  'document-register': 'DCR',
};

function safePrefix(slug: WorkspaceDocumentSlug) {
  return documentPrefixes[slug] || slug.split('-').map((part) => part[0]?.toUpperCase()).join('').slice(0, 6) || 'DOC';
}

function isNextRedirect(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'digest' in error && String((error as {digest?:unknown}).digest || '').startsWith('NEXT_REDIRECT'));
}

function returnWithDocumentError(returnTo: string, message: string) {
  const url = new URL(returnTo, 'https://workspace.local');
  url.searchParams.set('error', message);
  url.searchParams.set('error_scope', 'document');
  url.searchParams.set('focus', 'record-controlled-evidence');
  return `${url.pathname}${url.search}${url.hash}`;
}

async function allocateReference(supabase:any, organisationId:string, slug:WorkspaceDocumentSlug) {
  const prefix = safePrefix(slug);
  const year = new Date().getUTCFullYear();
  const stem = `OP-${prefix}-${year}-`;
  const { data, error } = await supabase
    .from('documents')
    .select('reference')
    .eq('organisation_id', organisationId)
    .like('reference', `${stem}%`)
    .order('reference', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const latest = String(data?.[0]?.reference || '');
  const match = latest.match(/-(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;
  return `${stem}${String(next).padStart(3,'0')}`;
}

export async function generateControlledDocumentAction(formData: FormData) {
  const slug = String(formData.get('document_slug') || '') as WorkspaceDocumentSlug;
  const leadId = String(formData.get('lead_id') || '') || null;
  const projectId = String(formData.get('project_id') || '') || null;
  const quoteId = String(formData.get('quote_id') || '') || null;
  const returnTo = String(formData.get('return_to') || '/workspace/documents');
  const definition = getWorkspaceDocument(slug);

  if (!definition || (!leadId && !projectId && !quoteId)) {
    redirect(returnWithDocumentError(returnTo, 'A valid document type and record are required.'));
  }

  let destination: string;
  let auditSupabase: any = null;
  let auditOrganisationId: string | null = null;
  let auditUserId: string | null = null;
  let failureEntityType = projectId ? 'project' : 'lead';
  let failureEntityId = projectId || leadId;

  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    auditSupabase = supabase;
    auditOrganisationId = organisationId;
    auditUserId = user.id;
    assertRole(profile.role, [...roles]);

    let resolvedLeadId = leadId;
    let resolvedQuoteId = quoteId;
    let auditEntityType = 'lead';
    let auditEntityId = leadId;

    if (projectId) {
      if (!projectDocuments.includes(slug)) throw new Error('This document is not available from Project 360.');
      const { data: project, error } = await supabase.from('projects').select('id,lead_id,quote_id,project_stage,status').eq('organisation_id', organisationId).eq('id', projectId).single();
      if (error || !project) throw new Error('Project could not be found.');
      resolvedLeadId = project.lead_id;
      resolvedQuoteId = project.quote_id;
      auditEntityType = 'project';
      auditEntityId = project.id;
      failureEntityType = 'project';
      failureEntityId = project.id;

      const stage = project.project_stage || 'mobilisation';
      if (slug === 'handover-pack' && !['mobilisation','ready_for_execution','ready_for_client_issue','issued_to_client','client_review','completion','closed'].includes(stage)) throw new Error('The Handover Pack is not available at the current delivery stage.');
      if (slug === 'completion-report' && !['completion','closed'].includes(stage)) throw new Error('The Completion Report is available only at Completion or Closed.');
      if (slug === 'invoice' && !['completion','closed'].includes(stage)) throw new Error('The Invoice is available only after delivery reaches Completion.');

      const { data: existingProjectDocument, error: existingProjectDocumentError } = await supabase
        .from('documents')
        .select('id,reference,document_type,status,project_id,lead_id')
        .eq('organisation_id', organisationId)
        .eq('project_id', projectId)
        .eq('document_type', slug)
        .neq('status', 'superseded')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingProjectDocumentError) throw new Error(existingProjectDocumentError.message);

      if (existingProjectDocument) {
        destination = `/workspace/documents/templates/${slug}?project=${projectId}&document_record=${existingProjectDocument.id}`;
        redirect(destination);
      }

      if (project.lead_id) {
        let legacyQuery = supabase
          .from('documents')
          .select('id,reference,document_type,status,project_id,lead_id,quote_id')
          .eq('organisation_id', organisationId)
          .eq('lead_id', project.lead_id)
          .is('project_id', null)
          .eq('document_type', slug)
          .neq('status', 'superseded')
          .order('created_at', { ascending: false })
          .limit(1);
        if (project.quote_id) legacyQuery = legacyQuery.or(`quote_id.eq.${project.quote_id},quote_id.is.null`);
        const { data: legacyDocument, error: legacyError } = await legacyQuery.maybeSingle();
        if (legacyError) throw new Error(legacyError.message);

        if (legacyDocument) {
          const { data: adopted, error: adoptError } = await supabase
            .from('documents')
            .update({ project_id: projectId, lead_id: null, quote_id: legacyDocument.quote_id || project.quote_id || null, updated_at: new Date().toISOString() })
            .eq('organisation_id', organisationId)
            .eq('id', legacyDocument.id)
            .select('id,reference')
            .single();
          if (adoptError || !adopted) throw new Error(adoptError?.message || 'Existing controlled document could not be transferred to Project 360.');

          await supabase.from('activity_events').insert({
            organisation_id: organisationId,
            entity_type: 'project',
            entity_id: projectId,
            user_id: user.id,
            event_type: 'document.ownership_transferred',
            event_data: { document_id: adopted.id, document_type: slug, from: 'case', to: 'project' },
            new_value: { document_id: adopted.id, project_id: projectId, lead_id: null },
          });

          revalidatePath(returnTo);
          revalidatePath('/workspace/documents');
          destination = `/workspace/documents/templates/${slug}?project=${projectId}&document_record=${adopted.id}`;
          redirect(destination);
        }
      }
    } else {
      if (!leadId) throw new Error('A Case is required before this document can be generated.');
      if (!caseDocuments.includes(slug)) throw new Error('This document is not available from Case 360.');

      const workflow = await getWorkflowCase(supabase, organisationId, leadId);
      if (!workflow) throw new Error('Case could not be found.');
      auditEntityType = 'lead';
      auditEntityId = workflow.lead.id;
      failureEntityType = 'lead';
      failureEntityId = workflow.lead.id;

      const { data: review, error: reviewError } = await supabase.from('partner_review_requests')
        .select('id,status').eq('organisation_id', organisationId).eq('lead_id', workflow.lead.id)
        .order('created_at',{ascending:false}).limit(1).maybeSingle();
      if (reviewError) throw new Error(reviewError.message);

      const intake = workflow.technicalIntake;
      const commercial = workflow.commercialReview;
      const quote = workflow.clientQuote;

      if (slug === 'scope-of-work') {
        if (!intake) throw new Error('Scope of Work cannot be generated because the technical intake has not been created yet.');
        if (intake.status !== 'approved') throw new Error(`Scope of Work requires an approved technical intake. Current intake status: ${String(intake.status).replaceAll('_',' ')}.`);
      }
      if (slug === 'partner-technical-assessment-report' && !review) throw new Error('Partner Technical Assessment requires a partner review record.');
      if (['commercial-approval','commercial-qualification-record'].includes(slug) && commercial?.status !== 'approved') throw new Error('Commercial approval documents require an approved commercial decision.');
      if (['client-quote','quote'].includes(slug) && !quote) throw new Error('A client quote must exist before this document can be generated.');
      resolvedLeadId = workflow.lead.id;
      resolvedQuoteId = resolvedQuoteId || quote?.id || null;

      const { data: existingCaseDocument, error: existingCaseDocumentError } = await supabase
        .from('documents')
        .select('id,reference,status,version')
        .eq('organisation_id', organisationId)
        .eq('lead_id', workflow.lead.id)
        .eq('document_type', slug)
        .neq('status', 'superseded')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingCaseDocumentError) throw new Error(existingCaseDocumentError.message);
      if (existingCaseDocument) {
        const context = resolvedQuoteId && ['client-quote','quote','invoice'].includes(slug) ? `quote=${resolvedQuoteId}` : `case=${workflow.lead.id}`;
        redirect(`/workspace/documents/templates/${slug}?${context}&document_record=${existingCaseDocument.id}`);
      }
    }

    const versionQuery = supabase.from('documents').select('id',{count:'exact',head:true}).eq('organisation_id', organisationId).eq('document_type', slug);
    const scopedVersionQuery = projectId ? versionQuery.eq('project_id', projectId) : versionQuery.eq('lead_id', resolvedLeadId);
    const { count, error: versionError } = await scopedVersionQuery;
    if (versionError) throw new Error(versionError.message);
    const version = Number(count || 0) + 1;
    const reference = await allocateReference(supabase, organisationId, slug);

    const { data: record, error: insertError } = await supabase.from('documents').insert({
      organisation_id: organisationId,
      created_by: user.id,
      lead_id: projectId ? null : resolvedLeadId,
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
    destination = `/workspace/documents/templates/${slug}?${context}&document_record=${record.id}&generated=${encodeURIComponent(reference)}`;
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : 'Document could not be generated.';

    if (auditSupabase && auditOrganisationId && auditUserId && failureEntityId) {
      try {
        await auditSupabase.from('activity_events').insert({
          organisation_id: auditOrganisationId,
          entity_type: failureEntityType,
          entity_id: failureEntityId,
          user_id: auditUserId,
          event_type: 'document.generation_failed',
          event_data: { document_type: slug, reason: message },
          new_value: { status: 'failed', reason: message },
        });
      } catch {
        // Failure telemetry must never hide the operator-facing generation reason.
      }
    }

    redirect(returnWithDocumentError(returnTo, message));
  }

  redirect(destination);
}
