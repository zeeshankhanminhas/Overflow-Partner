import DocumentForm from '@/components/workspace/DocumentForm';
import { requireUserContext } from '@/lib/auth/context';
import { listDocuments } from '@/lib/repositories/documents';
import { listLeads } from '@/lib/repositories/leads';

export default async function DocumentsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const [documents, leads] = await Promise.all([
    listDocuments(supabase, organisationId),
    listLeads(supabase, organisationId),
  ]);

  return (
    <section>
      <p className="eyebrow">Delivery</p>
      <h1>Document Engine</h1>
      <p className="lede">Register, version and track controlled engineering and commercial documents against the live workflow.</p>

      {params.created ? <p className="card" style={{ marginTop: 20, width: '100%' }}>Document record created successfully.</p> : null}
      {params.error ? <p className="card" style={{ marginTop: 20, width: '100%' }}>{String(params.error)}</p> : null}

      <div className="metric-grid">
        <article className="metric"><span>Total documents</span><strong>{documents.length}</strong></article>
        <article className="metric"><span>In review</span><strong>{documents.filter((document) => document.status === 'in_review').length}</strong></article>
        <article className="metric"><span>Issued</span><strong>{documents.filter((document) => document.status === 'issued').length}</strong></article>
      </div>

      <DocumentForm leads={leads} />

      <div style={{ marginTop: 32, display: 'grid', gap: 12 }}>
        {documents.length === 0 ? (
          <div className="card" style={{ width: '100%' }}><h3>No documents yet</h3><p className="lede" style={{ fontSize: 16 }}>Create the first controlled document record above.</p></div>
        ) : documents.map((document) => (
          <article className="metric" key={document.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
              <div>
                <strong style={{ marginTop: 0, fontSize: 22 }}>{document.title}</strong>
                <p>{document.reference} · {document.document_type} · v{document.version}</p>
              </div>
              <span>{document.status.replaceAll('_', ' ')}</span>
            </div>
            <p>Created {new Date(document.created_at).toLocaleDateString('en-GB')}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
