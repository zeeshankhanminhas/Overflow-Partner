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

function BrandMark() {
  return <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center border border-[#111815] text-xs font-bold tracking-[-.04em]">OP</span><div><strong className="block text-sm tracking-[-.02em]">Overflow Partner</strong><span className="text-[9px] font-semibold uppercase tracking-[.18em] text-[#6d736f]">Engineering capacity</span></div></div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="border-t border-[#d9d6ce] pt-3"><dt className="text-[9px] font-semibold uppercase tracking-[.16em] text-[#747a76]">{label}</dt><dd className="mt-2 text-sm font-semibold text-[#111815]">{value}</dd></div>;
}

function Page({ children, reference, page }: { children: React.ReactNode; reference: string; page: string }) {
  return <main className="midts-document-page mx-auto min-h-[1123px] w-full max-w-[794px] bg-[#f7f7f5] text-[#111815] shadow-2xl print:min-h-screen print:max-w-none print:shadow-none"><div className="flex min-h-[1123px] flex-col p-12 md:p-16"><header className="flex items-start justify-between gap-8 border-b border-[#111815] pb-6"><BrandMark /><div className="text-right"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-[#747a76]">Controlled document</p><strong className="mt-2 block text-xs">{reference}</strong></div></header><div className="flex-1 py-12">{children}</div><footer className="flex items-center justify-between gap-6 border-t border-[#d9d6ce] pt-5 text-[9px] font-semibold uppercase tracking-[.14em] text-[#747a76]"><span>Private workspace preview</span><span>{page}</span></footer></div></main>;
}

export default function DocumentEngineViewer({ slug }: { slug: WorkspaceDocumentSlug }) {
  const document = getWorkspaceDocument(slug);
  if (!document) return null;
  const reference = `OP-${slug.replaceAll('-', '/').toUpperCase()}-001`;
  const sections = documentSections[slug];
  return <>
    <Page reference={reference} page="Cover">
      <div className="grid min-h-[760px] content-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#9a7d42]">{document.dataStatus === 'live-backed' ? 'Live-backed document' : 'Protected preview'}</p><h1 className="mt-8 max-w-2xl text-5xl font-semibold leading-[.96] tracking-[-.055em] md:text-7xl">{document.title}</h1><p className="mt-8 max-w-xl border-l-2 border-[#b4975a] pl-6 text-base leading-8 text-[#4b5651]">{document.description}</p></div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3"><Meta label="Prepared for" value="Workspace controlled case" /><Meta label="Reference" value={reference} /><Meta label="Revision" value="A" /><Meta label="Prepared by" value="Overflow Partner" /><Meta label="Issue state" value={document.dataStatus === 'live-backed' ? 'Controlled record' : 'Final issue blocked'} /><Meta label="Classification" value="Private / Controlled" /></dl>
      </div>
    </Page>
    {sections.map((section, sectionIndex) => <Page key={section.title} reference={reference} page={String(sectionIndex + 2).padStart(2, '0')}><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#9a7d42]">Section {String(sectionIndex + 1).padStart(2, '0')}</p><h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-.045em] md:text-5xl">{section.title}</h2><ol className="mt-12 grid gap-0">{section.items.map((item, index) => <li className="grid grid-cols-[3.5rem_1fr] gap-4 border-t border-[#d9d6ce] py-6" key={item}><span className="text-xs font-semibold text-[#9a7d42]">{String(index + 1).padStart(2, '0')}</span><div><strong className="text-lg font-semibold">{item}</strong><p className="mt-2 max-w-xl text-sm leading-7 text-[#4b5651]">Controlled content is inherited from the relevant case, partner, commercial, quote, project, or document record. Manual transcription is not permitted in the governed issue path.</p></div></li>)}</ol></Page>)}
    <Page reference={reference} page="Close"><div className="grid min-h-[760px] content-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#9a7d42]">Document control</p><h2 className="mt-8 whitespace-pre-line text-6xl font-semibold leading-[.9] tracking-[-.06em]">Controlled{`\n`}Preview.</h2><p className="mt-8 max-w-xl text-base leading-8 text-[#4b5651]">This document is rendered inside the authenticated Overflow Partner workspace. Live case data, approvals, revisions, and final issue controls remain backend governed.</p></div><div className="grid gap-4 border-t border-[#111815] pt-8 text-sm text-[#4b5651]"><p>Do not issue preview-only documents externally.</p><p>Use the live adapter and controlled approval route before production release.</p></div></div></Page>
  </>;
}
