'use server';

import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';

const approvalRoles = ['owner','admin','engineering','commercial'] as const;

export type DocumentReviewResult = { ok: boolean; message: string; status?: string };

export async function approveControlledDocumentAction(documentId: string): Promise<DocumentReviewResult> {
  try {
    if (!documentId) return { ok: false, message: 'A controlled document record is required.' };

    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, [...approvalRoles]);

    const { data: document, error: readError } = await supabase
      .from('documents')
      .select('id,status,lead_id,project_id,reference,document_type,version')
      .eq('organisation_id', organisationId)
      .eq('id', documentId)
      .single();

    if (readError || !document) return { ok: false, message: 'Controlled document could not be found.' };
    if (['approved','issued','published'].includes(document.status)) {
      return { ok: true, message: 'Document is already approved.', status: document.status };
    }
    if (!['draft','in_review','changes_requested'].includes(document.status)) {
      return { ok: false, message: `Document cannot be approved from ${document.status}.` };
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('organisation_id', organisationId)
      .eq('id', documentId);

    if (updateError) return { ok: false, message: updateError.message };

    const entityType = document.project_id ? 'project' : 'lead';
    const entityId = document.project_id || document.lead_id;
    if (entityId) {
      await supabase.from('activity_events').insert({
        organisation_id: organisationId,
        entity_type: entityType,
        entity_id: entityId,
        user_id: user.id,
        event_type: 'document.approved',
        event_data: {
          document_id: document.id,
          document_type: document.document_type,
          reference: document.reference,
          version: document.version,
        },
        old_value: { status: document.status },
        new_value: { status: 'approved' },
      });
    }

    revalidatePath('/workspace/documents');
    if (document.lead_id) revalidatePath(`/workspace/leads/${document.lead_id}`);
    if (document.project_id) revalidatePath(`/workspace/projects/${document.project_id}`);

    return { ok: true, message: 'Document approved and audit event recorded.', status: 'approved' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Document approval failed.' };
  }
}
