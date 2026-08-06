'use server';

import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';

const approvalRoles = ['owner', 'admin', 'engineering', 'commercial'] as const;
const signingRoles = ['owner', 'admin', 'engineering', 'commercial'] as const;

export type DocumentReviewResult = { ok: boolean; message: string; status?: string };

type ControlledDocument = {
  id: string;
  status: string;
  lead_id: string | null;
  project_id: string | null;
  reference: string | null;
  document_type: string;
  version: string | number | null;
};

async function loadControlledDocument(documentId: string) {
  const context = await requireUserContext();
  const { data: document, error } = await context.supabase
    .from('documents')
    .select('id,status,lead_id,project_id,reference,document_type,version')
    .eq('organisation_id', context.organisationId)
    .eq('id', documentId)
    .single();

  return { ...context, document: document as ControlledDocument | null, error };
}

async function recordDocumentEvent({ supabase, organisationId, userId, document, eventType, oldStatus, newStatus, evidence }: {
  supabase: Awaited<ReturnType<typeof requireUserContext>>['supabase'];
  organisationId: string;
  userId: string;
  document: ControlledDocument;
  eventType: string;
  oldStatus: string;
  newStatus: string;
  evidence?: Record<string, unknown>;
}) {
  const entityType = document.project_id ? 'project' : 'lead';
  const entityId = document.project_id || document.lead_id;
  if (!entityId) return;

  await supabase.from('activity_events').insert({
    organisation_id: organisationId,
    entity_type: entityType,
    entity_id: entityId,
    user_id: userId,
    event_type: eventType,
    event_data: { document_id: document.id, document_type: document.document_type, reference: document.reference, version: document.version, ...evidence },
    old_value: { status: oldStatus },
    new_value: { status: newStatus },
  });
}

function revalidateDocumentOwners(document: ControlledDocument) {
  revalidatePath('/workspace/documents');
  if (document.lead_id) revalidatePath(`/workspace/leads/${document.lead_id}`);
  if (document.project_id) revalidatePath(`/workspace/projects/${document.project_id}`);
}

export async function signControlledDocumentAction(documentId: string, signerName: string, signerRole: string, declarationAccepted: boolean): Promise<DocumentReviewResult> {
  try {
    if (!documentId) return { ok: false, message: 'A controlled document record is required.' };
    if (!signerName.trim()) return { ok: false, message: 'Signer name is required.' };
    if (!signerRole.trim()) return { ok: false, message: 'Signer role is required.' };
    if (!declarationAccepted) return { ok: false, message: 'The electronic-signature declaration must be accepted.' };

    const { supabase, user, profile, organisationId, document, error } = await loadControlledDocument(documentId);
    assertRole(profile.role, [...signingRoles]);
    if (error || !document) return { ok: false, message: 'Controlled document could not be found.' };
    if (['signed', 'approved', 'issued', 'published'].includes(document.status)) return { ok: true, message: 'Document is already signed.', status: document.status };
    if (!['draft', 'in_review', 'changes_requested'].includes(document.status)) return { ok: false, message: `Document cannot be signed from ${document.status}.` };

    const signedAt = new Date().toISOString();
    const { error: updateError } = await supabase.from('documents').update({ status: 'signed', updated_at: signedAt }).eq('organisation_id', organisationId).eq('id', documentId);
    if (updateError) return { ok: false, message: updateError.message };

    await recordDocumentEvent({ supabase, organisationId, userId: user.id, document, eventType: 'document.signed', oldStatus: document.status, newStatus: 'signed', evidence: {
      signer_name: signerName.trim(), signer_role: signerRole.trim(), signed_at: signedAt,
      declaration: 'I confirm that I have reviewed this controlled document and intend this action to constitute my electronic signature.',
      authenticated_user_email: user.email,
    }});
    revalidateDocumentOwners(document);
    return { ok: true, message: `Electronically signed by ${signerName.trim()}.`, status: 'signed' };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Document signing failed.' }; }
}

export async function requestDocumentChangesAction(documentId: string, reason: string): Promise<DocumentReviewResult> {
  try {
    if (!documentId) return { ok: false, message: 'A controlled document record is required.' };
    if (!reason.trim()) return { ok: false, message: 'A change request must include a reason.' };
    const { supabase, user, profile, organisationId, document, error } = await loadControlledDocument(documentId);
    assertRole(profile.role, [...signingRoles]);
    if (error || !document) return { ok: false, message: 'Controlled document could not be found.' };
    if (!['draft', 'in_review', 'signed'].includes(document.status)) return { ok: false, message: `Changes cannot be requested from ${document.status}.` };

    const requestedAt = new Date().toISOString();
    const { error: updateError } = await supabase.from('documents').update({ status: 'changes_requested', updated_at: requestedAt }).eq('organisation_id', organisationId).eq('id', documentId);
    if (updateError) return { ok: false, message: updateError.message };
    await recordDocumentEvent({ supabase, organisationId, userId: user.id, document, eventType: 'document.changes_requested', oldStatus: document.status, newStatus: 'changes_requested', evidence: { reason: reason.trim(), requested_at: requestedAt } });
    revalidateDocumentOwners(document);
    return { ok: true, message: 'Changes requested and audit event recorded.', status: 'changes_requested' };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Change request failed.' }; }
}

export async function approveControlledDocumentAction(documentId: string): Promise<DocumentReviewResult> {
  try {
    if (!documentId) return { ok: false, message: 'A controlled document record is required.' };
    const { supabase, user, profile, organisationId, document, error } = await loadControlledDocument(documentId);
    assertRole(profile.role, [...approvalRoles]);
    if (error || !document) return { ok: false, message: 'Controlled document could not be found.' };
    if (['approved', 'issued', 'published'].includes(document.status)) return { ok: true, message: 'Document is already approved.', status: document.status };
    if (document.status !== 'signed') return { ok: false, message: 'Document must be electronically signed before approval.' };

    const approvedAt = new Date().toISOString();
    const { error: updateError } = await supabase.from('documents').update({ status: 'approved', updated_at: approvedAt }).eq('organisation_id', organisationId).eq('id', documentId);
    if (updateError) return { ok: false, message: updateError.message };
    await recordDocumentEvent({ supabase, organisationId, userId: user.id, document, eventType: 'document.approved', oldStatus: document.status, newStatus: 'approved', evidence: { approved_at: approvedAt, approver_email: user.email, approver_role: profile.role } });
    revalidateDocumentOwners(document);
    return { ok: true, message: 'Document approved and audit event recorded.', status: 'approved' };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Document approval failed.' }; }
}

export async function issueControlledDocumentAction(documentId: string): Promise<DocumentReviewResult> {
  try {
    if (!documentId) return { ok: false, message: 'A controlled document record is required.' };
    const { supabase, user, profile, organisationId, document, error } = await loadControlledDocument(documentId);
    assertRole(profile.role, [...approvalRoles]);
    if (error || !document) return { ok: false, message: 'Controlled document could not be found.' };
    if (['issued', 'published'].includes(document.status)) return { ok: true, message: 'Document is already issued.', status: document.status };
    if (document.status !== 'approved') return { ok: false, message: 'Document must be approved before controlled issue.' };

    const issuedAt = new Date().toISOString();
    const { error: updateError } = await supabase.from('documents').update({ status: 'issued', updated_at: issuedAt }).eq('organisation_id', organisationId).eq('id', documentId);
    if (updateError) return { ok: false, message: updateError.message };
    await recordDocumentEvent({ supabase, organisationId, userId: user.id, document, eventType: 'document.issued', oldStatus: document.status, newStatus: 'issued', evidence: { issued_at: issuedAt, issued_by_email: user.email, issued_by_role: profile.role } });
    revalidateDocumentOwners(document);
    return { ok: true, message: 'Controlled document issued. Commercial progression may now continue.', status: 'issued' };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Document issue failed.' }; }
}
