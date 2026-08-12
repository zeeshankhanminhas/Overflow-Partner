'use client';

import { useEffect, useRef, useState } from 'react';

type Result={entity_type:string;entity_id:string;title:string;subtitle:string|null;href:string};
type Shortcut={title:string;subtitle:string;href:string;kind:'Register'|'Saved view'};

const shortcuts:Shortcut[]=[
  {title:'Enquiries',subtitle:'Acquisition operating register',href:'/workspace/acquisition/prospects',kind:'Register'},
  {title:'Cases',subtitle:'Pre-project operating register',href:'/workspace/leads',kind:'Register'},
  {title:'Projects',subtitle:'Accepted delivery portfolio',href:'/workspace/projects',kind:'Register'},
  {title:'Execution Partners',subtitle:'Governed Partner master register',href:'/workspace/partners',kind:'Register'},
  {title:'Approvals',subtitle:'Authority decisions ready now',href:'/workspace/approvals',kind:'Register'},
  {title:'Documents',subtitle:'Controlled document registry',href:'/workspace/documents',kind:'Register'},
  {title:'Payments',subtitle:'Client and Partner settlement ledger',href:'/workspace/payments',kind:'Register'},
  {title:'My work',subtitle:'Active actions assigned to me',href:'/workspace/tasks?view=mine',kind:'Saved view'},
  {title:'Needs attention',subtitle:'Only genuinely off-plan work',href:'/workspace/exceptions',kind:'Saved view'},
  {title:'Waiting on Partner',subtitle:'Project work where the Partner owns the next move',href:'/workspace/projects?view=waiting_partner',kind:'Saved view'},
  {title:'Waiting on Client',subtitle:'Project work where the client owns the next move',href:'/workspace/projects?view=waiting_client',kind:'Saved view'},
  {title:'Awaiting Payment',subtitle:'Projects locked until qualifying client money clears',href:'/workspace/projects?view=awaiting_payment',kind:'Saved view'},
  {title:'Due this week',subtitle:'Project work with a due date in the next seven days',href:'/workspace/projects?view=due_week',kind:'Saved view'},
  {title:'At risk',subtitle:'Risk and compliance items requiring assurance attention',href:'/workspace/risk',kind:'Saved view'},
  {title:'Recently updated',subtitle:'Projects changed most recently',href:'/workspace/projects?view=recent',kind:'Saved view'},
];

export default function CommandPalette(){
  const [open,setOpen]=useState(false);const [query,setQuery]=useState('');const [results,setResults]=useState<Result[]>([]);const [loading,setLoading]=useState(false);const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{const listener=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setOpen(v=>!v);}if(event.key==='Escape')setOpen(false);};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[]);
  useEffect(()=>{if(open)setTimeout(()=>input.current?.focus(),30);},[open]);
  useEffect(()=>{if(query.trim().length<2){setResults([]);return;}const controller=new AbortController();const timer=setTimeout(async()=>{setLoading(true);try{const response=await fetch(`/api/workspace/search?q=${encodeURIComponent(query.trim())}`,{signal:controller.signal});const payload=await response.json();setResults(payload.results||[]);}catch{setResults([]);}finally{setLoading(false);}},180);return()=>{clearTimeout(timer);controller.abort();};},[query]);
  function go(href:string){setOpen(false);setQuery('');window.location.assign(href);}
  const registers=shortcuts.filter(item=>item.kind==='Register');const views=shortcuts.filter(item=>item.kind==='Saved view');
  const section=(title:string,items:Shortcut[])=><><p style={{padding:'10px 12px',margin:0,opacity:.55,fontSize:12,textTransform:'uppercase',letterSpacing:'.12em'}}>{title}</p>{items.map(item=><button type="button" onClick={()=>go(item.href)} key={item.href} style={{width:'100%',display:'flex',justifyContent:'space-between',gap:20,textAlign:'left',padding:'12px',border:0,borderTop:'1px solid rgba(255,255,255,.07)',background:'transparent',color:'inherit',cursor:'pointer'}}><span><strong style={{display:'block'}}>{item.title}</strong><small style={{display:'block',marginTop:4,opacity:.55}}>{item.subtitle}</small></span><span aria-hidden="true">→</span></button>)}</>;
  return <>
    <button type="button" onClick={()=>setOpen(true)} aria-label="Find a record or open a register" style={{border:'1px solid rgba(255,255,255,.14)',background:'transparent',padding:'8px 11px',borderRadius:8,cursor:'pointer',display:'inline-flex',gap:10,alignItems:'center'}}><span>Find or open</span><kbd style={{fontSize:11,opacity:.65}}>⌘K</kbd></button>
    {open?<div role="dialog" aria-modal="true" aria-label="Find a record or open a register" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(4,7,5,.72)',backdropFilter:'blur(8px)',display:'grid',placeItems:'start center',padding:'min(12vh,100px) 16px 24px'}}>
      <section style={{width:'min(720px,100%)',maxHeight:'76vh',overflow:'hidden',background:'#111815',border:'1px solid rgba(255,255,255,.15)',boxShadow:'0 24px 80px rgba(0,0,0,.45)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:16,borderBottom:'1px solid rgba(255,255,255,.1)'}}><span aria-hidden="true" style={{opacity:.5}}>⌕</span><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search workspace records" placeholder="Company, Project, Partner, Case, Quote, document or Enquiry…" style={{border:0,background:'transparent',color:'inherit',fontSize:16,outline:'none',boxShadow:'none',flex:1}}/><button type="button" onClick={()=>setOpen(false)} style={{border:0,background:'transparent',color:'inherit',opacity:.6}}>Esc</button></div>
        <div style={{overflowY:'auto',maxHeight:'calc(76vh - 62px)',padding:8}}>{query.trim().length<2?<>{section('Core registers',registers)}{section('Saved views',views)}</>:loading?<p role="status" style={{padding:20}}>Searching…</p>:results.length?<>{results.map(item=><button type="button" onClick={()=>go(item.href)} key={`${item.entity_type}-${item.entity_id}`} style={{width:'100%',display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:20,textAlign:'left',padding:'14px 12px',border:0,borderTop:'1px solid rgba(255,255,255,.07)',background:'transparent',color:'inherit',cursor:'pointer'}}><span><strong style={{display:'block'}}>{item.title}</strong><small style={{display:'block',marginTop:4,opacity:.55}}>{item.subtitle||item.entity_type}</small></span><span style={{fontSize:11,textTransform:'uppercase',opacity:.55}}>{item.entity_type}</span></button>)}</>:<p role="status" style={{padding:20}}>No matching governed records.</p>}</div>
      </section>
    </div>:null}
  </>;
}
