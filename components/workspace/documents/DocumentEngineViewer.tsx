import { getWorkspaceDocument, type WorkspaceDocumentSlug } from './documentRegistry';

const documentSections: Record<WorkspaceDocumentSlug, Array<{ title: string; items: string[] }>> = {
  'partner-technical-assessment-report': [
    { title: 'Technical assessment', items: ['Feasibility and conditions', 'Capability and software confirmation', 'Capacity, earliest start and estimated engineering effort', 'Risks, assumptions and missing information'] },
    { title: 'Commercial readiness', items: ['Pricing readiness', 'Lead time and delivery commitment', 'Commercial assumptions and exclusions', 'Partner declaration and reviewer identity'] },
  ],
  'commercial-approval': [{ title: 'Approval basis', items: ['Approved partner cost', 'Markup and margin position', 'Client selling price', 'Commercial risks and approval decision'] }],
  'client-quote': [{ title: 'Commercial offer', items: ['Controlled scope and deliverables', 'Price, VAT and total', 'Validity and payment terms', 'Assumptions, exclusions and acceptance route'] }],
  'scope-of-work': [{ title: 'Controlled scope', items: ['Objectives and deliverables', 'Inputs and source files', 'Standards, tolerances and acceptance criteria', 'Change control and exclusions'] }],
  'client-requirements': [{ title: 'Requirement register', items: ['Confirmed requirements', 'Assumed requirements', 'Missing information', 'Clarifications and ownership'] }],
  'vendor-safe-package': [{ title: 'Partner issue package', items: ['Controlled case reference', 'Authorised shared documents', 'Identity visibility rules', 'NDA and IP notice'] }],
  'vendor-instructions': [{ title: 'Partner operating rules', items: ['Technical assessment requirements', 'Pricing response rules', 'Communication and clarification route', 'File handling and confidentiality'] }],
  'rfq-response': [{ title: 'Partner commercial response', items: ['Price and currency', 'Lead time and validity', 'Payment terms and delivery commitment', 'Assumptions and exclusions'] }],
  'document-register': [{ title: 'Controlled register', items: ['Document reference and revision', 'Owner and approval state', 'Issue date and recipient', 'Superseded and current versions'] }],
  'commercial-qualification-record': [{ title: 'Qualification decision', items: ['Customer and opportunity context', 'Technical readiness', 'Commercial route', 'Decision, rationale and next action'] }],
  'capability-statement': [{ title: 'Capability', items: ['Overflow engineering capacity', 'CAD and CAM support', 'Controlled partner model', 'Governed delivery and confidentiality'] }],
  'requirement-sheet': [{ title: 'Requirement capture', items: ['Customer objective', 'Technical inputs', 'Constraints and standards', 'Open questions'] }],
  'technical-review': [{ title: 'Technical review', items: ['Readiness assessment', 'Risks and gaps', 'Required clarifications', 'Recommended next action'] }],
  'proposal': [{ title: 'Proposal basis', items: ['Objectives', 'Proposed delivery approach', 'Deliverables', 'Assumptions and next steps'] }],
  'quote': [{ title: 'Quote control', items: ['Quote reference and revision', 'Scope and commercial value', 'Validity and payment terms', 'Acceptance conditions'] }],
  'statement-of-work': [{ title: 'Statement of work', items: ['In-scope work', 'Out-of-scope work', 'Milestones and acceptance', 'Change control'] }],
  'handover-pack': [{ title: 'Delivery handover', items: ['Package contents', 'Controlled file structure', 'Release notes', 'Acceptance notes'] }],
  'completion-report': [{ title: 'Completion record', items: ['Completed scope', 'Delivered files', 'Quality checks', 'Limitations and client actions'] }],
  'invoice': [{ title: 'Invoice control', items: ['Project and quote reference', 'Line items', 'Tax and total', 'Payment instructions'] }],
  'email-templates': [{ title: 'Controlled communication', items: ['Partner review invitation', 'Clarification request', 'Quote issue', 'Acceptance and project handover'] }],
};

const ink = '#171918';
const muted = '#4b514e';
const line = '#d2d0ca';
const accent = '#c84a31';
const paper = '#fafaf8';

function BrandMark() {
  return <div className="flex items-center gap-4">
    <span className="grid h-12 w-12 place-items-center border-2 text-sm font-black tracking-[-.06em]" style={{ borderColor: ink, color: ink }}>OP</span>
    <div>
      <strong className="block text-base font-bold tracking-[-.025em]" style={{ color: ink }}>Overflow Partner</strong>
      <span className="mt-1 block text-[9px] font-bold uppercase tracking-[.22em]" style={{ color: accent }}>Engineering capacity</span>
    </div>
  </div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="border-t-2 pt-3" style={{ borderColor: line }}>
    <dt className="text-[9px] font-bold uppercase tracking-[.18em]" style={{ color: muted }}>{label}</dt>
    <dd className="mt-2 text-sm font-bold" style={{ color: ink }}>{value}</dd>
  </div>;
}

function ControlStrip({ reference }: { reference: string }) {
  return <div className="grid grid-cols-3 border-y text-[9px] font-bold uppercase tracking-[.14em]" style={{ borderColor: line, color: muted }}>
    <span className="py-3">Controlled publication</span>
    <span className="border-x px-4 py-3 text-center" style={{ borderColor: line }}>{reference}</span>
    <span className="py-3 text-right">Revision A</span>
  </div>;
}

function Page({ children, reference, page }: { children: React.ReactNode; reference: string; page: string }) {
  return <main className="midts-document-page relative mx-auto min-h-[1123px] w-full max-w-[794px] overflow-hidden shadow-2xl print:min-h-screen print:max-w-none print:shadow-none" style={{ background: paper, color: ink }}>
    <div className="absolute inset-y-0 left-0 w-[6px]" style={{ background: accent }} />
    <div className="absolute right-[-56px] top-[320px] rotate-90 text-[9px] font-bold uppercase tracking-[.28em]" style={{ color: '#b9b7b1' }}>Overflow Partner · Controlled</div>
    <div className="flex min-h-[1123px] flex-col p-12 pl-16 md:p-16 md:pl-20">
      <header className="flex items-start justify-between gap-8 border-b-2 pb-6" style={{ borderColor: ink }}>
        <BrandMark />
        <div className="text-right">
          <p className="text-[9px] font-bold uppercase tracking-[.2em]" style={{ color: accent }}>Controlled document</p>
          <strong className="mt-2 block text-xs" style={{ color: ink }}>{reference}</strong>
        </div>
      </header>
      <div className="flex-1 py-12">{children}</div>
      <footer className="border-t-2 pt-4" style={{ borderColor: ink }}>
        <div className="flex items-center justify-between gap-6 text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: muted }}>
          <span>Overflow Partner · Private / Controlled</span>
          <span>{reference}</span>
          <span>Page {page}</span>
        </div>
      </footer>
    </div>
  </main>;
}

export default function DocumentEngineViewer({ slug }: { slug: WorkspaceDocumentSlug }) {
  const document = getWorkspaceDocument(slug);
  if (!document) return null;
  const reference = `OP-${slug.replaceAll('-', '/').toUpperCase()}-001`;
  const sections = documentSections[slug];

  return <>
    <Page reference={reference} page="01">
      <div className="grid min-h-[760px] content-between">
        <div>
          <div className="flex items-center gap-3"><span className="h-[2px] w-14" style={{ background: accent }} /><p className="text-[10px] font-bold uppercase tracking-[.24em]" style={{ color: accent }}>{document.dataStatus === 'live-backed' ? 'Live-backed publication' : 'Protected preview'}</p></div>
          <h1 className="mt-10 max-w-2xl text-5xl font-bold leading-[.94] tracking-[-.06em] md:text-7xl" style={{ color: ink }}>{document.title}</h1>
          <p className="mt-9 max-w-xl border-l-4 pl-6 text-base font-medium leading-8" style={{ borderColor: accent, color: muted }}>{document.description}</p>
        </div>
        <div>
          <ControlStrip reference={reference} />
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3">
            <Meta label="Prepared for" value="Workspace controlled case" />
            <Meta label="Reference" value={reference} />
            <Meta label="Revision" value="A" />
            <Meta label="Prepared by" value="Overflow Partner" />
            <Meta label="Issue state" value={document.dataStatus === 'live-backed' ? 'Controlled record' : 'Final issue blocked'} />
            <Meta label="Classification" value="Private / Controlled" />
          </dl>
        </div>
      </div>
    </Page>

    {sections.map((section, sectionIndex) => <Page key={section.title} reference={reference} page={String(sectionIndex + 2).padStart(2, '0')}>
      <div className="grid grid-cols-[5rem_1fr] gap-8 border-b-2 pb-8" style={{ borderColor: ink }}>
        <span className="text-5xl font-bold tracking-[-.06em]" style={{ color: accent }}>{String(sectionIndex + 1).padStart(2, '0')}</span>
        <div><p className="text-[10px] font-bold uppercase tracking-[.22em]" style={{ color: accent }}>Document section</p><h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-[-.05em] md:text-5xl" style={{ color: ink }}>{section.title}</h2></div>
      </div>
      <ol className="mt-12 grid gap-0">
        {section.items.map((item, index) => <li className="grid grid-cols-[3.5rem_1fr] gap-5 border-t-2 py-7" style={{ borderColor: line }} key={item}>
          <span className="text-xs font-bold" style={{ color: accent }}>{String(index + 1).padStart(2, '0')}</span>
          <div><strong className="text-lg font-bold" style={{ color: ink }}>{item}</strong><p className="mt-3 max-w-xl text-sm font-medium leading-7" style={{ color: muted }}>Controlled content is inherited from the relevant case, partner, commercial, quote, project, or document record. Manual transcription is not permitted in the governed issue path.</p></div>
        </li>)}
      </ol>
    </Page>)}

    <Page reference={reference} page={String(sections.length + 2).padStart(2, '0')}>
      <div className="grid min-h-[760px] content-between">
        <div>
          <div className="flex items-center gap-3"><span className="h-[2px] w-14" style={{ background: accent }} /><p className="text-[10px] font-bold uppercase tracking-[.24em]" style={{ color: accent }}>Document control</p></div>
          <h2 className="mt-10 whitespace-pre-line text-6xl font-bold leading-[.88] tracking-[-.065em]" style={{ color: ink }}>Controlled{`\n`}Publication.</h2>
          <p className="mt-9 max-w-xl text-base font-medium leading-8" style={{ color: muted }}>This document is rendered inside the authenticated Overflow Partner workspace. Live case data, approvals, revisions, and final issue controls remain backend governed.</p>
        </div>
        <div className="grid gap-0 border-y-2" style={{ borderColor: ink }}>
          <div className="grid grid-cols-[10rem_1fr] border-b py-5" style={{ borderColor: line }}><strong className="text-xs uppercase tracking-[.14em]" style={{ color: accent }}>Issue rule</strong><p className="text-sm font-semibold" style={{ color: ink }}>Do not issue preview-only documents externally.</p></div>
          <div className="grid grid-cols-[10rem_1fr] py-5"><strong className="text-xs uppercase tracking-[.14em]" style={{ color: accent }}>Release route</strong><p className="text-sm font-semibold" style={{ color: ink }}>Use the live adapter and controlled approval route before production release.</p></div>
        </div>
      </div>
    </Page>
  </>;
}
