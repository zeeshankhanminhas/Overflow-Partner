import Link from 'next/link';
import { OpdsDocumentFrame, WorkflowStatus } from '@/components/opds';
import { requireUserContext } from '@/lib/auth/context';
import { getDocumentById } from '@/lib/repositories/documents';

export default async function Page({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const { supabase, organisationId } = await requireUserContext();
  const doc = await getDocumentById(supabase, organisationId, documentId);

  return <section>
    <div className="opds-print-hidden" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
      <div><p className="opds-eyebrow">Controlled document</p><h1>{doc.title}</h1></div>
      <div style={{ display: 'flex', gap: 10 }}><WorkflowStatus status={doc.status}/><Link className="button secondary" href="/workspace/documents">Back</Link></div>
    </div>
    <OpdsDocumentFrame reference={doc.reference} version={doc.version} status={doc.status} documentType={doc.document_type} title={doc.title}
      footer={<><span>Created {new Date(doc.created_at).toLocaleString('en-GB')}</span><span className="opds-reference">Document ID {doc.id}</span></>}>
      <p className="lede">This controlled record is linked to the Overflow Partner operating workflow. Its reference, revision, status and relationships are governed by OPDS.</p>
      <div style={{ marginTop: 40, borderTop: '1px solid var(--opds-line)', paddingTop: 24 }}>
        <p className="opds-eyebrow">Document control</p>
        <p>Use browser Print / Save as PDF for controlled issue while generated-file storage is connected.</p>
      </div>
    </OpdsDocumentFrame>
  </section>;
}
