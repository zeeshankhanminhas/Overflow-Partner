'use client';
import Link from 'next/link';
import { useState } from 'react';
import { demos } from '@/lib/marketing';
function TechnicalPreview({variant}:{variant:number}) {
  return <svg role="img" aria-label={variant===0?'Concept schematic of an indexing and clamping fixture':'Concept schematic of an adjustable roller support'} viewBox="0 0 680 440" className="h-auto w-full" fill="none">
    <rect width="680" height="440" fill="#ebece8"/><g stroke="#c4cbc5" strokeWidth="1">{Array.from({length:15},(_,i)=><path key={i} d={`M${20+i*46} 0v440`}/>) }{Array.from({length:10},(_,i)=><path key={i} d={`M0 ${20+i*46}h680`}/>)}</g>
    {variant===0?<g stroke="#243b35" strokeWidth="3"><path d="M116 319 271 374 540 286 392 230Z" fill="#9eaea6"/><path d="M116 319v26l155 56 269-87v-28" fill="#647f73"/><ellipse cx="335" cy="245" rx="126" ry="65" fill="#cbd2cd"/><ellipse cx="335" cy="245" rx="41" ry="22" fill="#ebece8"/><path d="M211 245v32c35 45 183 45 248-2v-30" fill="#778f84"/><path d="m195 173 78 29v75l-78-29zM443 174l83 37v91l-83-36z" fill="#a5b8ac"/><path d="m223 149 57 22v31l-57-21zM458 154l54 22v36l-54-22z" fill="#ef6c24"/><path d="m319 242 32 0M335 211v64" strokeDasharray="6 6"/></g>:<g stroke="#243b35" strokeWidth="3"><path d="m130 315 139 58 283-112-139-57z" fill="#aabcb0"/><path d="M130 315v29l139 58 283-114v-27" fill="#688174"/><path d="m206 278 0-112 49-19 0 138M437 243V130l49-19v137" fill="#92aaa0"/><path d="m251 195 203-71 27 32-203 72z" fill="#d4dcd4"/><ellipse cx="266" cy="212" rx="22" ry="28" fill="#d8dfd8"/><ellipse cx="465" cy="146" rx="22" ry="28" fill="#d8dfd8"/><path d="m213 292 0-40M443 251v-42" stroke="#ef6c24" strokeWidth="7"/></g>}
    <g fill="#243b35" fontFamily="monospace" fontSize="13"><text x="30" y="38">OVERFLOW PARTNER / CONCEPT REVIEW</text><text x="30" y="414">SCHEMATIC ONLY — NOT A MANUFACTURING DRAWING</text></g><path d="M572 390h70" stroke="#ef6c24" strokeWidth="4"/>
  </svg>;
}
export default function EngineeringShowcase(){
 const [active,setActive]=useState(0);const demo=demos[active];
 return <section id="demonstrations" className="bg-[#f4f3ee] py-20 text-[#101311] md:py-28" aria-labelledby="demo-title">
   <div className="container_large padding_global">
    <div className="flex flex-wrap items-end justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#ef6c24]">Demonstration work</p><h2 id="demo-title" className="mt-4 max-w-3xl text-4xl font-medium leading-tight tracking-[-.04em] md:text-5xl">Engineering capability, demonstrated.</h2><p className="mt-5 max-w-2xl text-base leading-7 text-black/65">Explore two original, fictional engineering projects. Each is a draft concept until independent technical review is complete.</p></div><Link href="/demonstrations" className="op-link">Explore all demonstrations →</Link></div>
    <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label="Choose demonstration">{demos.map((item,i)=><button key={item.id} id={`demo-tab-${i}`} type="button" role="tab" aria-selected={active===i} aria-controls="demo-panel" onClick={()=>setActive(i)} className={`min-h-12 border px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${active===i?'border-[#ef6c24] bg-[#ef6c24] text-white':'border-black/20 bg-white text-[#101311] hover:border-[#ef6c24]'}`}>{i+1}. {i===0?'Indexing fixture':'Conveyor assembly'}</button>)}</div>
    <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${active}`} className="mt-5 grid border border-black/15 bg-white lg:grid-cols-[1.2fr_.8fr]">
      <div className="min-w-0"><TechnicalPreview variant={active}/></div>
      <div className="flex flex-col justify-between gap-10 p-7 md:p-10"><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#ef6c24]">{demo.id} · Draft concept</p><h3 className="mt-5 text-3xl font-semibold tracking-tight">{demo.title}</h3><p className="mt-4 text-base leading-7 text-black/65">{demo.description}</p><ul className="mt-6 grid gap-3">{demo.features.map(v=><li key={v} className="border-b border-black/10 pb-3 text-sm">{v}</li>)}</ul></div><div className="flex flex-wrap items-center gap-4"><Link href={`/demonstrations#${demo.slug}`} className="op-cta">Explore project →</Link><a href={demo.source} download className="op-link text-sm">Download concept source</a></div></div>
    </div><p className="mt-4 text-xs text-black/60">Illustrative schematics and parametric concept files are not validated production models. Draft drawings and engineering verification are subject to independent review.</p>
   </div>
  </section>;
}
