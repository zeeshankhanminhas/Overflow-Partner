'use server';

import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { buildDocumentAdapter } from '@/components/workspace/documents/documentAdapter';
import { getWorkspaceDocument, type WorkspaceDocumentSlug } from '@/components/workspace/documents/documentRegistry';

const ownerAuthorityRoles = ['owner', 'admin'] as const;
const reviewRoles = ['owner', 'admin', 'engineering', 'commercial'] as const;

export type DocumentReviewResult = { ok: boolean; message: string; status?: string };

type ControlledDocument = {
  id: string;
  status: string;
  lead_id: string | null;
  project_id: string | null;
  reference: string | null;
  document_type: string;
  version: string | number | null;
  governance_mode: 'owner_operated' | 'independent_review';
  independent_review_required: boolean;
  signed_by: string | null;
  approved_by: string | null;
  issued_by: string | null;
  quote_id: string | null;
};

async function loadControlledDocument(documentId: string) {
  const context = await requireUserContext();
  const { data: document, error } = await context.supabase
    .from('documents')
    .select('id,status,lead_id,project_id,quote_id,reference,document_type,version,governance_mode,independent_review_required,signed_by,approved_by,issued_by')
    .eq('organisation_id', context.organisationId)
    .eq('id', documentId)
    .single();
  return { ...context, document: document as ControlledDocument | null, error };
}

async function assertDocumentEvidenceReady(supabase: Awaited<ReturnType<typeof requireUserContext>>['supabase'], organisationId: string, document: ControlledDocument) {
  const definition = getWorkspaceDocument(document.document_type);
  if (!definition) throw new Error('This document type is not in the controlled template register.');
  const adapted = await buildDocumentAdapter(supabase, document.document_type as WorkspaceDocumentSlug, { organisationId, caseId: document.lead_id, projectId: document.project_id, quoteId: document.quote_id });
  if (!adapted.issueReady) throw new Error(`Document evidence is incomplete: ${adapted.warnings.join(' ')}`);
}

async function recordDocumentEvent({ supabase, organisationId, userId, document, eventType, oldStatus, newStatus, evidence }: {
  supabase: Awaited<ReturnType<typeof requireUserContext>>['supabase']; organisationId: string; userId: string;
  document: ControlledDocument; eventType: string; oldStatus: string; newStatus: string; evidence?: Record<string, unknown>;
}) {
  const entityType = document.project_id ? 'project' : 'lead';
  const entityId = document.project_id || document.lead_id;
  if (!entityId) return;
  await supabase.from('activity_events').insert({
    organisation_id: organisationId, entity_type: entityType, entity_id: entityId, user_id: userId, event_type: eventType,
    event_data: { document_id: document.id, document_type: document.document_type, reference: document.reference, version: document.version,
      governance_mode: document.governance_mode, independent_review_required: document.independent_review_required, ...evidence },
    old_value: { status: oldStatus }, new_value: { status: newStatus },
  });
}

function revalidateDocumentOwners(document: ControlledDocument) {
  revalidatePath('/workspace/documents');
  revalidatePath(`/workspace/documents/${document.id}`);
  if (document.lead_id) revalidatePath(`/workspace/leads/${document.lead_id}`);
  if (document.project_id) revalidatePath(`/workspace/projects/${document.project_id}`);
}

async function persistDocumentStatus({
  supabase,
  organisationId,
  documentId,
  expectedCurrentStatus,
  nextStatus,
  values,
}: {
  supabase: Awaited<ReturnType<typeof requireUserContext>>['supabase'];
  organisationId: string;
  documentId: string;
  expectedCurrentStatus: string;
  nextStatus: string;
  values: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from('documents')
    .update(values)
    .eq('organisation_id', organisationId)
    .eq('id', documentId)
    .eq('status', expectedCurrentStatus)
    .select('id,status,signed_by,approved_by,issued_by')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`This document changed after the view loaded. Refresh before moving it from ${expectedCurrentStatus.replaceAll('_',' ')} to ${nextStatus.replaceAll('_',' ')}.`);
  if (String(data.status) !== nextStatus) throw new Error(`Document update did not reach the expected ${nextStatus.replaceAll('_',' ')} state.`);
  return data;
}

export async function submitControlledDocumentForReviewAction(documentId: string): Promise<DocumentReviewResult> {
  try {
    if (!documentId) return { ok: false, message: 'A controlled document record is required.' };
    const { supabase, user, profile, organisationId, document, error } = await loadControlledDocument(documentId);
    assertRole(profile.role, [...reviewRoles]);
    if (error || !document) return { ok: false, message: 'Controlled document could not be found.' };
    if (document.status === 'in_review') return { ok: true, message: 'Document is already in review.', status: 'in_review' };
    if (!['draft','changes_requested'].includes(document.status)) return { ok: false, message: `Document cannot enter review from ${document.status}.` };
    await assertDocumentEvidenceReady(supabase, organisationId, document);

    const submittedAt = new Date().toISOString();
    await persistDocumentStatus({
      supabase,
      organisationId,
      documentId,
      expectedCurrentStatus: document.status,
      nextStatus: 'in_review',
      values: { status: 'in_review', updated_at: submittedAt },
    });
    await recordDocumentEvent({ supabase, organisationId, userId: user.id, document, eventType: 'document.review_started', oldStatus: document.status, newStatus: 'in_review', evidence: { submitted_at: submittedAt } });
    revalidateDocumentOwners(document);
    return { ok: true, message: document.status === 'changes_requested' ? 'Revised document resubmitted for review.' : 'Document submitted for controlled review.', status: 'in_review' };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Document review could not be started.' }; }
}

export async function signControlledDocumentAction(documentId: string, signerName: string, signerRole: string, declarationAccepted: boolean): Promise<DocumentReviewResult> {
  try {
    if (!documentId) return { ok: false, message: 'A controlled document record is required.' };
    if (!signerName.trim() || !signerRole.trim()) return { ok: false, message: 'Signer name and operating authority are required.' };
    if (!declarationAccepted) return { ok: false, message: 'The electronic-signature declaration must be accepted.' };
    const { supabase, user, profile, organisationId, document, error } = await loadControlledDocument(documentId);
    assertRole(profile.role, [...reviewRoles]);
    if (error || !document) return { ok: false, message: 'Controlled document could not be found.' };
    if (['signed','approved','issued','published','archived'].includes(document.status)) return { ok: true, message: 'Document is already signed.', status: document.status };
    if (document.status !== 'in_review') return { ok: false, message: 'Document must be in controlled review before it can be signed.' };

    const signedAt = new Date().toISOString();
    await persistDocumentStatus({
      supabase,
      organisationId,
      documentId,
      expectedCurrentStatus: document.status,
      nextStatus: 'signed',
      values: { status: 'signed', signed_by: user.id, signed_at: signedAt, updated_at: signedAt },
    });
    await recordDocumentEvent({ supabase, organisationId, userId: user.id, document, eventType: 'document.signed', oldStatus: document.status, newStatus: 'signed', evidence: {
      authority: 'technical_evidence_review', signer_name: signerName.trim(), signer_role: signerRole.trim(), signed_at: signedAt,
      declaration: 'I confirm that I reviewed the available evidence and apply my electronic signature in the stated operating authority.',
      authenticated_user_email: user.email,
    }});
    revalidateDocumentOwners(document);
    return { ok: true, message: `Technical evidence signed by ${signerName.trim()}.`, status: 'signed' };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Document signing failed.' }; }
}

export async function requestDocumentChangesAction(documentId: string, reason: string): Promise<DocumentReviewResult> {
  try {
    if (!documentId || !reason.trim()) return { ok: false, message: 'A controlled document and change reason are required.' };
    const { supabase, user, profile, organisationId, document, error } = await loadControlledDocument(documentId);
    assertRole(profile.role, [...reviewRoles]);
    if (error || !document) return { ok: false, message: 'Controlled document could not be found.' };
    if (!['in_review','signed'].includes(document.status)) return { ok: false, message: 'Changes can only be requested during review or after technical sign-off but before approval.' };
    const requestedAt = new Date().toISOString();
    await persistDocumentStatus({
      supabase,
      organisationId,
      documentId,
      expectedCurrentStatus: document.status,
      nextStatus: 'changes_requested',
      values: { status: 'changes_requested', signed_by: null, signed_at: null, approved_by: null, approved_at: null, issued_by: null, issued_at: null, updated_at: requestedAt },
    });
    await recordDocumentEvent({ supabase, organisationId, userId: user.id, document, eventType: 'document.changes_requested', oldStatus: document.status, newStatus: 'changes_requested', evidence: { reason: reason.trim(), requested_at: requestedAt } });
    revalidateDocumentOwners(document);
    return { ok: true, message: 'Changes requested; prior review authority has been reset.', status: 'changes_requested' };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Change request failed.' }; }
}

export async function approveControlledDocumentAction(documentId: string): Promise<DocumentReviewResult> {
  try {
    if (!documentId) return { ok: false, message: 'A controlled document record is required.' };
    const { supabase, user, profile, organisationId, document, error } = await loadControlledDocument(documentId);
    assertRole(profile.role, [...ownerAuthorityRoles]);
    if (error || !document) return { ok: false, message: 'Controlled document could not be found.' };
    if (['approved','issued','published','archived'].includes(document.status)) return { ok: true, message: 'Document is already approved.', status: document.status };
    if (document.status !== 'signed') return { ok: false, message: 'Document must be electronically signed before approval.' };
    if (document.independent_review_required && document.signed_by === user.id) return { ok: false, message: 'Independent review is required, so the signer cannot approve this document.' };

    const approvedAt = new Date().toISOString();
    const combinedAuthority = document.signed_by === user.id;
    await persistDocumentStatus({
      supabase,
      organisationId,
      documentId,
      expectedCurrentStatus: document.status,
      nextStatus: 'approved',
      values: { status: 'approved', approved_by: user.id, approved_at: approvedAt, updated_at: approvedAt },
    });
    await recordDocumentEvent({ supabase, organisationId, userId: user.id, document, eventType: 'document.approved', oldStatus: document.status, newStatus: 'approved', evidence: {
      authority: 'owner_release_authority', approved_at: approvedAt, approver_email: user.email, approver_role: profile.role,
      combined_owner_authority: combinedAuthority,
      declaration: 'I approve this document revision for controlled issue under owner-operated governance.',
    }});
    revalidateDocumentOwners(document);
    return { ok: true, message: combinedAuthority ? 'Approved using combined owner authority; the separate decision is recorded.' : 'Document approved by owner authority.', status: 'approved' };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Document approval failed.' }; }
}

export async function issueControlledDocumentAction(documentId: string): Promise<DocumentReviewResult> {
  try {
    if (!documentId) return { ok: false, message: 'A controlled document record is required.' };
    const { supabase, user, profile, organisationId, document, error } = await loadControlledDocument(documentId);
    assertRole(profile.role, [...ownerAuthorityRoles]);
    if (error || !document) return { ok: false, message: 'Controlled document could not be found.' };
    if (['issued','published','archived'].includes(document.status)) return { ok: true, message: 'Document is already issued.', status: document.status };
    if (document.status !== 'approved') return { ok: false, message: 'Document must be approved before controlled issue.' };
    await assertDocumentEvidenceReady(supabase, organisationId, document);

    const issuedAt = new Date().toISOString();
    const combinedAuthority = document.approved_by === user.id;
    await persistDocumentStatus({
      supabase,
      organisationId,
      documentId,
      expectedCurrentStatus: document.status,
      nextStatus: 'issued',
      values: { status: 'issued', issued_by: user.id, issued_at: issuedAt, updated_at: issuedAt },
    });
    await recordDocumentEvent({ supabase, organisationId, userId: user.id, document, eventType: 'document.issued', oldStatus: document.status, newStatus: 'issued', evidence: {
      authority: 'controlled_release_authority', issued_at: issuedAt, issued_by_email: user.email, issued_by_role: profile.role,
      combined_owner_authority: combinedAuthority,
      declaration: 'I authorise release of this approved revision as the controlled issue.',
    }});
    revalidateDocumentOwners(document);
    return { ok: true, message: 'Controlled document issued under owner release authority.', status: 'issued' };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Document issue failed.' }; }
}

export async function archiveControlledDocumentAction(documentId: string): Promise<DocumentReviewResult> {
  try {
    if (!documentId) return { ok: false, message: 'A controlled document record is required.' };
    const { supabase, user, profile, organisationId, document, error } = await loadControlledDocument(documentId);
    assertRole(profile.role, [...ownerAuthorityRoles]);
    if (error || !document) return { ok: false, message: 'Controlled document could not be found.' };
    if (document.status === 'archived') return { ok: true, message: 'Document is already archived.', status: 'archived' };
    if (!['issued','published'].includes(document.status)) return { ok: false, message: 'Only an issued controlled document can be archived.' };

    const archivedAt = new Date().toISOString();
    await persistDocumentStatus({
      supabase,
      organisationId,
      documentId,
      expectedCurrentStatus: document.status,
      nextStatus: 'archived',
      values: { status: 'archived', updated_at: archivedAt },
    });
    await recordDocumentEvent({ supabase, organisationId, userId: user.id, document, eventType: 'document.archived', oldStatus: document.status, newStatus: 'archived', evidence: {
      authority: 'records_control', archived_at: archivedAt, archived_by_email: user.email, archived_by_role: profile.role,
    }});
    revalidateDocumentOwners(document);
    return { ok: true, message: 'Controlled document archived. The issued evidence remains in the audit trail.', status: 'archived' };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Document archive failed.' }; }
}
