import Link from 'next/link';
import DocumentForm from '@/components/workspace/DocumentForm';
import { requireUserContext } from '@/lib/auth/context';
import { listDocuments } from '@/lib/repositories/documents';
import { listLeads } from '@/lib/repositories/leads';

export default async function DocumentsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const [documents, leads] = await Promise.all([listDocuments(supabase, organisationId), listLeads(supabase, organisationId)]);
  return <section><p className="eyebrow">Delivery</p><h1>Document Engine</h1><p className="lede">Register, version, preview and issue controlled engineering and commercial documents against the live workflow.</p>{params.created?<p className="card" style={{marginTop:20}}>Document record created successfully.</p>:null}{params.error?<p className="card" style={{marginTop:20}}>{String(params.error)}</p>:null}<div className="metric-grid"><article className="metric"><span>Total documents</span><strong>{documents.length}</strong></article><article className="metric"><span>In review</span><strong>{documents.filter(d=>d.status==='in_review').length}</strong></article><article className="metric"><span>Issued</span><strong>{documents.filter(d=>d.status==='issued').length}</strong></article></div><DocumentForm leads={leads}/><div style={{marginTop:32,display:'grid',gap:12}}>{documents.length===0?<div className="card"><h3>No documents yet</h3><p>Create the first controlled document record above.</p></div>:documents.map(d=><Link href={`/workspace/documents/${d.id}`} className="metric" key={d.id}><div style={{display:'flex',justifyContent:'space-between',gap:16}}><div><strong style={{fontSize:22}}>{d.title}</strong><p>{d.reference} · {d.document_type} · v{d.version}</p></div><span>{d.status.replaceAll('_',' ')}</span></div><p>Open controlled preview →</p></Link>)}</div></section>;
}
