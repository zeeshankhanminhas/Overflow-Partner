'use server';

import { createHash } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { recordActivity } from '@/lib/repositories/activity';
import { isLinkedInConversationUrl, parseConversationTranscript, type ConversationSource } from '@/lib/acquisition/conversationImport';

const MAX_TRANSCRIPT = 60000;

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function importProspectConversationAction(formData: FormData) {
  const prospectId = String(formData.get('prospect_id') || '').trim();
  let status = 'Conversation import could not be completed.';
  let success = false;
  try {
    if (process.env.OP_LINKEDIN_CONVERSATION_IMPORT_ENABLED !== 'true') {
      throw new Error('Conversation importing is not enabled in this environment.');
    }
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    const source = String(formData.get('source') || '');
    const sourceUrl = String(formData.get('source_url') || '').trim();
    const raw = String(formData.get('transcript') || '').replace(/\r\n?/g, '\n').trim();
    if (source !== 'linkedin' && source !== 'sales_navigator') throw new Error('Select LinkedIn or Sales Navigator.');
    if (!raw || raw.length > MAX_TRANSCRIPT) throw new Error('Paste up to 60,000 characters of conversation.');
    if (sourceUrl.length > 2048 || !isLinkedInConversationUrl(sourceUrl)) throw new Error('Enter a valid HTTPS LinkedIn URL, or leave it blank.');
    const messages = parseConversationTranscript(raw);
    const { data: prospect, error: prospectError } = await supabase.from('prospects')
      .select('id,source,converted_lead_id').eq('organisation_id', organisationId).eq('id', prospectId).maybeSingle();
    if (prospectError || !prospect || prospect.source !== 'linkedin') throw new Error('This LinkedIn prospect was not found.');
    // Keep the original exact-normalised paste as immutable evidence. Reposting it
    // retrieves the existing batch so partial imports can safely be retried.
    const contentHash = digest(raw);
    const batchValues = {
      organisation_id: organisationId,
      prospect_id: prospectId,
      source: source as ConversationSource,
      source_url: sourceUrl || null,
      original_text: raw,
      content_hash: contentHash,
      imported_by: user.id,
    };
    const { data: created, error: batchError } = await supabase
      .from('prospect_conversation_imports')
      .upsert(batchValues, { onConflict: 'prospect_id,source,content_hash', ignoreDuplicates: true })
      .select('id').maybeSingle();
    if (batchError) throw new Error('Unable to archive original conversation: ' + batchError.message);
    let importId = created?.id as string | undefined;
    if (!importId) {
      const { data: existing, error: existingError } = await supabase
        .from('prospect_conversation_imports').select('id')
        .eq('organisation_id', organisationId).eq('prospect_id', prospectId)
        .eq('source', source).eq('content_hash', contentHash).maybeSingle();
      if (existingError || !existing?.id) throw new Error('The previous import could not be located.');
      importId = existing.id;
    }
    // Fingerprints preserve distinct identical messages within a fully copied
    // transcript via occurrence. For identical isolated replies supply timestamp.
    const rows = messages.map(msg => ({
      organisation_id: organisationId,
      prospect_id: prospectId,
      import_id: importId,
      source,
      speaker: msg.speaker,
      body: msg.body,
      sent_at: msg.sentAt,
      original_order: msg.originalOrder,
      message_fingerprint: digest([
        source, msg.speaker, msg.sentAt || '',
        msg.body.replace(/\s+/g, ' ').trim().toLowerCase(), String(msg.occurrence),
      ].join('|')),
      imported_by: user.id,
    }));
    const { data: inserted, error: messageError } = await supabase
      .from('prospect_conversation_messages')
      .upsert(rows, { onConflict: 'prospect_id,source,message_fingerprint', ignoreDuplicates: true })
      .select('id');
    if (messageError) throw new Error('Archive saved; retry to finish message import: ' + messageError.message);
    const added = inserted?.length ?? 0;
    if (created || added) {
      await recordActivity(supabase, {
        organisationId, entityType: 'prospect', entityId: prospectId, userId: user.id,
        eventType: 'prospect.conversation_imported',
        eventData: { source, importedMessageCount: messages.length, addedMessageCount: added, duplicateMessageCount: messages.length - added },
      });
    }
    status = added > 0
      ? `Conversation archived: ${added} new message${added === 1 ? '' : 's'}, ${messages.length - added} already on record.`
      : 'Conversation already archived; no new messages added.';
    success = true;
    revalidatePath(`/workspace/acquisition/${prospectId}`);
    revalidatePath('/workspace/acquisition/funnel');
  } catch (error) {
    status = error instanceof Error ? error.message : status;
  }
  const query = new URLSearchParams({ [success ? 'updated' : 'error']: status, focus: 'record-current-stage-work' });
  redirect(`/workspace/acquisition/${encodeURIComponent(prospectId)}?${query.toString()}`);
}
