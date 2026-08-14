import { getWorkspaceDocument, type WorkspaceDocumentSlug } from './documentRegistry';
import { documentLanguage } from './documentLanguage';
import type { AdaptedDocumentData, DocumentAdapterFact } from './documentAdapter';

const ink = '#171918';
const muted = '#3f4542';
const line = '#d2d0ca';
const accent = '#c84a31';
const paper = '#fafaf8';

const signatureLabels = new Set([
  'Electronically signed by',
  'Signer role',
  'Signed at',
  'Signature declaration',
  'Electronic signature',
  'Approved by',
  'Approved at',
]);

const clientFacing = new Set<WorkspaceDocumentSlug>([
  'capability-statement',
  'client-quote',
  'client-requirements',
  'completion-report',
  'invoice',
  'proposal',
  'quote',
  'requirement-sheet',
  'scope-of-work',
  'statement-of-work',
]);

function BrandMark() {
  return <div className="flex items-center gap-4">
    <span className="grid h-11 w-11 place-items-center border-2 text-sm font-black tracking-[-.06em]" style={{ borderColor: ink, color: ink }}>OP</span>
    <div>
      <strong className="block text-base font-bold tracking-[-.025em]" style={{ color: ink }}>Overflow Partner</strong>
      <span className="mt-1 block text-[9px] font-bold uppercase tracking-[.22em]" style={{ color: accent }}>Engineering capacity</span>
    </div>
  </div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="border-t-2 pt-3" style={{ borderColor: line }}>
    <dt className="text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: muted }}>{label}</dt>
    <dd className="mt-2 text-sm font-bold leading-5" style={{ color: ink }}>{value}</dd>
  </div>;
}

function Page({ children, reference, page, classification }: { children: React.ReactNode; reference: string; page: string; classification: string }) {
  return <main className="midts-document-page relative mx-auto min-h-[1123px] w-full max-w-[794px] overflow-hidden shadow-2xl print:min-h-screen print:max-w-none print:shadow-none" style={{ background: paper, color: ink }}>
    <div className="document-accent-strip absolute inset-y-0 left-0 w-[6px]" style={{ background: accent }} />
    <div className="document-page-content flex min-h-[1123px] flex-col p-12 pl-16 md:p-16 md:pl-20">
      <header className="flex items-start justify-between gap-8 border-b-2 pb-6" style={{ borderColor: ink }}>
        <BrandMark />
        <div className="text-right">
          <p className="text-[9px] font-bold uppercase tracking-[.18em]" style={{ color: muted }}>{classification}</p>
          <strong className="mt-2 block max-w-[19rem] text-xs" style={{ color: ink }}>{reference}</strong>
        </div>
      </header>
      <div className="flex-1 py-10">{children}</div>
      <footer className="border-t pt-4" style={{ borderColor: line }}>
        <div className="flex items-center justify-between gap-6 text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: muted }}>
          <span>Overflow Partner</span><span>{reference}</span><span>Page {page}</span>
        </div>
      </footer>
    </div>
  </main>;
}

type FactGroup = { title: string; facts: DocumentAdapterFact[] };

function groupFacts(facts: DocumentAdapterFact[]): FactGroup[] {
  const groups: Record<string, DocumentAdapterFact[]> = {
    'Record': [],
    'Scope & delivery': [],
    'Commercial': [],
    'Status & dates': [],
  };

  for (const item of facts) {
    if (!item.value || item.value === 'Not recorded' || signatureLabels.has(item.label)) continue;
    const label = item.label.toLowerCase();
    if (/(price|cost|margin|subtotal|vat|tax|total|amount|currency|value|payment)/.test(label)) groups['Commercial'].push(item);
    else if (/(scope|deliverable|discipline|project type|requirement|assumption|risk|feasibility|capacity|hours|lead time|special)/.test(label)) groups['Scope & delivery'].push(item);
    else if (/(status|state|date|valid|approved|due|start|response|confidence|revision|documents)/.test(label)) groups['Status & dates'].push(item);
    else groups['Record'].push(item);
  }

  return Object.entries(groups).filter(([, items]) => items.length).map(([title, items]) => ({ title, facts: items }));
}

function FactSection({ group }: { group: FactGroup }) {
  const wideLabels = new Set(['Scope', 'Deliverables', 'Assumptions', 'Technical risks', 'Missing information', 'Special requirements']);
  return <section className="mt-8">
    <div className="flex items-center gap-3 border-b-2 pb-3" style={{ borderColor: ink }}>
      <span className="h-[2px] w-8" style={{ background: accent }} />
      <h2 className="text-xs font-bold uppercase tracking-[.17em]" style={{ color: ink }}>{group.title}</h2>
    </div>
    <dl className="grid grid-cols-1 md:grid-cols-2">
      {group.facts.map((item) => <div key={item.label} className={`${wideLabels.has(item.label) ? 'md:col-span-2' : ''} border-b py-5 md:pr-8`} style={{ borderColor: line }}>
        <dt className="text-[9px] font-bold uppercase tracking-[.15em]" style={{ color: muted }}>{item.label}</dt>
        <dd className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6" style={{ color: ink }}>{item.value}</dd>
      </div>)}
    </dl>
  </section>;
}

function SignatureEvidence({ adapted }: { adapted: AdaptedDocumentData }) {
  const factValue = (label: string) => adapted.facts.find((item) => item.label === label)?.value;
  const signerName = factValue('Electronically signed by');
  const signerRole = factValue('Signer role');
  const signedAt = factValue('Signed at');
  const signatureDeclaration = factValue('Signature declaration');
  const legacySignature = factValue('Electronic signature');
  const approvedBy = factValue('Approved by');
  const approvedAt = factValue('Approved at');
  const hasSignatureEvidence = Boolean(signerName || legacySignature || approvedBy);
  if (!hasSignatureEvidence) return null;

  return <section className="mt-9 border-2 p-6" style={{ borderColor: ink }}>
    <p className="text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: accent }}>Approval</p>
    {signerName ? <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: muted }}>Signed by</p>
        <p className="mt-2 text-xl font-semibold" style={{ color: ink }}>{signerName}</p>
        <p className="mt-1 text-sm font-semibold" style={{ color: muted }}>{signerRole || 'Authorised reviewer'}</p>
      </div>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: muted }}>Signed at</p>
        <p className="mt-2 text-sm font-semibold" style={{ color: ink }}>{signedAt || 'Recorded in audit trail'}</p>
      </div>
    </div> : <p className="mt-4 text-sm font-semibold" style={{ color: ink }}>{legacySignature}</p>}
    {signatureDeclaration ? <p className="mt-5 border-t pt-4 text-xs leading-5" style={{ borderColor: line, color: muted }}>{signatureDeclaration}</p> : null}
    {approvedBy ? <div className="mt-5 grid grid-cols-1 gap-6 border-t pt-5 md:grid-cols-2" style={{ borderColor: line }}>
      <div><p className="text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: muted }}>Approved by</p><p className="mt-2 text-sm font-bold" style={{ color: ink }}>{approvedBy}</p></div>
      <div><p className="text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: muted }}>Approved at</p><p className="mt-2 text-sm font-bold" style={{ color: ink }}>{approvedAt || 'Recorded in audit trail'}</p></div>
    </div> : null}
  </section>;
}

function LiveDocument({ slug, adapted }: { slug: WorkspaceDocumentSlug; adapted: AdaptedDocumentData }) {
  const document = getWorkspaceDocument(slug);
  const language = documentLanguage[slug];
  if (!document || !language) return null;
  const classification = clientFacing.has(slug) ? 'Client document' : language.visibility;
  const groups = groupFacts(adapted.facts);

  return <Page reference={adapted.reference} page="01" classification={classification}>
    <div className="flex items-start justify-between gap-8">
      <div className="max-w-[34rem]">
        <p className="text-[10px] font-bold uppercase tracking-[.2em]" style={{ color: accent }}>{adapted.sourceLabel}</p>
        <h1 className="mt-4 text-4xl font-bold leading-[.98] tracking-[-.045em] md:text-5xl" style={{ color: ink }}>{document.title}</h1>
        <p className="mt-4 text-lg font-semibold leading-7" style={{ color: muted }}>{adapted.subject}</p>
      </div>
      <div className="min-w-[9rem] border-2 p-4 text-right" style={{ borderColor: ink }}>
        <p className="text-[8px] font-bold uppercase tracking-[.14em]" style={{ color: muted }}>Status</p>
        <p className="mt-2 text-sm font-black uppercase tracking-[.05em]" style={{ color: ink }}>{adapted.issueState}</p>
      </div>
    </div>

    <dl className="mt-8 grid grid-cols-2 gap-x-7 gap-y-5 md:grid-cols-4">
      <Meta label="Reference" value={adapted.reference} />
      <Meta label="Revision" value={adapted.revision} />
      <Meta label="Subject" value={adapted.subject} />
      <Meta label="Source" value={adapted.sourceLabel} />
    </dl>

    {groups.map((group) => <FactSection key={group.title} group={group} />)}

    {adapted.warnings.length ? <section className="mt-8 border-l-4 p-5" style={{ borderColor: accent, background: '#f2eee9' }}>
      <p className="text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: accent }}>Missing information</p>
      <ul className="mt-3 grid gap-2">{adapted.warnings.map((warning) => <li key={warning} className="text-sm font-semibold" style={{ color: ink }}>{warning}</li>)}</ul>
    </section> : null}

    <section className="mt-9 border-t-2 pt-5" style={{ borderColor: ink }}>
      <p className="text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: muted }}>Document note</p>
      <p className="mt-3 max-w-2xl text-sm font-medium leading-6" style={{ color: ink }}>{language.closingStatement}</p>
    </section>

    <SignatureEvidence adapted={adapted} />
  </Page>;
}

function PreviewDocument({ slug }: { slug: WorkspaceDocumentSlug }) {
  const document = getWorkspaceDocument(slug);
  const language = documentLanguage[slug];
  if (!document || !language) return null;
  const reference = `OP-${slug.replaceAll('-', '/').toUpperCase()}-001`;
  const classification = clientFacing.has(slug) ? 'Client document template' : language.visibility;

  return <>
    <Page reference={reference} page="01" classification={classification}>
      <p className="text-[10px] font-bold uppercase tracking-[.2em]" style={{ color: accent }}>Template preview</p>
      <h1 className="mt-5 max-w-2xl text-5xl font-bold leading-[.96] tracking-[-.05em]" style={{ color: ink }}>{document.title}</h1>
      <p className="mt-7 max-w-2xl text-base font-medium leading-7" style={{ color: muted }}>{language.purpose}</p>
      <dl className="mt-10 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
        <Meta label="Audience" value={language.audience} />
        <Meta label="Visibility" value={language.visibility} />
        <Meta label="Revision" value="A" />
      </dl>
      <section className="mt-10 border-2 p-6" style={{ borderColor: ink }}>
        <p className="text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: accent }}>Issue requirement</p>
        <p className="mt-3 text-sm font-semibold leading-6" style={{ color: ink }}>{language.issueCondition}</p>
      </section>
      <p className="mt-10 text-sm font-semibold" style={{ color: muted }}>When live case, quote or project data is connected, this guidance is replaced by the actual business record.</p>
    </Page>

    {language.sections.map((section, sectionIndex) => <Page key={section.title} reference={reference} page={String(sectionIndex + 2).padStart(2, '0')} classification={classification}>
      <div className="border-b-2 pb-6" style={{ borderColor: ink }}>
        <p className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: accent }}>Template guidance</p>
        <h2 className="mt-3 text-4xl font-bold tracking-[-.04em]" style={{ color: ink }}>{section.title}</h2>
      </div>
      <div className="mt-7">
        {section.entries.map((entry) => <section key={entry.heading} className="border-b py-6" style={{ borderColor: line }}>
          <h3 className="text-lg font-bold" style={{ color: ink }}>{entry.heading}</h3>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-7" style={{ color: muted }}>{entry.body}</p>
        </section>)}
      </div>
    </Page>)}
  </>;
}

export default function DocumentEngineViewer({ slug, adapted }: { slug: WorkspaceDocumentSlug; adapted?: AdaptedDocumentData }) {
  if (adapted?.connected) return <LiveDocument slug={slug} adapted={adapted} />;
  return <PreviewDocument slug={slug} />;
}