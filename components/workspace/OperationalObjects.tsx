import Link from 'next/link';
import type { ReactNode } from 'react';
import { WorkspaceDrawer, InteractionFact, InteractionFacts } from '@/components/workspace/InteractionSurface';
import { ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';
import { eventLabel } from '@/lib/presentation/vocabulary';
import { commercialCopy } from '@/lib/presentation/commercialLanguage';

export type ObjectHeaderFact={label:string;value:ReactNode};

export function ObjectHeader({eyebrow,title,reference,subtitle,status,tone='active',facts=[],actions,backHref,backLabel='Back'}:{eyebrow:string;title:string;reference?:string;subtitle?:ReactNode;status?:string;tone?:ProductTone;facts?:ObjectHeaderFact[];actions?:ReactNode;backHref?:string;backLabel?:string}){
  return <header className="op-object-header"><div className="op-object-header__identity">{backHref?<Link className="op-object-header__back" href={backHref}>← {backLabel}</Link>:null}<p className="op-ui-eyebrow">{eyebrow}{reference?` · ${reference}`:''}</p><div className="op-object-header__title-row"><h1>{title}</h1>{status?<ProductStatus tone={tone}>{status}</ProductStatus>:null}</div>{subtitle?<div className="op-object-header__subtitle">{subtitle}</div>:null}</div>{facts.length||actions?<div className="op-object-header__context">{facts.length?<div className="op-object-header__facts">{facts.map(item=><div key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}</div>:null}{actions?<div className="op-object-header__actions">{actions}</div>:null}</div>:null}</header>;
}

export function ObjectInspectDrawer({triggerLabel='Inspect',eyebrow='Record',title,description,facts=[],children,openHref,openLabel='Open record',triggerClassName='button secondary'}:{triggerLabel?:string;eyebrow?:string;title:string;description?:string;facts?:ObjectHeaderFact[];children?:ReactNode;openHref?:string;openLabel?:string;triggerClassName?:string}){
  const footer=openHref?<Link className="button" href={openHref}>{openLabel}</Link>:undefined;
  return <WorkspaceDrawer triggerLabel={triggerLabel} triggerClassName={triggerClassName} eyebrow={eyebrow} title={title} description={description} footer={footer}><div className="op-inspect-drawer">{facts.length?<InteractionFacts>{facts.map(item=><InteractionFact key={item.label} label={item.label}>{item.value}</InteractionFact>)}</InteractionFacts>:null}{children?<div className="op-inspect-drawer__body">{children}</div>:null}</div></WorkspaceDrawer>;
}

export type BusinessActivityItem={id:string;at:string;eventType?:string|null;title?:string;detail?:ReactNode;actor?:string|null;source?:string|null;tone?:ProductTone};
const activityLanguage:Record<string,string>={
  'partner_execution.workspace_opened':'Delivery Partner opened the work package',
  'partner_execution.progress_reported':'Delivery Partner updated progress',
  'partner_execution.exception_raised':'Delivery Partner reported an issue',
  'partner_execution.delivery_submitted':'Delivery Partner submitted completed work',
  'partner_execution.commencement_recorded':'Delivery Partner confirmed start',
  'project_stage_advanced':'Project moved to the next delivery stage',
  'project_created':'Project started',
  'quote_issued':'Client quote sent',
  'quote_accepted':'Client quote accepted',
  'payment_confirmed':'Payment confirmed',
  'document_approved':'Document approved',
  'document_issued':'Document sent',
  'document_changes_requested':'Document changes requested',
};
function activityTitle(value:string|null|undefined){if(!value)return 'Activity recorded';return activityLanguage[value]||eventLabel(value);}
function dayKey(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return 'Earlier';const today=new Date();const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);if(date.toDateString()===today.toDateString())return 'Today';if(date.toDateString()===yesterday.toDateString())return 'Yesterday';return date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
function time(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}

export function BusinessActivityTimeline({items,empty='No activity has been recorded yet.',limit}:{items:BusinessActivityItem[];empty?:string;limit?:number}){
  const visible=typeof limit==='number'?items.slice(0,limit):items;if(!visible.length)return <div className="op-ui-empty">{empty}</div>;const groups=new Map<string,BusinessActivityItem[]>();for(const item of visible){const key=dayKey(item.at);groups.set(key,[...(groups.get(key)||[]),item]);}
  return <div className="op-activity">{[...groups.entries()].map(([day,events])=><section className="op-activity__day" key={day}><p className="op-activity__day-label">{day}</p><div className="op-activity__events">{events.map(item=><article className="op-activity__event" key={item.id}><time>{time(item.at)}</time><span className="op-activity__dot" aria-hidden="true"/><div><div className="op-activity__event-title"><strong>{commercialCopy(item.title||activityTitle(item.eventType))}</strong>{item.tone?<ProductStatus tone={item.tone}>{item.source||'Activity'}</ProductStatus>:null}</div>{item.detail?<div className="op-activity__detail">{item.detail}</div>:null}{item.actor||item.source?<small>{[item.actor,item.source].filter(Boolean).join(' · ')}</small>:null}</div></article>)}</div></section>)}</div>;
}
