'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { primaryNavigation } from '@/lib/presentation/navigationContract';
import type { RecentWorkItem } from './WorkspaceOperatorCentre';

type Result={entity_type:string;entity_id:string;title:string;subtitle:string|null;href:string};
const n=primaryNavigation;
const RECENT_KEY='overflow-partner:recent-work';
const quick=[
  {title:n.missionControl.label,subtitle:'Current operating position and next intervention',href:n.missionControl.href},
  {title:n.approvals.label,subtitle:'Authority decisions ready for review',href:n.approvals.href},
  {title:n.cases.label,subtitle:'Pre-project technical and commercial control',href:n.cases.href},
  {title:n.projects.label,subtitle:'Controlled engineering delivery',href:n.projects.href},
  {title:n.payments.label,subtitle:'Receivables, liabilities and settlement evidence',href:n.payments.href},
  {title:n.documents.label,subtitle:'Controlled document registry and revisions',href:n.documents.href},
  {title:n.issues.label,subtitle:'Off-plan conditions requiring intervention',href:n.issues.href},
];

function readRecent():RecentWorkItem[]{
  if(typeof window==='undefined')return[];
  try{const value=JSON.parse(window.localStorage.getItem(RECENT_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return[];}
}
function age(timestamp:number){const minutes=Math.max(0,Math.floor((Date.now()-timestamp)/60000));if(minutes<1)return 'now';if(minutes<60)return `${minutes}m`;const hours=Math.floor(minutes/60);if(hours<24)return `${hours}h`;return `${Math.floor(hours/24)}d`;}

export default function CommandPalette(){
  const [open,setOpen]=useState(false);const [query,setQuery]=useState('');const [results,setResults]=useState<Result[]>([]);const [loading,setLoading]=useState(false);const [recent,setRecent]=useState<RecentWorkItem[]>([]);const [active,setActive]=useState(0);
  const input=useRef<HTMLInputElement>(null);const triggerRef=useRef<HTMLButtonElement>(null);const listboxId=useId();
  const close=()=>{setOpen(false);setQuery('');window.requestAnimationFrame(()=>triggerRef.current?.focus({preventScroll:true}));};
  useEffect(()=>{const listener=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setOpen(v=>{const next=!v;if(!next)window.requestAnimationFrame(()=>triggerRef.current?.focus({preventScroll:true}));return next;});}if(event.key==='Escape'&&open){event.preventDefault();close();}};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[open]);
  useEffect(()=>{if(open){setRecent(readRecent());setActive(0);setTimeout(()=>input.current?.focus(),30);}},[open]);
  useEffect(()=>{if(query.trim().length<2){setResults([]);setActive(0);return;}const controller=new AbortController();const timer=setTimeout(async()=>{setLoading(true);try{const response=await fetch(`/api/workspace/search?q=${encodeURIComponent(query.trim())}`,{signal:controller.signal});const payload=await response.json();setResults(payload.results||[]);setActive(0);}catch{setResults([]);}finally{setLoading(false);}},180);return()=>{clearTimeout(timer);controller.abort();};},[query]);
  function go(href:string){setOpen(false);setQuery('');window.location.assign(href);}
  const visible=useMemo(()=>query.trim().length>=2?results:quick,[query,results]);
  function keyDown(event:React.KeyboardEvent<HTMLInputElement>){if(event.key==='ArrowDown'){event.preventDefault();setActive(index=>Math.min(index+1,Math.max(0,visible.length-1)));}if(event.key==='ArrowUp'){event.preventDefault();setActive(index=>Math.max(0,index-1));}if(event.key==='Enter'&&visible[active]){event.preventDefault();go(visible[active].href);}}
  const optionId=(index:number)=>`${listboxId}-option-${index}`;
  return <>
    <button ref={triggerRef} type="button" onClick={()=>setOpen(true)} aria-label="Search workspace" aria-haspopup="dialog" aria-expanded={open} style={{border:'1px solid rgba(255,255,255,.14)',background:'transparent',padding:'8px 11px',borderRadius:8,cursor:'pointer',display:'inline-flex',gap:10,alignItems:'center'}}><span>Search workspace</span><kbd style={{fontSize:11,opacity:.65}}>⌘K</kbd></button>
    {open?<div role="dialog" aria-modal="true" aria-label="Workspace command palette" onMouseDown={event=>{if(event.target===event.currentTarget)close();}} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(4,7,5,.72)',backdropFilter:'blur(8px)',display:'grid',placeItems:'start center',padding:'min(12vh,100px) 16px 24px'}}>
      <section style={{width:'min(720px,100%)',maxHeight:'76vh',overflow:'hidden',background:'#111815',border:'1px solid rgba(255,255,255,.15)',boxShadow:'0 24px 80px rgba(0,0,0,.45)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:16,borderBottom:'1px solid rgba(255,255,255,.1)'}}><span style={{opacity:.5}}>⌕</span><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={keyDown} role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={listboxId} aria-activedescendant={visible[active]?optionId(active):undefined} placeholder="Search Cases, Projects, documents, invoices, risks, knowledge…" style={{border:0,background:'transparent',color:'inherit',fontSize:16,outline:'none',boxShadow:'none',flex:1}}/><button type="button" onClick={close} style={{border:0,background:'transparent',color:'inherit',opacity:.6}}>Esc</button></div>
        <div id={listboxId} role="listbox" aria-label="Workspace results" style={{overflowY:'auto',maxHeight:'calc(76vh - 62px)',padding:8}}>{query.trim().length<2?<>
          {recent.length?<><p className="command-palette__recent-label">Recent work</p>{recent.slice(0,4).map(item=><button type="button" onClick={()=>go(item.href)} key={`recent-${item.href}`} style={{width:'100%',display:'flex',justifyContent:'space-between',gap:20,textAlign:'left',padding:'12px',border:0,borderTop:'1px solid rgba(255,255,255,.07)',background:'transparent',color:'inherit',cursor:'pointer'}}><span><strong style={{display:'block'}}>{item.label}</strong><small style={{display:'block',marginTop:4,opacity:.55}}>{item.context}</small></span><em className="command-palette__recent-meta">{age(item.visitedAt)}</em></button>)}</>:null}
          <p className="command-palette__recent-label">Quick access</p>{quick.map((item,index)=><button id={optionId(index)} role="option" aria-selected={active===index} type="button" onMouseEnter={()=>setActive(index)} onClick={()=>go(item.href)} key={item.href} style={{width:'100%',display:'flex',justifyContent:'space-between',gap:20,textAlign:'left',padding:'14px 12px',border:0,borderTop:'1px solid rgba(255,255,255,.07)',background:active===index?'rgba(255,255,255,.045)':'transparent',color:'inherit',cursor:'pointer'}}><span><strong style={{display:'block'}}>{item.title}</strong><small style={{display:'block',marginTop:4,opacity:.55}}>{item.subtitle}</small></span><span>→</span></button>)}</>:loading?<p style={{padding:20}} role="status">Searching…</p>:results.length?<>{results.map((item,index)=><button id={optionId(index)} role="option" aria-selected={active===index} type="button" onMouseEnter={()=>setActive(index)} onClick={()=>go(item.href)} key={`${item.entity_type}-${item.entity_id}`} style={{width:'100%',display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:20,textAlign:'left',padding:'14px 12px',border:0,borderTop:'1px solid rgba(255,255,255,.07)',background:active===index?'rgba(255,255,255,.045)':'transparent',color:'inherit',cursor:'pointer'}}><span><strong style={{display:'block'}}>{item.title}</strong><small style={{display:'block',marginTop:4,opacity:.55}}>{item.subtitle||item.entity_type}</small></span><span style={{fontSize:11,textTransform:'uppercase',opacity:.55}}>{item.entity_type}</span></button>)}</>:<p style={{padding:20}}>No matching governed records.</p>}</div>
      </section>
    </div>:null}
  </>;
}
