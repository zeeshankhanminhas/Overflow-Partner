'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertRole, requireUserContext } from '@/lib/auth/context';

function quoteDocumentUrl(leadId: string, documentId: string, params: Record<string,string>) {
  const query = new URLSearchParams({ case: leadId, document_record: documentId, ...params });
  return `/workspace/documents/templates/client-quote?${query.toString()}`;
}

export async function recordDraftQuoteValidityAction(formData: FormData) {
  const quoteId = String(formData.get('quote_id') || '').trim();
  const leadId = String(formData.get('lead_id') || '').trim();
  const documentId = String(formData.get('document_id') || '').trim();
  const validUntil = String(formData.get('valid_until') || '').trim();
  const fallback = quoteDocumentUrl(leadId, documentId, {});

  try {
    if (!quoteId || !leadId || !documentId) throw new Error('The controlled Client Quote record is incomplete.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) throw new Error('Enter a valid quotation expiry date.');

    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner','admin','commercial']);
    const { error } = await supabase.rpc('op_set_draft_quote_validity', {
      p_organisation_id: organisationId,
      p_user_id: user.id,
      p_quote_id: quoteId,
      p_valid_until: validUntil,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/workspace/documents/templates/client-quote');
    revalidatePath(`/workspace/leads/${leadId}`);
    revalidatePath('/workspace/quotes');
    redirect(quoteDocumentUrl(leadId, documentId, { validity_saved: '1' }));
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    redirect(quoteDocumentUrl(leadId, documentId, { error: error instanceof Error ? error.message : 'Quotation validity could not be recorded.' }));
  }
}
