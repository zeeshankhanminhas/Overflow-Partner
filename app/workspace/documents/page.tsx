import Link from 'next/link';
import DocumentForm from '@/components/workspace/DocumentForm';
import { requireUserContext } from '@/lib/auth/context';
import { listDocuments } from '@/lib/repositories/documents';
import { listLeads } from '@/lib/repositories/leads';
import { workspaceLabel } from '@/lib/presentation/vocabulary';

export default async function DocumentsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const [documents, leads] = await Promise.all([listDocuments(supabase, organisationId), listLeads(supabase, organisationId)]);
  const inReview=documents.filter(d=>d.status==='in_review').length;
  const issued=documents.filter(d=>d.status==='issued').length;

  return <section className="vp-page">
    <header className="vp-header">
      <div><p className="vp-kicker">Documents</p><h1>Controlled evidence and outputs.</h1><p className="vp-subtitle">Inspect issued and in-review records. Document creation is secondary to the case or project that requires it.</p></div>
      <div className="vp-toolbar"><details><summary>Register document</summary><div className="vp-toolbar-panel"><DocumentForm leads={leads}/></div></details></div>
    </header>

    {params.created?<div className="vp-callout"><strong>Document registered</strong><p>The controlled record is available below.</p></div>:null}
    {params.error?<div className="vp-callout"><strong>Action could not be completed</strong><p>{String(params.error)}</p></div>:null}

    <section className="vp-object vp-object--hero"><p className="vp-label">Document position</p><div className="vp-compact-metrics"><div className="vp-metric"><span>Total documents</span><strong>{documents.length}</strong></div><div className="vp-metric"><span>In review</span><strong>{inReview}</strong></div><div className="vp-metric"><span>Issued</span><strong>{issued}</strong></div></div></section>

    <section><div className="vp-section-title"><div><p className="vp-label">Primary object</p><h2>Controlled documents</h2></div></div><div className="vp-list">{documents.length===0?<div className="vp-empty">No controlled documents recorded.</div>:documents.map(d=><Link href={`/workspace/documents/${d.id}`} className="vp-row" key={d.id}><div><h3>{d.title}</h3><p>{d.reference} · {workspaceLabel(d.document_type)} · v{d.version}</p></div><div className="vp-row-status">{workspaceLabel(d.status)}</div><div><strong>Open preview →</strong></div></Link>)}</div></section>
  </section>;
}
