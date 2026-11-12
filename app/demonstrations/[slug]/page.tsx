import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import PageShell from '@/components/marketing/PageShell';
import StudySketch from '@/components/demonstrations/StudySketch';
import CadEvidenceGallery from '@/components/demonstrations/CadEvidenceGallery';
import {studies,findStudy} from '@/lib/engineeringStudies';

type Props={params:Promise<{slug:string}>};
export const dynamicParams=false;
export function generateStaticParams(){return studies.map(s=>({slug:s.slug}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{const {slug}=await params;const s=findStudy(slug);return {title:s?`${s.title} | Engineering Development Study | Overflow Partner`:'Engineering Study',description:s?.description,robots:{index:false,follow:false}};}

const stageLabels=['Requirements and concept','Mechanical architecture','Interface development','Validation and release'];
export default async function StudyPage({params}:Props){
 const {slug}=await params;const s=findStudy(slug);if(!s)notFound();
 const isFixture=s.id==='OP-DEMO-001';
 const engineeringFocus=isFixture?[
  ['Indexing rotor','Geometric study of a rotary plate and its connection to the central spindle.'],
  ['Spindle and retention','D03 explores shaft shoulders, an interface for bearings and axial-retention envelopes.'],
  ['Clamping slides','D02 studies opposing clamp travel in open and closed configurations, with selected intermediate positions.'],
  ['Verification boundary','The D03 subassembly is not the complete pneumatic fixture; full actuator forces, brake contact and safety functions remain unresolved.'],
 ]:[
  ['Conveyor roller','Initial roller envelope and shaft arrangement established at D00 concept level.'],
  ['Support arrangement','Preliminary base and upright geometry for an adjustable support concept.'],
  ['Functional requirements','Working loads, deflection limits, bearing life and adjustment travel still need to be established.'],
  ['Verification boundary','The concept has not undergone load-case validation, tolerancing, clash studies or independent design review.'],
 ];
 return <PageShell>
  <section className="bg-[#111815] pb-20 pt-12 text-white md:pb-24 md:pt-16"><div className="container_large padding_global">
   <Link href="/demonstrations" className="inline-flex min-h-11 items-center text-sm font-medium text-white/70 hover:text-white">← All engineering studies</Link>
   <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_.5fr] lg:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#ff9c65]">{s.id} / Revision {s.revision}</p><h1 className="mt-6 max-w-5xl text-5xl font-semibold leading-[1.03] tracking-[-.05em] md:text-7xl">{s.title}</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-white/70">{s.description}</p></div>
   <div className="border-t border-white/25 pt-6 text-sm text-white/70 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"><p className="text-xs font-semibold uppercase tracking-widest text-white">Engineering status</p><p className="mt-3 font-medium text-[#ffb58c]">{s.status}</p><p className="mt-3 leading-7">Original internal demonstration. No customer attribution, no manufacturing approval and no independent validation claimed.</p></div></div>
  </div></section>
  <section className="bg-[#f4f3ee] pb-20"><div className="container_large padding_global">
   {isFixture?<><div className="pt-10"><p className="mb-5 text-xs font-semibold uppercase tracking-[.2em] text-[#b74a0f]">Actual development CAD / D02 and D03</p><CadEvidenceGallery/></div><p className="mt-5 text-xs leading-6 text-black/60">Images above are authentic renders of the D02 and D03 development geometry. They do not establish a complete functional pneumatic mechanism, verified performance, or manufacturing approval.</p></>:<><div className="-mt-1 overflow-hidden border border-black/10 shadow-sm"><StudySketch roller/></div><p className="mt-4 text-xs leading-6 text-black/55">Illustrative D00 concept schematic. Detailed CAD documentation and independent verification have not been completed for this study.</p></>}
   <div className="mt-14 grid gap-8 border-b border-black/15 pb-12 md:grid-cols-[1fr_2fr]"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#b74a0f]">01 / Design intent</p><h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">The engineering challenge</h2></div><p className="max-w-3xl text-lg leading-9 text-black/70">{isFixture?'Explore a mechanical architecture that positions a rotary workholding element and studies opposed clamp motion. The engineering problem includes shaft support, indexing accuracy, load transmission, retention and reliable actuator control.':'Explore a modular roller-support concept intended to carry a conveyor roller and permit installation adjustment. The engineering problem includes support stiffness, shaft and bearing suitability, load distribution and a practical manufacturing arrangement.'}</p></div>
   <div className="mt-12 grid gap-5 sm:grid-cols-2">{engineeringFocus.map(([title,detail],i)=><article key={title} className="border-t-2 border-[#20372a] bg-white p-7"><span className="text-xs font-semibold uppercase tracking-widest text-[#b74a0f]">Design focus / 0{i+1}</span><h3 className="mt-5 text-xl font-semibold">{title}</h3><p className="mt-4 text-sm leading-7 text-black/65">{detail}</p></article>)}</div>
  </div></section>
  <section className="bg-white py-20 md:py-24"><div className="container_large padding_global">
   <p className="text-xs font-semibold uppercase tracking-widest text-[#b74a0f]">02 / Development record</p><h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">A traceable design progression.</h2><p className="mt-6 max-w-3xl leading-8 text-black/65">Revision milestones describe the engineering work produced so far. They do not indicate final design qualification.</p>
   <div className="mt-12 border-t border-black/15">{s.developed.map((item,i)=><div key={item} className="grid gap-3 border-b border-black/15 py-7 md:grid-cols-[100px_1fr] md:gap-10"><p className="text-sm font-semibold text-[#b74a0f]">STEP 0{i+1}</p><p className="text-lg leading-8">{item}</p></div>)}</div>
   <h3 className="mt-16 text-2xl font-semibold">Engineering deliverable status</h3><div className="mt-6 overflow-x-auto border border-black/15"><table className="w-full min-w-[550px] text-left text-sm"><thead className="bg-[#17221b] text-white"><tr><th className="p-4 font-semibold">Work package</th><th className="p-4 font-semibold">Current evidence</th><th className="p-4 font-semibold">Release status</th></tr></thead><tbody className="divide-y divide-black/10"><tr><td className="p-4 font-medium">Parametric geometry</td><td className="p-4">{isFixture?'D01–D03 development parts and subassemblies':'D00 concept solids'}</td><td className="p-4">Development only</td></tr><tr><td className="p-4 font-medium">Motion or clearance</td><td className="p-4">{isFixture?'D02 limited sampled-position checks; not full mechanism validation':'Not verified'}</td><td className="p-4">Open</td></tr><tr><td className="p-4 font-medium">Calculations</td><td className="p-4">{isFixture?'Preliminary assumptions and component interface estimates':'Not completed'}</td><td className="p-4">Open</td></tr><tr><td className="p-4 font-medium">Manufacturing drawings and GD&T</td><td className="p-4">Not complete or approved</td><td className="p-4">Open</td></tr><tr><td className="p-4 font-medium">Independent engineering review</td><td className="p-4">No independent sign-off</td><td className="p-4">Not approved</td></tr></tbody></table></div>
  </div></section>
  <section className="bg-[#e9ede7] py-20 md:py-24"><div className="container_large padding_global"><div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#b74a0f]">03 / Quality and review</p><h2 className="mt-5 text-4xl font-semibold leading-tight tracking-tight">Outstanding engineering gates.</h2><p className="mt-6 leading-8 text-black/65">Design responsibility requires that assumptions, interface choices and technical uncertainty remain visible until the evidence closes them.</p></div><div className="bg-white px-7 py-3 md:px-10">{s.remaining.map((item,i)=><div key={item} className="grid gap-4 border-b border-black/10 py-7 last:border-b-0 sm:grid-cols-[55px_1fr]"><span className="text-sm font-semibold text-[#b74a0f]">0{i+1}</span><p className="leading-8 text-black/75">{item}</p></div>)}</div></div></div></section>
  <section className="bg-[#111815] py-20 text-white"><div className="container_large padding_global grid gap-8 md:grid-cols-[1.3fr_.7fr] md:items-end"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#ff9c65]">Talk to Overflow Partner</p><h2 className="mt-4 text-4xl font-semibold tracking-tight">Need additional engineering execution capacity?</h2><p className="mt-5 max-w-xl leading-8 text-white/70">Tell us what you are developing, which deliverables you need and the review standards your team works to.</p></div><div className="flex flex-wrap gap-5 md:justify-end"><Link href="/contact" className="inline-flex min-h-12 items-center bg-[#ef6c24] px-7 font-semibold text-[#111815] hover:bg-[#ff9c65]">Start an enquiry ↗</Link><Link href="/demonstrations" className="inline-flex min-h-12 items-center border-b border-white/50 font-semibold">Other studies →</Link></div></div></section>
 </PageShell>;
}
