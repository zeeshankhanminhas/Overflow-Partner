import Link from 'next/link';
const workflow=[
 ['Requirement','We review your objective, available information and expected engineering outputs.'],
 ['Technical review','Scope, technical inputs, interfaces and missing information are clarified.'],
 ['Commercial assessment','Deliverables, timing, price and approval points are agreed before commitment.'],
 ['Execution','Engineering work proceeds within the agreed scope with documented review checkpoints.'],
 ['Controlled handover','Files, drawings, revisions and supporting documents are organised for release.'],
] as const;
const records=[
 ['01','CAD and technical models','Native or agreed neutral model formats, supplied to the accepted scope.'],
 ['02','Drawing register','Identified drawing numbers, revision levels and document status.'],
 ['03','Bill of materials','Where applicable, a structured list of components and specifications.'],
 ['04','Review evidence','Recorded technical comments, disposition and revision actions.'],
 ['05','Handover summary','Final issued file inventory, assumptions and agreed deliverable references.'],
] as const;
export default function ProofOfWork(){return <>
 <section id="process" className="scroll-mt-24 border-t border-white/20 bg-[#101311] py-20 text-white md:py-28">
  <div className="container_large padding_global"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#ff9c65]">Delivery process</p>
   <h2 className="mt-6 max-w-3xl text-4xl font-medium tracking-tight md:text-5xl">A visible process from requirement to handover.</h2>
   <p className="mt-6 max-w-2xl text-base leading-7 text-white/75">Each work package follows clearly defined technical and commercial decisions.</p>
   <div className="mt-12 grid gap-px border border-white/20 bg-white/20 md:grid-cols-5">{workflow.map(([title,description],i)=><article key={title} className="bg-[#101311] p-6"><span className="font-mono text-sm text-[#ff9c65]">0{i+1}</span><h3 className="mt-9 text-lg font-semibold">{title}</h3><p className="mt-4 text-sm leading-6 text-white/70">{description}</p></article>)}</div>
   <Link href="/process" className="mt-8 inline-flex min-h-11 items-center border-b-2 border-[#ff9c65] text-sm font-semibold text-white">Explore our delivery process →</Link>
  </div>
 </section>
 <section id="deliverables" className="bg-white py-20 text-[#101311] md:py-28"><div className="container_large padding_global">
  <div className="grid gap-14 lg:grid-cols-[.85fr_1.15fr]"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#b74a0f]">Engineering handover</p>
   <h2 className="mt-5 text-4xl font-medium leading-tight tracking-tight md:text-5xl">Clear deliverables. Controlled revisions.</h2>
   <p className="mt-7 max-w-xl text-base leading-7 text-black/65">A well-structured engineering handover makes drawings, models and the decisions behind them easier to review and use. The exact documents depend on the agreed scope.</p>
   <p className="mt-5 max-w-xl text-sm leading-6 text-black/55">Detailed engineering demonstrations are undergoing technical development and independent review before publication. We do not present unapproved concept drawings as manufacturing-ready work.</p>
   <Link href="/contact" className="op-cta mt-8">Discuss your requirements →</Link>
  </div><div className="border-t border-black/15">{records.map(([number,title,description])=><div className="grid gap-3 border-b border-black/15 py-6 sm:grid-cols-[52px_1fr] sm:gap-6" key={number}><span className="font-mono text-sm text-[#b74a0f]">{number}</span><div><h3 className="text-xl font-semibold">{title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-black/65">{description}</p></div></div>)}</div></div>
 </div></section>
 </>}
