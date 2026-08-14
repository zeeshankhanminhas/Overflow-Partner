type WorkspaceVariant='record'|'project'|'timeline'|'document'|'finance';
type ExternalVariant='form'|'execution'|'invoice';

const bars=(count:number)=><>{Array.from({length:count}).map((_,index)=><span key={index} style={{display:'block',height:index===0?12:9,width:index===0?'72%':`${58+(index%3)*11}%`,borderRadius:3,background:'currentColor',opacity:.08}}/>)}</>;

export function WorkspaceRecordSkeleton({variant='record',facts=4,rows=4}:{variant?:WorkspaceVariant;facts?:number;rows?:number}){
  const columns=variant==='project'?4:variant==='finance'?4:3;
  return <section className="vp-page" aria-busy="true" aria-label="Loading record">
    <div className="product-page-header product-skeleton-panel" aria-hidden="true"><div className="product-page-header__copy" style={{display:'grid',gap:12}}>{bars(3)}</div></div>
    {variant==='project'?<div className="product-panel product-skeleton-panel" aria-hidden="true" style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(90px,1fr))',gap:12}}>{Array.from({length:6}).map((_,index)=><span key={index} style={{height:42}}/>)}</div>:null}
    <section className="product-metrics" aria-hidden="true">{Array.from({length:facts}).map((_,index)=><article className="product-metric product-skeleton" key={index}><span/><strong/><small/></article>)}</section>
    <div className={variant==='document'?'product-panel':'product-split'} aria-hidden="true">
      <section className="product-panel product-skeleton-panel" style={{display:'grid',gap:14}}>{bars(3)}{Array.from({length:rows}).map((_,index)=><div key={index} style={{display:'grid',gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,gap:12,padding:'14px 0',borderTop:'1px solid var(--op-line)'}}>{bars(columns)}</div>)}</section>
      {variant!=='document'?<aside className="product-panel product-skeleton-panel" style={{display:'grid',gap:14}}>{bars(5)}</aside>:null}
    </div>
  </section>;
}

export function ExternalRouteSkeleton({variant='form',facts=4,rows=4}:{variant?:ExternalVariant;facts?:number;rows?:number}){
  const invoice=variant==='invoice';
  return <main className="min-h-screen bg-[#f5f4ef] px-5 py-10 text-[#151515] md:px-10 md:py-16" aria-busy="true" aria-label="Loading secure workspace"><div className={invoice?'mx-auto max-w-4xl':'mx-auto max-w-7xl'}>
    <header className="grid gap-8 border-t border-black/10 pt-8 lg:grid-cols-[1.15fr_0.85fr]" aria-hidden="true"><div className="grid gap-4">{bars(4)}</div><div className="grid gap-5 border-l border-black/10 pl-0 lg:pl-8">{bars(4)}</div></header>
    <section className="mt-12 grid gap-6 border-y border-black/10 py-7 md:grid-cols-4" aria-hidden="true">{Array.from({length:facts}).map((_,index)=><div className="grid gap-3" key={index}>{bars(2)}</div>)}</section>
    {invoice?<section className="mt-12 grid gap-5" aria-hidden="true">{bars(8)}</section>:<div className="mt-12 grid gap-14 lg:grid-cols-[0.82fr_1.18fr]" aria-hidden="true"><aside className="grid content-start gap-5">{bars(6)}</aside><section className="grid content-start gap-5">{bars(3)}{Array.from({length:rows}).map((_,index)=><div className="grid gap-3 border-t border-black/10 py-5" key={index}>{bars(3)}</div>)}</section></div>}
  </div></main>;
}
