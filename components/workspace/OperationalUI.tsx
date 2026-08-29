import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

export type OperatingStateProps={
  eyebrow?:string;
  title:string;
  record:string;
  reason:string;
  owner:string;
  ownerDetail?:string;
  status?:string;
  tone?:ProductTone;
  nextAction:string;
  href:string;
  consequence?:string;
};

export function OperatingState({eyebrow='Priority now',title,record,reason,owner,ownerDetail,status,tone='active',nextAction,href,consequence}:OperatingStateProps){
  return <section className="op-ui-state" aria-label="Current operating state">
    <div className="op-ui-state__main">
      <div className="op-ui-state__heading"><div><p className="op-ui-eyebrow">{eyebrow}</p><h2>{title}</h2><p className="op-ui-state__record">{record}</p></div>{status?<ProductStatus tone={tone}>{status}</ProductStatus>:null}</div>
      <p className="op-ui-state__reason">{reason}</p>
      <div className="op-ui-state__facts"><div><small>Owner</small><strong>{owner}</strong>{ownerDetail?<span>{ownerDetail}</span>:null}</div><div><small>Next action</small><strong>{nextAction}</strong>{consequence?<span>{consequence}</span>:null}</div></div>
    </div>
    <div className="op-ui-state__action"><Link className="button" href={href}>{nextAction}</Link></div>
  </section>;
}

export type WorkQueueItem={
  id:string;
  label:string;
  title:string;
  detail:string;
  meta?:string;
  owner?:string;
  href:string;
  tone?:ProductTone;
  actionLabel?:string;
  inspect?:ReactNode;
};

export function WorkQueue({title,eyebrow,items,empty='Nothing needs attention.',viewAllHref,viewAllLabel='View all'}:{title:string;eyebrow?:string;items:WorkQueueItem[];empty?:string;viewAllHref?:string;viewAllLabel?:string}){
  return <section className="op-ui-panel op-ui-queue">
    <header className="op-ui-panel__header"><div>{eyebrow?<p className="op-ui-eyebrow">{eyebrow}</p>:null}<h3>{title}</h3></div>{viewAllHref?<Link href={viewAllHref}>{viewAllLabel} →</Link>:null}</header>
    {items.length?<div className="op-ui-queue__list">{items.map(item=><div className="op-ui-queue__row" key={item.id}>
      <ProductStatus tone={item.tone||'neutral'}>{item.label}</ProductStatus>
      <div className="op-ui-queue__copy"><strong>{item.title}</strong><p>{item.detail}</p></div>
      {item.owner?<div className="op-ui-queue__owner"><small>Owner</small><strong>{item.owner}</strong></div>:null}
      {item.meta?<span className="op-ui-queue__meta">{item.meta}</span>:null}
      <div className="op-ui-queue__actions">{item.inspect}{<Link className="button secondary" href={item.href}>{item.actionLabel||'Open'}</Link>}</div>
    </div>)}</div>:<div className="op-ui-empty">{empty}</div>}
  </section>;
}

export function NextActionRail({title='Next action',actionLabel,href,reason,owner,deadline,consequence,secondary=[]}:{title?:string;actionLabel:string;href:string;reason:string;owner:string;deadline?:string;consequence?:string;secondary?:Array<{label:string;href:string}>}){
  return <aside className="op-ui-next" aria-label="Next action">
    <p className="op-ui-eyebrow">{title}</p><h2>{actionLabel}</h2><p>{reason}</p>
    <div className="op-ui-next__facts"><div><small>Owner</small><strong>{owner}</strong></div>{deadline?<div><small>Timing</small><strong>{deadline}</strong></div>:null}{consequence?<div><small>After this</small><strong>{consequence}</strong></div>:null}</div>
    <Link className="button" href={href}>{actionLabel}</Link>
    {secondary.length?<div className="op-ui-next__links">{secondary.map(item=><Link key={item.href} href={item.href}>{item.label}<span>→</span></Link>)}</div>:null}
  </aside>;
}

export function WaitingOnPanel({internal,partner,client}:{internal:number;partner:number;client:number}){
  const total=internal+partner+client;
  return <section className="op-ui-panel op-ui-waiting"><header className="op-ui-panel__header"><div><p className="op-ui-eyebrow">Ownership</p><h3>Waiting on</h3></div><span>{total} open</span></header><div className="op-ui-waiting__grid"><div><span>Your team</span><strong>{internal}</strong></div><div><span>Delivery Partner</span><strong>{partner}</strong></div><div><span>Client</span><strong>{client}</strong></div></div></section>;
}

export function SignalStrip({items}:{items:Array<{label:string;value:ReactNode;detail:string;tone?:ProductTone}>}){
  return <section className="op-ui-signals" aria-label="Operating signals">{items.map(item=><div className="op-ui-signal" key={item.label}><div className="op-ui-signal__top"><small>{item.label}</small>{item.tone?<ProductStatus tone={item.tone}>{item.value}</ProductStatus>:<strong>{item.value}</strong>}</div><span>{item.detail}</span></div>)}</section>;
}
