import type {Metadata} from 'next';
import Link from 'next/link';
import PageShell from '@/components/marketing/PageShell';
import StudySketch from '@/components/demonstrations/StudySketch';
import {studies} from '@/lib/engineeringStudies';

export const metadata:Metadata={title:'Engineering Development Portfolio | Overflow Partner',description:'Explore original mechanical engineering development studies, their scope and documented technical review status.',robots:{index:false,follow:false}};

const capabilities=[
  {number:'01',title:'Mechanical architecture',description:'Original concepts developed around the intended operating function, mechanical interfaces and assembly requirements.'},
  {number:'02',title:'Parametric CAD development',description:'Structured geometry and revision stages to help test layouts and refine component interfaces.'},
  {number:'03',title:'Documented engineering judgement',description:'Visible assumptions, preliminary calculations, geometrical checks and outstanding validation requirements.'},
];
export default function DemonstrationsPage(){return <PageShell>
 <section className="bg-[#111815] py-20 text-white md:py-28"><div className="container_large padding_global">
   <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#ff9c65]">Overflow Partner / Engineering portfolio</p>
   <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_.6fr] lg:items-end">
     <div><h1 className="max-w-5xl text-5xl font-semibold leading-[1.02] tracking-[-.055em] md:text-7xl">Engineering work, <span className="text-[#f59b66]">shown in detail.</span></h1><p className="mt-7 max-w-2xl text-lg leading-8 text-white/70">Explore the thinking, geometry development and technical decisions behind two original mechanical design studies.</p></div>
     <div className="border-l border-white/25 pl-6 text-sm leading-7 text-white/70"><p className="font-semibold uppercase tracking-widest text-white">Transparency by design</p><p className="mt-3">These are internally developed demonstration studies, not client commissions. Development drawings and calculations are not a manufacturing release.</p></div>
   </div>
 </div></section>
 <section className="bg-[#f4f3ee] py-20 md:py-24"><div className="container_large padding_global">
   <div className="mb-10 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#b74a0f]">Selected studies</p><h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Two different engineering challenges.</h2></div><span className="text-sm text-[#59645c]">Portfolio preview / revision controlled</span></div>
   <div className="grid gap-8 lg:grid-cols-2">{studies.map((s,i)=><article key={s.id} className="group overflow-hidden border border-black/15 bg-white">
     <Link href={`/demonstrations/${s.slug}`} className="block focus-visible:outline-offset-[-5px]" aria-label={`View ${s.title} engineering study`}><StudySketch roller={i===1}/></Link>
     <div className="p-7 md:p-10"><div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-widest"><span className="text-[#b74a0f]">{s.id}</span><span className="border border-[#d6d7d0] px-3 py-1 text-[#556158]">Revision {s.revision}</span></div>
      <h3 className="mt-6 text-3xl font-semibold leading-tight tracking-tight">{s.title}</h3><p className="mt-4 text-base leading-7 text-black/65">{s.description}</p>
      <p className="mt-6 border-l-2 border-[#b74a0f] pl-3 text-sm font-medium text-[#79421f]">{s.status}</p>
      <Link href={`/demonstrations/${s.slug}`} className="mt-8 inline-flex min-h-11 items-center border-b-2 border-[#b74a0f] text-sm font-semibold text-[#101311] hover:text-[#b74a0f]">Explore the engineering study <span aria-hidden="true" className="ml-2">↗</span></Link>
     </div>
   </article>)}</div>
 </div></section>
 <section className="bg-white py-20 md:py-24"><div className="container_large padding_global"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#b74a0f]">Our method</p><h2 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">More than a polished 3D image.</h2><div className="mt-12 grid gap-px border border-black/15 bg-black/15 md:grid-cols-3">{capabilities.map(c=><div className="bg-white p-8" key={c.number}><span className="text-sm font-semibold text-[#b74a0f]">{c.number}</span><h3 className="mt-7 text-xl font-semibold">{c.title}</h3><p className="mt-4 text-sm leading-7 text-black/65">{c.description}</p></div>)}</div><p className="mt-8 max-w-4xl text-sm leading-7 text-black/65">This portfolio is under development. Technical claims are limited to the work evidenced so far. Independent engineering assessment is pending, and none of the displayed studies is approved for manufacture.</p></div></section>
 <section className="bg-[#111815] py-16 text-white"><div className="container_large padding_global flex flex-wrap items-center justify-between gap-7"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#ff9c65]">An extension of your engineering team</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Have a design requirement to discuss?</h2></div><Link href="/contact" className="inline-flex min-h-12 items-center bg-[#ef6c24] px-7 font-semibold text-[#111815] hover:bg-[#ff9c65]">Start an enquiry ↗</Link></div></section>
 </PageShell>;}
