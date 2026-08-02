const workflow = [
  {
    title: 'Requirement',
    text: 'Initial requirement, files, drawings, sketches, or reference material submitted for review.',
    icon: 'upload',
  },
  {
    title: 'Technical Review',
    text: 'Feasibility, inputs, scope boundaries, and missing information are reviewed before commitment.',
    icon: 'review',
  },
  {
    title: 'Commercial Assessment',
    text: 'Deliverables, timing, commercial position, and approval path are made clear.',
    icon: 'clipboard',
  },
  {
    title: 'Execution',
    text: 'CAD/CAM work, drawing production, documentation, and checks are carried out under control.',
    icon: 'gear',
  },
  {
    title: 'Controlled Handover',
    text: 'Structured files, drawings, documentation, and delivery notes are handed over for use.',
    icon: 'package',
  },
];

const drawingDetails = [
  'Fully dimensioned 2D drawings',
  'Dimensions and tolerances',
  'Material notes',
  'Revision history',
  'Project metadata',
];

const fileTree = [
  { level: 0, label: '/Production Drawings', indent: 'pl-0' },
  { level: 0, label: '/Models', indent: 'pl-0' },
  { level: 0, label: '/Supporting Documentation', indent: 'pl-0' },
  { level: 0, label: '/Revision Files', indent: 'pl-0' },
  { level: 0, label: '/Delivery Notes', indent: 'pl-0' },
];

const deliveryChecks = [
  'Clear file naming conventions',
  'Version-controlled outputs',
  'QA-reviewed before delivery',
  'Compatible with manufacturing workflows',
];

function LineIcon({ type }: { type: string }) {
  const common = 'stroke-current';

  return (
    <svg className="h-10 w-10 text-current" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {type === 'upload' ? (
        <>
          <path className={common} d="M24 32V10" strokeWidth="1.6" strokeLinecap="round" />
          <path className={common} d="M15 19l9-9 9 9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path className={common} d="M12 28v8h24v-8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {type === 'review' ? (
        <>
          <path className={common} d="M13 10h18v28H13z" strokeWidth="1.6" />
          <circle className={common} cx="30" cy="30" r="7" strokeWidth="1.6" />
          <path className={common} d="M35 35l5 5" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : null}
      {type === 'clipboard' ? (
        <>
          <path className={common} d="M16 11h16l3 5v24H13V16z" strokeWidth="1.6" strokeLinejoin="round" />
          <path className={common} d="M20 22h12M20 29h12M20 36h8" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : null}
      {type === 'gear' ? (
        <>
          <circle className={common} cx="18" cy="24" r="5" strokeWidth="1.6" />
          <circle className={common} cx="31" cy="17" r="4" strokeWidth="1.6" />
          <circle className={common} cx="32" cy="32" r="5" strokeWidth="1.6" />
          <path className={common} d="M23 22l4-3M23 27l5 3" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : null}
      {type === 'package' ? (
        <>
          <path className={common} d="M14 17l10-5 10 5v14l-10 5-10-5z" strokeWidth="1.6" strokeLinejoin="round" />
          <path className={common} d="M14 17l10 5 10-5M24 22v14" strokeWidth="1.6" strokeLinejoin="round" />
          <circle className={common} cx="35" cy="35" r="7" strokeWidth="1.6" />
          <path className={common} d="M32 35l2 2 4-5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
    </svg>
  );
}

function DrawingPreview() {
  return (
    <div className="drawing_preview border border-black/15 bg-[var(--paper)] p-4">
      <svg viewBox="0 0 640 420" className="h-auto w-full text-[var(--ink)]" fill="none" aria-label="Sample technical drawing preview">
        <rect x="18" y="18" width="604" height="384" stroke="currentColor" strokeWidth="1" />
        <path d="M74 154h118l38-46h150l40 46h80v70h-84l-36 44H230l-40-44H74z" stroke="currentColor" strokeWidth="2" />
        <path d="M134 154v70M226 109v160M382 109v160M472 154v70" stroke="currentColor" strokeWidth="1" />
        <circle cx="314" cy="188" r="52" stroke="currentColor" strokeWidth="2" />
        <circle cx="314" cy="188" r="21" stroke="currentColor" strokeWidth="1" />
        <path d="M88 91h136M404 91h96M88 296h130M416 296h100" stroke="currentColor" strokeWidth="1" />
        <path d="M88 84v14M224 84v14M404 84v14M500 84v14M88 289v14M218 289v14M416 289v14M516 289v14" stroke="currentColor" strokeWidth="1" />
        <text x="142" y="78" fontSize="16" fill="currentColor">120</text>
        <text x="440" y="78" fontSize="16" fill="currentColor">80</text>
        <text x="136" y="286" fontSize="16" fill="currentColor">95</text>
        <text x="452" y="286" fontSize="16" fill="currentColor">4x 09 THRU</text>
        <path d="M456 318h128v64H456z" stroke="currentColor" strokeWidth="1" />
        <path d="M456 340h128M500 318v64" stroke="currentColor" strokeWidth="1" />
        <text x="470" y="335" fontSize="12" fill="currentColor">MIDTS</text>
        <text x="470" y="360" fontSize="11" fill="currentColor">PART NAME</text>
        <text x="506" y="360" fontSize="11" fill="currentColor">MOUNTING BRACKET</text>
        <text x="470" y="378" fontSize="11" fill="currentColor">DWG</text>
        <text x="506" y="378" fontSize="11" fill="currentColor">MIDTS-PRJ-001</text>
        <path d="M58 318h300v64H58zM58 340h300M112 318v64M240 318v64" stroke="currentColor" strokeWidth="1" />
        <text x="70" y="335" fontSize="11" fill="currentColor">REV</text>
        <text x="124" y="335" fontSize="11" fill="currentColor">DESCRIPTION</text>
        <text x="252" y="335" fontSize="11" fill="currentColor">DATE</text>
        <text x="70" y="360" fontSize="11" fill="currentColor">A</text>
        <text x="124" y="360" fontSize="11" fill="currentColor">INITIAL RELEASE</text>
        <text x="252" y="360" fontSize="11" fill="currentColor">20-05-2026</text>
      </svg>
    </div>
  );
}

export default function ProofOfWork() {
  return (
    <>
      <section id="process" className="section_process border-t border-white/20 bg-black py-32 text-white md:py-44">
        <div className="container_large padding_global">
          <div className="process_wrapper mx-auto max-w-6xl">
            <div className="process_heading motion_fade_up max-w-2xl">
              <p className="text_eyebrow mb-8 text-sm font-semibold uppercase text-white">Process</p>
              <h2 className="heading_section text-4xl font-semibold leading-tight text-white md:text-5xl">A Visible Workflow Before Work Begins.</h2>
              <p className="text_body mt-8 max-w-xl text-base leading-7 text-white md:text-lg">Requirement, technical review, commercial assessment, execution, and controlled handover give each project a visible path.</p>
            </div>
            <div className="grid_workflow mt-16 grid gap-4 md:grid-cols-5">
              {workflow.map((item, index) => (
                <article key={item.title} className="card_workflow motion_fade_up border border-white/40 p-5 text-white">
                  <p className="text_label text-sm font-semibold text-white">0{index + 1}</p>
                  <div className="mt-7"><LineIcon type={item.icon} /></div>
                  <h3 className="heading_card mt-7 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="text_body mt-4 text-sm leading-6 text-white">{item.text}</p>
                </article>
              ))}
            </div>
            <div className="proof_note motion_fade_up mt-8 border-y border-white/40 py-5 text-sm text-white">Every stage is reviewed, controlled, and handed over with clear ownership.</div>
          </div>
        </div>
      </section>
      <section className="section_output border-t border-black/10 bg-white py-32 text-black md:py-44">
        <div className="container_large padding_global">
          <div className="proof_output_grid motion_fade_up mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="sample_output">
              <p className="text_eyebrow mb-6 text-sm font-semibold uppercase text-black">Example Output / Drawing Pack</p>
              <h3 className="heading_section max-w-xl text-3xl font-semibold leading-tight text-black md:text-4xl">Example Output: Production-Ready Drawing Pack</h3>
              <p className="text_body mt-6 max-w-2xl text-base leading-7 text-black">A typical MIDTS drawing package includes fully dimensioned technical drawings, tolerance definitions, and revision-controlled documentation ready for manufacturing or internal use.</p>
              <div className="mt-8"><DrawingPreview /></div>
              <div className="grid_drawing_details mt-6 grid gap-4 border-y border-black/20 py-5 text-xs font-medium uppercase text-black sm:grid-cols-2 lg:grid-cols-5">
                {drawingDetails.map((detail) => (<p key={detail} className="text_detail lg:border-l lg:border-black/20 lg:first:border-l-0 lg:pl-4">{detail}</p>))}
              </div>
            </div>
            <div className="delivery_pack">
              <p className="text_eyebrow mb-6 text-sm font-semibold uppercase text-black">What You Actually Receive</p>
              <h3 className="heading_section max-w-xl text-3xl font-semibold leading-tight text-black md:text-4xl">What You Actually Receive.</h3>
              <p className="text_body mt-6 max-w-xl text-base leading-7 text-black">Every project is delivered as a structured, ready-to-use package, not a loose collection of files.</p>
              <div className="card_file_tree mt-8 border border-black/20 p-6 font-mono text-sm text-black">
                {fileTree.map((item) => (<p key={`${item.level}-${item.label}`} className={`text_file py-1 ${item.indent}`}>+ {item.label}</p>))}
              </div>
              <div className="delivery_checks mt-6 border-y border-black/20 py-5">
                {deliveryChecks.map((check) => (<p key={check} className="text_check py-2 text-sm text-black">{check}</p>))}
              </div>
              <div className="delivery_statement mt-6 border border-black bg-black px-6 py-5 text-sm font-semibold text-white">No guesswork. No missing files. No rework loops.</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
