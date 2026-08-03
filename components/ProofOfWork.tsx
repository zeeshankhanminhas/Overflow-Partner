const workflow = [
  ['Requirement', 'Initial requirement, files, drawings, sketches, or reference material submitted for review.'],
  ['Technical Review', 'Feasibility, inputs, scope boundaries, and missing information are reviewed before commitment.'],
  ['Commercial Assessment', 'Deliverables, timing, commercial position, and approval path are made clear.'],
  ['Execution', 'CAD/CAM work, drawing production, documentation, and checks are carried out under control.'],
  ['Controlled Handover', 'Structured files, drawings, documentation, and delivery notes are handed over for use.'],
] as const;

const drawingDetails = [
  'Fully dimensioned 2D drawings',
  'Dimensions and tolerances',
  'Material notes',
  'Revision history',
  'Project metadata',
];

const fileTree = ['/Production Drawings', '/Models', '/Supporting Documentation', '/Revision Files', '/Delivery Notes'];

const deliveryChecks = [
  'Clear file naming conventions',
  'Version-controlled outputs',
  'QA-reviewed before delivery',
  'Compatible with manufacturing workflows',
];

function StepMark({ index }: { index: number }) {
  return (
    <svg className="h-10 w-10 text-current" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="32" height="32" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 24h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M27 18l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="13" y="18" fontSize="8" fill="currentColor">0{index + 1}</text>
    </svg>
  );
}

function DrawingPreview() {
  return (
    <div className="drawing_preview border border-black/15 bg-[var(--paper)] p-4">
      <svg viewBox="0 0 640 420" className="h-auto w-full text-[var(--ink)]" fill="none" aria-label="Overflow Partner sample technical drawing preview">
        <rect x="18" y="18" width="604" height="384" stroke="currentColor" />
        <path d="M74 154h118l38-46h150l40 46h80v70h-84l-36 44H230l-40-44H74z" stroke="currentColor" strokeWidth="2" />
        <circle cx="314" cy="188" r="52" stroke="currentColor" strokeWidth="2" />
        <circle cx="314" cy="188" r="21" stroke="currentColor" />
        <path d="M134 154v70M226 109v160M382 109v160M472 154v70" stroke="currentColor" />
        <path d="M88 91h136M404 91h96M88 296h130M416 296h100" stroke="currentColor" />
        <text x="142" y="78" fontSize="16" fill="currentColor">120</text>
        <text x="440" y="78" fontSize="16" fill="currentColor">80</text>
        <text x="452" y="286" fontSize="16" fill="currentColor">4x Ø9 THRU</text>
        <path d="M456 318h128v64H456zM456 340h128M500 318v64" stroke="currentColor" />
        <text x="468" y="335" fontSize="11" fill="currentColor">OVERFLOW PARTNER</text>
        <text x="468" y="360" fontSize="10" fill="currentColor">PART</text>
        <text x="506" y="360" fontSize="10" fill="currentColor">MOUNTING BRACKET</text>
        <text x="468" y="378" fontSize="10" fill="currentColor">DWG</text>
        <text x="506" y="378" fontSize="10" fill="currentColor">OP-PRJ-001</text>
        <path d="M58 318h300v64H58zM58 340h300M112 318v64M240 318v64" stroke="currentColor" />
        <text x="70" y="335" fontSize="10" fill="currentColor">REV</text>
        <text x="124" y="335" fontSize="10" fill="currentColor">DESCRIPTION</text>
        <text x="252" y="335" fontSize="10" fill="currentColor">DATE</text>
        <text x="70" y="360" fontSize="10" fill="currentColor">A</text>
        <text x="124" y="360" fontSize="10" fill="currentColor">INITIAL RELEASE</text>
        <text x="252" y="360" fontSize="10" fill="currentColor">03-08-2026</text>
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
              {workflow.map(([title, text], index) => (
                <article key={title} className="card_workflow motion_fade_up border border-white/40 p-5 text-white">
                  <p className="text_label text-sm font-semibold text-white">0{index + 1}</p>
                  <div className="mt-7"><StepMark index={index} /></div>
                  <h3 className="heading_card mt-7 text-lg font-semibold text-white">{title}</h3>
                  <p className="text_body mt-4 text-sm leading-6 text-white">{text}</p>
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
              <p className="text_body mt-6 max-w-2xl text-base leading-7 text-black">A typical Overflow Partner drawing package includes fully dimensioned technical drawings, tolerance definitions, and revision-controlled documentation ready for manufacturing or internal use.</p>
              <div className="mt-8"><DrawingPreview /></div>
              <div className="grid_drawing_details mt-6 grid gap-4 border-y border-black/20 py-5 text-xs font-medium uppercase text-black sm:grid-cols-2 lg:grid-cols-5">
                {drawingDetails.map((detail) => <p key={detail} className="text_detail lg:border-l lg:border-black/20 lg:first:border-l-0 lg:pl-4">{detail}</p>)}
              </div>
            </div>

            <div className="delivery_pack">
              <p className="text_eyebrow mb-6 text-sm font-semibold uppercase text-black">What You Actually Receive</p>
              <h3 className="heading_section max-w-xl text-3xl font-semibold leading-tight text-black md:text-4xl">What You Actually Receive.</h3>
              <p className="text_body mt-6 max-w-xl text-base leading-7 text-black">Every project is delivered as a structured, ready-to-use package, not a loose collection of files.</p>
              <div className="card_file_tree mt-8 border border-black/20 p-6 font-mono text-sm text-black">
                {fileTree.map((item) => <p key={item} className="text_file py-1">+ {item}</p>)}
              </div>
              <div className="delivery_checks mt-6 border-y border-black/20 py-5">
                {deliveryChecks.map((check) => <p key={check} className="text_check py-2 text-sm text-black">{check}</p>)}
              </div>
              <div className="delivery_statement mt-6 border border-black bg-black px-6 py-5 text-sm font-semibold text-white">No guesswork. No missing files. No rework loops.</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
