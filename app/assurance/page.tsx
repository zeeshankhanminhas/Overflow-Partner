import type {Metadata} from 'next';
import Link from 'next/link';
import PageShell from '@/components/marketing/PageShell';
import {services} from '@/lib/marketing';

export const metadata: Metadata = {
  title:'Engineering Assurance & Capability | Overflow Partner',
  description:'Explore how Overflow Partner structures engineering requirements, review checkpoints, confidentiality and controlled delivery. Download a capability statement and an illustrative sample handover pack.',
  alternates:{canonical:'/assurance'},
};

const controls = [
  {n:'01',title:'Clear technical scope',detail:'Requirements, assumptions, inputs, deliverables, exclusions and agreed acceptance criteria are recorded before the work package proceeds.'},
  {n:'02',title:'Accountable technical reviews',detail:'Questions, technical decisions and review responsibilities are visible. Approval and release depend on the evidence required for the agreed scope.'},
  {n:'03',title:'Controlled changes',detail:'Revisions and requests outside the agreed work package are identified, assessed and agreed before changes are incorporated.'},
  {n:'04',title:'Confidentiality first',detail:'Confidentiality and sharing authority are confirmed before sensitive drawings, native CAD or intellectual property are provided to an execution partner.'},
  {n:'05',title:'Organised final handover',detail:'A deliverable index, drawing and file identifiers, revisions, review records and any agreed native or exchange formats accompany the release.'},
] as const;
const sampleRows = [
  ['SAMPLE-REG-001','Drawing register','Illustrative','Drawing numbers, titles, revisions, release status'],
  ['SAMPLE-BOM-001','Bill of materials','Illustrative','Parts, quantities, materials and specification fields'],
  ['SAMPLE-REV-001','Technical review log','Illustrative','Finding, owner, disposition, closure evidence'],
  ['SAMPLE-HO-001','Handover index','Illustrative','Final file inventory and acceptance record'],
] as const;

export default function AssurancePage() {
  return <PageShell>
    <section className="bg-[#151b17] py-20 text-white md:py-28">
      <div className="container_large padding_global">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#ff9c65]">Capability & engineering assurance</p>
        <h1 className="mt-6 max-w-5xl text-5xl font-medium leading-[1.06] tracking-[-.045em] md:text-7xl">Engineering support that your team can follow and control.</h1>
        <p className="mt-8 max-w-3xl text-lg leading-8 text-white/75">An overflow engineering partner for defined CAD, drawing and technical documentation work packages. We focus on clear scope, transparent review responsibilities and controlled handover.</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/assurance/templates" className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#ff9c65] px-5 py-3 text-sm font-semibold text-[#151b17] hover:bg-[#ffc09e]">Preview branded templates <span className="ml-2" aria-hidden="true">↗</span></Link>
          <a href="/api/public/sample-handover" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">Sample handover pack (PDF) <span className="ml-2" aria-hidden="true">↓</span></a>
        </div>
        <p className="mt-6 max-w-2xl text-xs leading-6 text-white/60">Preview printable, React-rendered A4 documents or download ready-made PDFs. All sample records are illustrative, not actual client projects or manufacturing-approved deliverables.</p>
      </div>
    </section>

    <section className="py-20 md:py-24" aria-labelledby="assurance-controls">
      <div className="container_large padding_global">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#b74a0f]">A defined delivery framework</p>
            <h2 id="assurance-controls" className="mt-5 max-w-lg text-4xl font-semibold leading-tight tracking-tight">Clear decisions. Documented handover.</h2>
            <p className="mt-6 max-w-md leading-8 text-black/65">Good engineering support is not just the final CAD file. It is knowing what was agreed, who is responsible for each decision and what has been reviewed before release.</p>
          </div>
          <div className="border-t border-black/15">
            {controls.map(item=><article key={item.n} className="grid gap-4 border-b border-black/15 py-6 sm:grid-cols-[56px_1fr]">
              <span className="font-mono text-sm text-[#b74a0f]">{item.n}</span>
              <div><h3 className="text-xl font-semibold">{item.title}</h3><p className="mt-2 max-w-2xl text-sm leading-7 text-black/65">{item.detail}</p></div>
            </article>)}
          </div>
        </div>
      </div>
    </section>

    <section className="border-y border-black/10 bg-white py-20 md:py-24" aria-labelledby="assurance-services">
      <div className="container_large padding_global">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#b74a0f]">Engineering capacity</p>
        <h2 id="assurance-services" className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight">Defined technical work packages.</h2>
        <p className="mt-5 max-w-3xl leading-8 text-black/65">Services are scoped individually. Software compatibility, input quality, technical standards and the required level of review are established for each engagement.</p>
        <div className="mt-10 grid gap-px border border-black/10 bg-black/10 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service,i)=><Link href={`/services/${service.slug}`} key={service.slug} className="group bg-white p-6 transition-colors hover:bg-[#f4f3ee]">
            <span className="font-mono text-xs text-[#b74a0f]">0{i+1}</span>
            <h3 className="mt-6 text-xl font-semibold group-hover:text-[#b74a0f]">{service.title}</h3>
            <p className="mt-3 text-sm leading-7 text-black/65">{service.summary}</p>
          </Link>)}
        </div>
      </div>
    </section>

    <section className="py-20 md:py-24" aria-labelledby="sample-records">
      <div className="container_large padding_global">
        <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#b74a0f]">Illustrative records</p>
            <h2 id="sample-records" className="mt-5 text-4xl font-semibold tracking-tight">See the structure of a controlled handover.</h2>
            <p className="mt-4 max-w-2xl leading-8 text-black/65">Preview the register and review record formats used to communicate what a technical delivery should contain.</p>
          </div>
          <Link href="/assurance/templates" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md border border-[#101311] px-5 py-3 text-sm font-semibold hover:bg-[#101311] hover:text-white">Preview document templates ↗</Link>
        </div>
        <div className="mt-10 overflow-x-auto border border-black/15 bg-white">
          <table className="w-full min-w-[730px] border-collapse text-left text-sm">
            <thead className="bg-[#1f2922] text-white"><tr><th scope="col" className="p-4">Sample reference</th><th scope="col" className="p-4">Document</th><th scope="col" className="p-4">Status</th><th scope="col" className="p-4">Purpose</th></tr></thead>
            <tbody>{sampleRows.map(row=><tr key={row[0]} className="border-t border-black/10">{row.map((value,i)=><td key={i} className="p-4 align-top text-[#25322a]">{value}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="mt-5 text-sm leading-7 text-black/60">No client names, approval signatures, certifications or project outcomes have been fabricated. These are illustrative templates only.</p>
      </div>
    </section>

    <section className="bg-[#151b17] py-16 text-white md:py-20">
      <div className="container_large padding_global">
        <div className="grid gap-8 md:grid-cols-[1.3fr_auto] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#ff9c65]">Let's define the right work package</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Tell us what your engineering team needs delivered.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-white/70">Start with the outcome and available technical information. Confidential files can be shared once appropriate arrangements are confirmed.</p>
          </div>
          <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#ff9c65] px-6 py-3 text-sm font-semibold text-[#101311] hover:bg-[#ffc09e]">Start an enquiry ↗</Link>
        </div>
      </div>
    </section>
  </PageShell>;
}
