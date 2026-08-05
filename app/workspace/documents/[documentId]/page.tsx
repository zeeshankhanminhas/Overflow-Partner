import Link from 'next/link';
import { OpdsDocumentFrame, WorkflowStatus } from '@/components/opds';
import { requireUserContext } from '@/lib/auth/context';
import { getDocumentById } from '@/lib/repositories/documents';

type DocumentEvent = {
  id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
};

function text(value: unknown, fallback = 'Not recorded') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function dateTime(value: unknown, fallback = 'Not recorded') {
  if (!value) return fallback;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/London',
      }).format(date);
}

export default async function Page({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const { supabase, organisationId } = await requireUserContext();
  const doc = await getDocumentById(supabase, organisationId, documentId);

  const { data: eventRows } = await supabase
    .from('activity_events')
    .select('id,event_type,event_data,created_at')
    .eq('organisation_id', organisationId)
    .contains('event_data', { document_id: documentId })
    .in('event_type', ['document.signed', 'document.approved'])
    .order('created_at', { ascending: false });

  const events = (eventRows ?? []) as DocumentEvent[];
  const signatureEvent = events.find((event) => event.event_type === 'document.signed');
  const approvalEvent = events.find((event) => event.event_type === 'document.approved');
  const signature = signatureEvent?.event_data ?? null;
  const approval = approvalEvent?.event_data ?? null;

  return <section>
    <div className="opds-print-hidden" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
      <div><p className="opds-eyebrow">Controlled document</p><h1>{doc.title}</h1></div>
      <div style={{ display: 'flex', gap: 10 }}><WorkflowStatus status={doc.status}/><Link className="button secondary" href="/workspace/documents">Back</Link></div>
    </div>

    <OpdsDocumentFrame
      reference={doc.reference}
      version={doc.version}
      status={doc.status}
      documentType={doc.document_type}
      title={doc.title}
      footer={<><span>Created {dateTime(doc.created_at)}</span><span className="opds-reference">Document ID {doc.id}</span></>}
    >
      <p className="lede">This controlled record is linked to the Overflow Partner operating workflow. Its reference, revision, status and relationships are governed by OPDS.</p>

      <section style={{ marginTop: 40, borderTop: '1px solid var(--opds-line)', paddingTop: 24 }}>
        <p className="opds-eyebrow">Document authorisation</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', border: '1px solid var(--opds-line)', marginTop: 14 }}>
          <div style={{ padding: 20, borderRight: '1px solid var(--opds-line)' }}>
            <small style={{ display: 'block', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--opds-subtle)' }}>Electronic signature</small>
            {signature ? <>
              <strong style={{ display: 'block', marginTop: 18, fontSize: 24, fontStyle: 'italic', letterSpacing: '-.02em' }}>{text(signature.signer_name)}</strong>
              <span style={{ display: 'block', marginTop: 5 }}>{text(signature.signer_role)}</span>
              <small style={{ display: 'block', marginTop: 14, color: 'var(--opds-muted)' }}>Signed {dateTime(signature.signed_at || signatureEvent?.created_at)}</small>
              <small style={{ display: 'block', marginTop: 4, color: 'var(--opds-muted)' }}>Authenticated as {text(signature.authenticated_user_email)}</small>
            </> : <p style={{ marginTop: 18, color: 'var(--opds-muted)' }}>Not yet electronically signed.</p>}
          </div>

          <div style={{ padding: 20 }}>
            <small style={{ display: 'block', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--opds-subtle)' }}>Approval</small>
            {approval ? <>
              <strong style={{ display: 'block', marginTop: 18, fontSize: 20 }}>Approved</strong>
              <span style={{ display: 'block', marginTop: 5 }}>{text(approval.approver_role)}</span>
              <small style={{ display: 'block', marginTop: 14, color: 'var(--opds-muted)' }}>Approved {dateTime(approval.approved_at || approvalEvent?.created_at)}</small>
              <small style={{ display: 'block', marginTop: 4, color: 'var(--opds-muted)' }}>{text(approval.approver_email)}</small>
            </> : <p style={{ marginTop: 18, color: 'var(--opds-muted)' }}>Awaiting authorised approval.</p>}
          </div>
        </div>

        {signature ? <p style={{ marginTop: 14, fontSize: 12, lineHeight: 1.6, color: 'var(--opds-muted)' }}>
          Electronic-signature declaration: {text(signature.declaration)}
        </p> : null}
      </section>

      <div style={{ marginTop: 40, borderTop: '1px solid var(--opds-line)', paddingTop: 24 }}>
        <p className="opds-eyebrow">Document control</p>
        <p>The electronic signature and approval evidence shown above are included when this document is printed or saved as PDF.</p>
      </div>
    </OpdsDocumentFrame>
  </section>;
}
