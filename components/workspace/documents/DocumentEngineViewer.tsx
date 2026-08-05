import { getWorkspaceDocument, type WorkspaceDocumentSlug } from './documentRegistry';
import { documentLanguage } from './documentLanguage';
import type { AdaptedDocumentData } from './documentAdapter';

const ink = '#171918';
const muted = '#3f4542';
const line = '#d2d0ca';
const accent = '#c84a31';
const paper = '#fafaf8';

function BrandMark() {
  return <div className="flex items-center gap-4">
    <span className="grid h-12 w-12 place-items-center border-2 text-sm font-black tracking-[-.06em]" style={{ borderColor: ink, color: ink }}>OP</span>
    <div><strong className="block text-base font-bold tracking-[-.025em]" style={{ color: ink }}>Overflow Partner</strong><span className="mt-1 block text-[9px] font-bold uppercase tracking-[.22em]" style={{ color: accent }}>Engineering capacity</span></div>
  </div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="border-t-2 pt-3" style={{ borderColor: line }}><dt className="text-[9px] font-bold uppercase tracking-[.18em]" style={{ color: muted }}>{label}</dt><dd className="mt-2 text-sm font-bold" style={{ color: ink }}>{value}</dd></div>;
}

function ControlStrip({ reference, revision }: { reference: string; revision: string }) {
  return <div className="grid grid-cols-3 border-y text-[9px] font-bold uppercase tracking-[.14em]" style={{ borderColor: line, color: muted }}><span className="py-3">Controlled publication</span><span className="border-x px-4 py-3 text-center" style={{ borderColor: line }}>{reference}</span><span className="py-3 text-right">Revision {revision}</span></div>;
}

function Page({ children, reference, page }: { children: React.ReactNode; reference: string; page: string }) {
  return <main className="midts-document-page relative mx-auto min-h-[1123px] w-full max-w-[794px] overflow-hidden shadow-2xl print:min-h-screen print:max-w-none print:shadow-none" style={{ background: paper, color: ink }}>
    <div className="document-accent-strip absolute inset-y-0 left-0 w-[6px]" style={{ background: accent }} />
    <div className="document-side-brand absolute right-[-56px] top-[320px] rotate-90 text-[9px] font-bold uppercase tracking-[.28em]" style={{ color: '#aaa7a0' }}>Overflow Partner · Controlled</div>
    <div className="document-page-content flex min-h-[1123px] flex-col p-12 pl-16 md:p-16 md:pl-20">
      <header className="flex items-start justify-between gap-8 border-b-2 pb-6" style={{ borderColor: ink }}><BrandMark /><div className="text-right"><p className="text-[9px] font-bold uppercase tracking-[.2em]" style={{ color: accent }}>Controlled document</p><strong className="mt-2 block text-xs" style={{ color: ink }}>{reference}</strong></div></header>
      <div className="flex-1 py-12">{children}</div>
      <footer className="border-t-2 pt-4" style={{ borderColor: ink }}><div className="flex items-center justify-between gap-6 text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: muted }}><span>Overflow Partner · Private / Controlled</span><span>{reference}</span><span>Page {page}</span></div></footer>
    </div>
  </main>;
}

export default function DocumentEngineViewer({ slug, adapted }: { slug: WorkspaceDocumentSlug; adapted?: AdaptedDocumentData }) {
  const document = getWorkspaceDocument(slug);
  const language = documentLanguage[slug];
  if (!document || !language) return null;
  const reference = adapted?.reference || `OP-${slug.replaceAll('-', '/').toUpperCase()}-001`;
  const revision = adapted?.revision || 'A';
  const livePageOffset = adapted?.connected ? 1 : 0;
  const factValue = (label: string) => adapted?.facts.find((item) => item.label === label)?.value;
  const signerName = factValue('Electronically signed by');
  const signerRole = factValue('Signer role');
  const signedAt = factValue('Signed at');
  const signatureDeclaration = factValue('Signature declaration');
  const legacySignature = factValue('Electronic signature');
  const approvedBy = factValue('Approved by');
  const approvedAt = factValue('Approved at');
  const hasSignatureEvidence = Boolean(signerName || legacySignature || approvedBy);

  return <>
    <Page reference={reference} page="01">
      <div className="grid min-h-[760px] content-between">
        <div>
          <div className="flex items-center gap-3"><span className="h-[2px] w-14" style={{ background: accent }} /><p className="text-[10px] font-bold uppercase tracking-[.24em]" style={{ color: accent }}>{adapted?.connected ? adapted.sourceLabel : document.dataStatus === 'live-backed' ? 'Live-backed publication' : 'Protected preview'}</p></div>
          <h1 className="mt-10 max-w-2xl text-5xl font-bold leading-[.94] tracking-[-.06em] md:text-7xl" style={{ color: ink }}>{document.title}</h1>
          <p className="mt-9 max-w-xl border-l-4 pl-6 text-base font-medium leading-8" style={{ borderColor: accent, color: muted }}>{language.purpose}</p>
          {adapted?.connected ? <div className="mt-10 border-y-2 py-5" style={{ borderColor: ink }}><p className="text-[9px] font-bold uppercase tracking-[.18em]" style={{ color: accent }}>Document subject</p><strong className="mt-2 block text-2xl" style={{ color: ink }}>{adapted.subject}</strong></div> : null}
        </div>
        <div>
          <ControlStrip reference={reference} revision={revision} />
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3">
            <Meta label="Audience" value={language.audience} /><Meta label="Reference" value={reference} /><Meta label="Revision" value={revision} />
            <Meta label="Prepared by" value="Overflow Partner" /><Meta label="Issue state" value={adapted?.issueState || (document.dataStatus === 'live-backed' ? 'Controlled record' : 'Final issue blocked')} /><Meta label="Visibility" value={language.visibility} />
          </dl>
        </div>
      </div>
    </Page>

    {adapted?.connected ? <Page reference={reference} page="02">
      <div className="grid grid-cols-[5rem_1fr] gap-8 border-b-2 pb-8" style={{ borderColor: ink }}><span className="text-5xl font-bold tracking-[-.06em]" style={{ color: accent }}>00</span><div><p className="text-[10px] font-bold uppercase tracking-[.22em]" style={{ color: accent }}>Inherited controlled record</p><h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-[-.05em] md:text-5xl" style={{ color: ink }}>Live document data</h2></div></div>
      <div className="mt-12 grid grid-cols-1 gap-x-8 md:grid-cols-2">{adapted.facts.filter((item) => !['Electronically signed by','Signer role','Signed at','Signature declaration','Electronic signature','Approved by','Approved at'].includes(item.label)).map((item) => <div key={item.label} className="border-t-2 py-6" style={{ borderColor: line }}><p className="text-[9px] font-bold uppercase tracking-[.18em]" style={{ color: accent }}>{item.label}</p><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7" style={{ color: ink }}>{item.value}</p></div>)}</div>
      {adapted.warnings.length ? <div className="mt-10 border-l-4 p-6" style={{ borderColor: accent, background: '#f2eee9' }}><p className="text-[9px] font-bold uppercase tracking-[.18em]" style={{ color: accent }}>Issue blockers</p><ul className="mt-4 grid gap-2">{adapted.warnings.map((warning) => <li key={warning} className="text-sm font-semibold" style={{ color: ink }}>{warning}</li>)}</ul></div> : null}
    </Page> : null}

    {language.sections.map((section, sectionIndex) => <Page key={section.title} reference={reference} page={String(sectionIndex + 2 + livePageOffset).padStart(2, '0')}>
      <div className="grid grid-cols-[5rem_1fr] gap-8 border-b-2 pb-8" style={{ borderColor: ink }}><span className="text-5xl font-bold tracking-[-.06em]" style={{ color: accent }}>{String(sectionIndex + 1).padStart(2, '0')}</span><div><p className="text-[10px] font-bold uppercase tracking-[.22em]" style={{ color: accent }}>Document section</p><h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-[-.05em] md:text-5xl" style={{ color: ink }}>{section.title}</h2></div></div>
      <ol className="mt-12 grid gap-0">{section.entries.map((entry, index) => <li className="grid grid-cols-[3.5rem_1fr] gap-5 border-t-2 py-7" style={{ borderColor: line }} key={entry.heading}><span className="text-xs font-bold" style={{ color: accent }}>{String(index + 1).padStart(2, '0')}</span><div><strong className="text-lg font-bold" style={{ color: ink }}>{entry.heading}</strong><p className="mt-3 max-w-xl text-sm font-medium leading-7" style={{ color: muted }}>{entry.body}</p></div></li>)}</ol>
    </Page>)}

    <Page reference={reference} page={String(language.sections.length + 2 + livePageOffset).padStart(2, '0')}>
      <div className="grid min-h-[760px] content-between">
        <div><div className="flex items-center gap-3"><span className="h-[2px] w-14" style={{ background: accent }} /><p className="text-[10px] font-bold uppercase tracking-[.24em]" style={{ color: accent }}>Document control</p></div><h2 className="mt-10 whitespace-pre-line text-6xl font-bold leading-[.88] tracking-[-.065em]" style={{ color: ink }}>Controlled{`\n`}Publication.</h2><p className="mt-9 max-w-xl text-base font-medium leading-8" style={{ color: muted }}>{language.closingStatement}</p></div>
        <div className="grid gap-5">
          {hasSignatureEvidence ? <section className="signature-evidence-block border-2 p-6" style={{ borderColor: ink }}>
            <p className="text-[9px] font-bold uppercase tracking-[.18em]" style={{ color: accent }}>Electronic signature and approval evidence</p>
            {signerName ? <div className="mt-5 grid grid-cols-2 gap-6"><div><p className="text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: muted }}>Electronically signed by</p><p className="mt-3 text-2xl font-semibold italic" style={{ color: ink }}>{signerName}</p><p className="mt-2 text-sm font-semibold" style={{ color: muted }}>{signerRole || 'Authorised reviewer'}</p></div><div><p className="text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: muted }}>Signed at</p><p className="mt-3 text-sm font-semibold" style={{ color: ink }}>{signedAt || 'Recorded in audit trail'}</p></div></div> : <p className="mt-4 text-sm font-semibold" style={{ color: ink }}>{legacySignature}</p>}
            {signatureDeclaration ? <p className="mt-5 border-t pt-4 text-xs leading-5" style={{ borderColor: line, color: muted }}>{signatureDeclaration}</p> : null}
            {approvedBy ? <div className="mt-5 grid grid-cols-2 gap-6 border-t pt-5" style={{ borderColor: line }}><div><p className="text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: muted }}>Approved by</p><p className="mt-2 text-sm font-bold" style={{ color: ink }}>{approvedBy}</p></div><div><p className="text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: muted }}>Approved at</p><p className="mt-2 text-sm font-bold" style={{ color: ink }}>{approvedAt || 'Recorded in audit trail'}</p></div></div> : null}
          </section> : null}
          <div className="grid gap-0 border-y-2" style={{ borderColor: ink }}><div className="grid grid-cols-[10rem_1fr] border-b py-5" style={{ borderColor: line }}><strong className="text-xs uppercase tracking-[.14em]" style={{ color: accent }}>Issue condition</strong><p className="text-sm font-semibold leading-6" style={{ color: ink }}>{language.issueCondition}</p></div><div className="grid grid-cols-[10rem_1fr] py-5"><strong className="text-xs uppercase tracking-[.14em]" style={{ color: accent }}>Release control</strong><p className="text-sm font-semibold leading-6" style={{ color: ink }}>{adapted?.connected && !adapted.warnings.length ? 'Live source data is connected. Complete approval and controlled PDF issue before external distribution.' : 'Preview or incomplete record. Connect the required live evidence and complete approval before external issue.'}</p></div></div>
        </div>
      </div>
    </Page>
  </>;
}
