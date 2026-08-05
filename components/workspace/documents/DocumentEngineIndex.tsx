import Link from 'next/link';
import { workspaceDocuments, type WorkspaceDocumentItem } from './documentRegistry';

function statusLabel(status: WorkspaceDocumentItem['dataStatus']) {
  if (status === 'live-backed') return 'Live-backed';
  if (status === 'legacy-preview') return 'Legacy preview';
  return 'Preview only';
}
function issueState(status: WorkspaceDocumentItem['dataStatus']) { return status === 'live-backed' ? 'Controlled workspace record' : 'Final issue blocked'; }
function documentType(document: WorkspaceDocumentItem) {
  if (document.slug.includes('invoice')) return 'Invoice';
  if (document.slug.includes('quote')) return 'Quote';
  if (document.slug.includes('report') || document.slug.includes('review')) return 'Report';
  if (document.slug.includes('register')) return 'Register';
  if (document.slug.includes('email')) return 'Template set';
  if (document.slug.includes('package') || document.slug.includes('pack')) return 'Package';
  return 'Controlled document';
}

export default function DocumentEngineIndex() {
  return <div className="mx-auto grid max-w-7xl gap-5 md:gap-6">
    <section className="rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgb(180_151_90/0.18),transparent_34%),rgb(255_255_255/0.04)] p-5 md:rounded-[2rem] md:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b4975a]">Protected document engine</p>
      <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-[-0.035em] text-white md:mt-4 md:text-5xl">Overflow Partner document suite lives inside the private workspace.</h1>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-white/68 md:mt-5 md:text-base md:leading-7">Live-backed documents are assembled from controlled case records. Preview-only templates remain blocked from final issue until their backend adapters are connected.</p>
    </section>
    <section className="grid gap-3 md:hidden" aria-label="Workspace documents">{workspaceDocuments.map((document) => <article key={document.slug} className="min-w-0 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b4975a]">{documentType(document)}</p><h2 className="mt-2 break-words text-lg font-semibold leading-6 text-white">{document.title}</h2></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${document.dataStatus === 'live-backed' ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' : 'border-amber-200/20 bg-amber-200/10 text-amber-100'}`}>{statusLabel(document.dataStatus)}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Issue state</dt><dd className="mt-1 text-white/72">{issueState(document.dataStatus)}</dd></div><div><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Control</dt><dd className="mt-1 text-white/72">Source record controlled</dd></div></dl><p className="mt-4 line-clamp-3 text-sm leading-6 text-white/58">{document.description}</p><Link href={`/workspace/documents/templates/${document.slug}`} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold uppercase text-[#050705]">{document.dataStatus === 'live-backed' ? 'Open document' : 'Open protected preview'}</Link></article>)}</section>
    <div className="hidden gap-5 md:grid lg:grid-cols-2 xl:grid-cols-3">{workspaceDocuments.map((document) => <Link key={document.slug} href={`/workspace/documents/templates/${document.slug}`} className="group rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-0.5 hover:bg-white/[0.065]"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b4975a]">{statusLabel(document.dataStatus)}</p><h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-white">{document.title}</h2><p className="mt-3 min-h-24 text-sm leading-6 text-white/56">{document.description}</p><p className="mt-5 text-sm font-semibold text-[#b4975a]">{document.dataStatus === 'live-backed' ? 'Open live-backed document' : 'Open protected preview'} ↗</p></Link>)}</div>
  </div>;
}
