import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getOperationalExceptions, summariseExceptions, type ExceptionCategory, type ExceptionSeverity } from '@/lib/operations/exceptions';
import { ContextActions, InteractionFact, InteractionFacts, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { WorkspaceContextLinks } from '@/components/workspace/WorkspaceRecordMenu';
import { SignalStrip, WorkQueue, type WorkQueueItem } from '@/components/workspace/OperationalUI';

export const dynamic = 'force-dynamic';
type SearchParams = Promise<{ severity?: string; category?: string }>;
function firstLetter(value:string){return value.charAt(0).toUpperCase()+value.slice(1)}
function formatAge(minutes:number){if(minutes<60)return `${minutes}m`;if(minutes<1440)return `${Math.floor(minutes/60)}h`;return `${Math.floor(minutes/1440)}d`}
function categoryLinks(category:string){const base=[{label:'Mission Control',href:'/workspace',detail:'Operating overview'},{label:'Actions',href:'/workspace/tasks',detail:'Assigned internal work'}];if(category==='finance')return [{label:'Payments',href:'/workspace/payments',detail:'Receivables and liabilities'},{label:'Commercial control',href:'/workspace/commercial-control',detail:'Commercial source state'},...base];if(category==='document')return [{label:'Documents',href:'/workspace/documents',detail:'Document state'},{label:'Approvals',href:'/workspace/approvals',detail:'Authority decisions'},...base];if(category==='communication')return [{label:'Messages',href:'/workspace/communications',detail:'Business correspondence'},{label:'Notifications',href:'/workspace/notifications',detail:'Delivery diagnostics'},...base];if(category==='delivery')return [{label:'Projects',href:'/workspace/projects',detail:'Delivery source records'},{label:'Documents',href:'/workspace/documents',detail:'Delivery evidence'},...base];return base}

export default async function ExceptionsPage({searchParams}:{searchParams:SearchParams}){
  const params=await searchParams;const {supabase,organisationId}=await requireUserContext();const severity=(params.severity||'all') as ExceptionSeverity|'all';const category=(params.category||'all') as ExceptionCategory|'all';const all=await getOperationalExceptions(supabase,organisationId);const summary=summariseExceptions(all);const rows=all.filter(item=>(severity==='all'||item.severity===severity)&&(category==='all'||item.category===category));
  const queueItems:WorkQueueItem[]=rows.map(item=>{
    const related=[{label:'Open source record',href:item.href,detail:item.relatedLabel},...categoryLinks(item.category)];
    return {
      id:item.id,
      label:firstLetter(item.severity),
      title:item.title,
      detail:item.detail,
      owner:item.owner,
      meta:`${firstLetter(item.category)} · ${formatAge(item.ageMinutes)}`,
      href:item.href,
      actionLabel:'Resolve',
      tone:item.severity==='critical'?'critical':item.severity==='high'?'attention':'waiting',
      inspect:<ContextActions label={`Inspect ${item.title}`}><WorkspaceDrawer triggerLabel="Inspect" eyebrow="Issue" title={item.title} description={item.detail} footer={<Link className="button" href={item.href}>Open source record</Link>}><InteractionFacts><InteractionFact label="Severity">{firstLetter(item.severity)}</InteractionFact><InteractionFact label="Category">{firstLetter(item.category)}</InteractionFact><InteractionFact label="Owner">{item.owner}</InteractionFact><InteractionFact label="Open for">{formatAge(item.ageMinutes)}</InteractionFact><InteractionFact label="Related record">{item.relatedLabel}</InteractionFact><InteractionFact label="Due">{item.dueAt?new Date(item.dueAt).toLocaleDateString('en-GB'):'Not date-driven'}</InteractionFact></InteractionFacts><WorkspaceContextLinks title="Resolution context" links={related}/></WorkspaceDrawer></ContextActions>,
    };
  });
  return <section className="saas-page exception-workspace">
    <section className="saas-hero"><div className="saas-hero__inner"><div className="saas-hero__copy"><p className="vp-kicker">Issues</p><h1>Resolve what is off-plan.</h1><p className="vp-subtitle">See severity, owner and source context in one queue. Resolve the underlying condition on its authoritative record.</p></div><Link className="button secondary" href="/workspace/notifications">Notifications</Link></div></section>
    <SignalStrip items={[
      {label:'Open issues',value:summary.total,detail:'Derived from live business state',tone:summary.total?'attention':'complete'},
      {label:'Critical',value:summary.critical,detail:'Immediate intervention',tone:summary.critical?'critical':'complete'},
      {label:'Overdue',value:summary.overdue,detail:'Past due date',tone:summary.overdue?'attention':'complete'},
      {label:'Blocked',value:summary.blocked,detail:'Cannot progress',tone:summary.blocked?'blocked':'complete'},
    ]}/>
    <section className="saas-section"><div className="saas-section__header"><div><p className="vp-label">Focus</p><h2>Filter issues</h2></div><span>{rows.length} shown</span></div><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>{['all','critical','high','medium','low'].map(value=><Link className={`button ${severity===value?'':'secondary'}`} key={value} href={`/workspace/exceptions?severity=${value}&category=${category}`}>{firstLetter(value)}</Link>)}</div><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>{['all','delivery','task','finance','document','communication'].map(value=><Link className={`button ${category===value?'':'secondary'}`} key={value} href={`/workspace/exceptions?severity=${severity}&category=${value}`}>{firstLetter(value)}</Link>)}</div></section>
    <WorkQueue title="Operational issue queue" eyebrow="Needs intervention" items={queueItems} empty="No issues in this view." />
    <section className="vp-callout"><strong>Issues are state-driven.</strong><p>Resolve the source condition and the queue updates automatically; there is no duplicate issue status to maintain.</p></section>
  </section>;
}
