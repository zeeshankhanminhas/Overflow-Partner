import Link from 'next/link';

const principles = [
  {number:'01', title:'Defined scope', body:'Requirements, acceptance criteria and deliverables agreed before a work package begins.'},
  {number:'02', title:'Technical checkpoints', body:'Review responsibilities, open questions and changes captured during delivery.'},
  {number:'03', title:'Information control', body:'Confidentiality and access arrangements confirmed before sensitive files are shared.'},
  {number:'04', title:'Traceable handover', body:'Identified files, revisions and review records organised for client acceptance.'},
] as const;

export default function AssurancePreview() {
  return <section className="border-t border-white/15 bg-[#151b17] py-20 text-white md:py-28" aria-labelledby="assurance-heading">
    <div className="container_large padding_global">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#ff9c65]">The Overflow Partner approach</p>
          <h2 id="assurance-heading" className="mt-5 max-w-3xl text-4xl font-medium leading-tight tracking-tight md:text-5xl">Engineering capacity. <span className="text-[#ff9c65]">With control built in.</span></h2>
        </div>
        <div className="lg:pb-1">
          <p className="max-w-xl text-base leading-8 text-white/75">Clear responsibilities, agreed engineering standards and an organised technical handover. See how the delivery framework is structured, and inspect an illustrative handover pack.</p>
          <Link href="/assurance" className="mt-7 inline-flex min-h-11 items-center border-b-2 border-[#ff9c65] py-2 text-sm font-semibold text-white hover:text-[#ffb78d]">Explore engineering assurance <span aria-hidden="true" className="ml-2">↗</span></Link>
        </div>
      </div>
      <div className="mt-12 grid gap-px border border-white/20 bg-white/20 sm:grid-cols-2 lg:grid-cols-4">
        {principles.map(item => <article key={item.number} className="bg-[#1f2922] p-6 md:p-7">
          <span className="font-mono text-xs tracking-wider text-[#ff9c65]">{item.number}</span>
          <h3 className="mt-7 text-lg font-semibold">{item.title}</h3>
          <p className="mt-3 text-sm leading-7 text-white/70">{item.body}</p>
        </article>)}
      </div>
      <p className="mt-6 text-xs leading-6 text-white/55">This section describes the delivery framework and available sample documents. It does not imply external accreditation, completed client projects or independently certified engineering work.</p>
    </div>
  </section>;
}
