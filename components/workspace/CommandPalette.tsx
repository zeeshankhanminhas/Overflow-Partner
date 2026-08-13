'use client';

import { useEffect, useRef, useState } from 'react';
import { primaryNavigation } from '@/lib/presentation/navigationContract';

type Result={entity_type:string;entity_id:string;title:string;subtitle:string|null;href:string};
const n=primaryNavigation;
const quick=[
  {title:n.missionControl.label,subtitle:'Current operating position and next intervention',href:n.missionControl.href},
  {title:n.assessments.label,subtitle:'Execution Partner feasibility, capacity and price',href:n.assessments.href},
  {title:n.messages.label,subtitle:'Business correspondence across governed records',href:n.messages.href},
  {title:n.notifications.label,subtitle:'Automated message delivery health and failures',href:n.notifications.href},
  {title:n.settings.label,subtitle:'Workspace administration and system settings',href:n.settings.href},
];

export default function CommandPalette(){
  const [open,setOpen]=useState(false);const [query,setQuery]=useState('');const [results,setResults]=useState<Result[]>([]);const [loading,setLoading]=useState(false);const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{const listener=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setOpen(v=>!v);}if(event.key==='Escape')setOpen(false);};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[]);
  useEffect(()=>{if(open)setTimeout(()=>input.current?.focus(),30);},[open]);
  useEffect(()=>{if(query.trim().length<2){setResults([]);return;}const controller=new AbortController();const timer=setTimeout(async()=>{setLoading(true);try{const response=await fetch(`/api/workspace/search?q=${encodeURIComponent(query.trim())}`,{signal:controller.signal});const payload=await response.json();setResults(payload.results||[]);}catch{setResults([]);}finally{setLoading(false);}},180);return()=>{clearTimeout(timer);controller.abort();};},[query]);
  function go(href:string){setOpen(false);setQuery('');window.location.assign(href);}
  return <>
    <button type="button" onClick={()=>setOpen(true)} aria-label="Search workspace" style={{border:'1px solid rgba(255,255,255,.14)',background:'transparent',padding:'8px 11px',borderRadius:8,cursor:'pointer',display:'inline-flex',gap:10,alignItems:'center'}}><span>Search workspace</span><kbd style={{fontSize:11,opacity:.65}}>⌘K</kbd></button>
    {open?<div role="dialog" aria-modal="true" aria-label="Workspace command palette" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(4,7,5,.72)',backdropFilter:'blur(8px)',display:'grid',placeItems:'start center',padding:'min(12vh,100px) 16px 24px'}}>
      <section style={{width:'min(720px,100%)',maxHeight:'76vh',overflow:'hidden',background:'#111815',border:'1px solid rgba(255,255,255,.15)',boxShadow:'0 24px 80px rgba(0,0,0,.45)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:16,borderBottom:'1px solid rgba(255,255,255,.1)'}}><span style={{opacity:.5}}>⌕</span><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search Cases, Projects, documents, invoices, risks, knowledge…" style={{border:0,background:'transparent',color:'inherit',fontSize:16,outline:'none',boxShadow:'none'}}/><button type="button" onClick={()=>setOpen(false)} style={{border:0,background:'transparent',color:'inherit',opacity:.6}}>Esc</button></div>
        <div style={{overflowY:'auto',maxHeight:'calc(76vh - 62px)',padding:8}}>{query.trim().length<2?<><p style={{padding:'10px 12px',margin:0,opacity:.55,fontSize:12,textTransform:'uppercase',letterSpacing:'.12em'}}>Quick access</p>{quick.map(item=><button type="button" onClick={()=>go(item.href)} key={item.href} style={{width:'100%',display:'flex',justifyContent:'space-between',gap:20,textAlign:'left',padding:'14px 12px',border:0,borderTop:'1px solid rgba(255,255,255,.07)',background:'transparent',color:'inherit',cursor:'pointer'}}><span><strong style={{display:'block'}}>{item.title}</strong><small style={{display:'block',marginTop:4,opacity:.55}}>{item.subtitle}</small></span><span>→</span></button>)}</>:loading?<p style={{padding:20}}>Searching…</p>:results.length?<>{results.map(item=><button type="button" onClick={()=>go(item.href)} key={`${item.entity_type}-${item.entity_id}`} style={{width:'100%',display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:20,textAlign:'left',padding:'14px 12px',border:0,borderTop:'1px solid rgba(255,255,255,.07)',background:'transparent',color:'inherit',cursor:'pointer'}}><span><strong style={{display:'block'}}>{item.title}</strong><small style={{display:'block',marginTop:4,opacity:.55}}>{item.subtitle||item.entity_type}</small></span><span style={{fontSize:11,textTransform:'uppercase',opacity:.55}}>{item.entity_type}</span></button>)}</>:<p style={{padding:20}}>No matching governed records.</p>}</div>
      </section>
    </div>:null}
  </>;
}