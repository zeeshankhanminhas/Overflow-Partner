import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProtectedDocumentEngine from '@/components/workspace/documents/ProtectedDocumentEngine';
import { getWorkspaceDocument, workspaceDocuments, type WorkspaceDocumentSlug } from '@/components/workspace/documents/documentRegistry';
import { buildDocumentAdapter } from '@/components/workspace/documents/documentAdapter';
import { requireUserContext } from '@/lib/auth/context';

export const metadata: Metadata = {
  title: 'Overflow Partner Workspace Document Preview',
  description: 'Protected Overflow Partner document engine preview.',
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return workspaceDocuments.map((document) => ({ document: document.slug }));
}

export default async function WorkspaceDocumentPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ document: WorkspaceDocumentSlug }>;
  searchParams?: Promise<{ case?: string; project?: string; quote?: string; invoice?: string; document_record?: string }>;
}) {
  const { document } = await params;
  if (!getWorkspaceDocument(document)) notFound();
  const query = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const adapted = await buildDocumentAdapter(supabase, document, {
    organisationId,
    caseId: query.case,
    projectId: query.project,
    quoteId: query.quote,
    invoiceId: query.invoice,
  });

  const ownerFact = adapted.facts.find((item) => item.label === 'Owner');
  if (ownerFact && /^[0-9a-f-]{36}$/i.test(ownerFact.value)) {
    const { data: owner } = await supabase
      .from('profiles')
      .select('full_name,first_name,last_name,email')
      .eq('organisation_id', organisationId)
      .eq('id', ownerFact.value)
      .maybeSingle();
    if (owner) ownerFact.value = owner.full_name || [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.email || 'Overflow Partner';
  }

  if (['client-quote', 'quote', 'proposal'].includes(document)) {
    const quoteNumber = adapted.facts.find((item) => item.label === 'Quote number')?.value;
    if (quoteNumber && quoteNumber !== 'Not recorded') adapted.reference = quoteNumber;
  }

  let documentRecordId: string | undefined;
  let documentStatus: string | undefined;
  if (query.document_record) {
    const { data: record } = await supabase
      .from('documents')
      .select('id,status,document_type,lead_id,project_id')
      .eq('organisation_id', organisationId)
      .eq('id', query.document_record)
      .eq('document_type', document)
      .maybeSingle();
    documentRecordId = record?.id;
    documentStatus = record?.status;

    if (record) {
      adapted.issueState = String(record.status || adapted.issueState).replaceAll('_', ' ');
      const entityType = record.project_id ? 'project' : 'lead';
      const entityId = record.project_id || record.lead_id;
      if (entityId) {
        const { data: events } = await supabase
          .from('activity_events')
          .select('event_type,event_data,created_at')
          .eq('organisation_id', organisationId)
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .in('event_type', ['document.signed', 'document.approved'])
          .order('created_at', { ascending: true });

        const documentEvents = (events || []).filter((event) => {
          const data = (event.event_data || {}) as Record<string, unknown>;
          return String(data.document_id || '') === record.id;
        });
        const signed = documentEvents.find((event) => event.event_type === 'document.signed');
        const approved = documentEvents.find((event) => event.event_type === 'document.approved');
        const signedData = (signed?.event_data || {}) as Record<string, unknown>;
        const approvedData = (approved?.event_data || {}) as Record<string, unknown>;

        if (signed) {
          adapted.facts.push(
            { label: 'Electronically signed by', value: String(signedData.signer_name || 'Authenticated workspace user') },
            { label: 'Signer role', value: String(signedData.signer_role || 'Authorised reviewer') },
            { label: 'Signed at', value: new Date(String(signedData.signed_at || signed.created_at)).toLocaleString('en-GB') },
            { label: 'Signature declaration', value: String(signedData.declaration || 'Electronic signature applied through the authenticated Overflow Partner workspace.') },
          );
        } else if (['signed', 'approved', 'issued', 'published'].includes(String(record.status))) {
          adapted.facts.push({ label: 'Electronic signature', value: 'Signed status recorded. Signature audit evidence was not found for this legacy transition.' });
        }

        if (approved) {
          adapted.facts.push(
            { label: 'Approved by', value: String(approvedData.approver_email || 'Authorised approver') },
            { label: 'Approved at', value: new Date(String(approvedData.approved_at || approved.created_at)).toLocaleString('en-GB') },
          );
        }
      }
    }
  }

  return <ProtectedDocumentEngine
    mode="viewer"
    document={document}
    adapted={adapted}
    documentRecordId={documentRecordId}
    documentStatus={documentStatus}
  />;
}
