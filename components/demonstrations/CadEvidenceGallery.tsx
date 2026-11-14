import Image from 'next/image';
import {cadDataUri} from '@/lib/demonstrationCadPreviews';
const panels=[
 {id:'D02 / OPEN',key:'d02Open' as const,title:'Opposed clamps / open state',detail:'CAD-generated development assembly. The cylinder and brake interfaces are schematic envelopes.'},
 {id:'D02 / CLOSED',key:'d02Closed' as const,title:'Opposed clamps / closed state',detail:'CAD-generated development assembly. Sampled clearance checks do not establish braking performance.'},
 {id:'D03 / SPINDLE',key:'d03Assembly' as const,title:'Indexing spindle subassembly',detail:'CAD-generated detailed interface study. Eight parts; not the complete pneumatic fixture.'},
];
export default function CadEvidenceGallery({compact=false}:{compact?:boolean}){return <div className={compact?'grid gap-5 md:grid-cols-3':'grid gap-6 md:grid-cols-3'}>{panels.map(p=><figure key={p.id} className="overflow-hidden border border-black/15 bg-white"><div className="flex h-52 items-center justify-center bg-[#121b19] p-3"><Image src={cadDataUri(p.key)} alt={p.title+' CAD render'} width={430} height={290} className="h-full w-full object-contain" unoptimized/></div><figcaption className="p-5"><span className="text-xs font-semibold uppercase tracking-widest text-[#b74a0f]">{p.id}</span><h3 className="mt-3 text-base font-semibold">{p.title}</h3><p className="mt-2 text-xs leading-5 text-black/65">{p.detail}</p></figcaption></figure>)}</div>;}
