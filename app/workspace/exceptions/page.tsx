import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getOperationalExceptions, summariseExceptions, type ExceptionCategory, type ExceptionSeverity } from '@/lib/operations/exceptions';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ severity?: string; category?: string }>;

function firstLetter(value:string){return value.charAt(0).toUpperCase()+value.slice(1)}
function formatAge(minutes:number){if(minutes<60)return `${minutes}m`;if(minutes<1440)return `${Math.floor(minutes/60)}h`;return `${Math.floor(minutes/1440)}d`}

export default async function ExceptionsPage({searchParams}:{searchParams:SearchParams}){
  const params=await searchParams;
  const {supabase,organisationId}=await requireUserContext();
  const severity=(params.severity||'all') as ExceptionSeverity|'all';
  const category=(params.category||'all') as ExceptionCategory|'all';
  const all=await getOperationalExceptions(supabase,organisationId);
  const summary=summariseExceptions(all);
  const rows=all.filter(item=>(severity==='all'||item.severity===severity)&&(category==='all'||item.category===category));

  return <section className="saas-page exception-workspace">
    <section className="saas-hero"><div className="saas-hero__inner"><div className="saas-hero__copy"><p className="vp-kicker">Issues</p><h1>See what is genuinely off-plan.</h1><p className="vp-subtitle">One intervention queue for blocked, overdue and failed conditions. Normal Partner, client and review waiting states do not appear here.</p></div><Link className="button secondary" href="/workspace/notifications">Notifications</Link></div></section>

    <section className="saas-metrics" aria-label="Issue summary">
      <article className="saas-metric"><span>Open issues</span><strong>{summary.total}</strong><small>Derived from live business state</small></article>
      <article className="saas-metric"><span>Critical</span><strong>{summary.critical}</strong><small>Immediate intervention</small></article>
      <article className="saas-metric"><span>Overdue</span><strong>{summary.overdue}</strong><small>Past due date</small></article>
      <article className="saas-metric"><span>Blocked</span><strong>{summary.blocked}</strong><small>Cannot progress</small></article>
    </section>

    <section className="saas-section">
      <div className="saas-section__header"><div><p className="vp-label">Focus</p><h2>Operational issue queue</h2></div><span>{rows.length} shown</span></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>{['all','critical','high','medium','low'].map(value=><Link className={`button ${severity===value?'':'secondary'}`} key={value} href={`/workspace/exceptions?severity=${value}&category=${category}`}>{firstLetter(value)}</Link>)}</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>{['all','delivery','task','finance','document','communication'].map(value=><Link className={`button ${category===value?'':'secondary'}`} key={value} href={`/workspace/exceptions?severity=${severity}&category=${value}`}>{firstLetter(value)}</Link>)}</div>
    </section>

    <section className="saas-panel">
      {rows.length===0?<div className="saas-empty"><strong>No issues in this view.</strong><p>When the underlying off-plan condition clears, the issue disappears automatically.</p></div>:<div className="saas-action-list">
        {rows.map((item,index)=><Link href={item.href} key={item.id} className="saas-action-row">
          <span className="saas-action-row__index">{String(index+1).padStart(2,'0')}</span>
          <div><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><strong>{item.title}</strong><span className={`document-status document-status--${item.severity==='critical'?'changes_requested':item.severity==='high'?'in_review':'draft'}`}>{firstLetter(item.severity)}</span><span className="vp-row-status">{firstLetter(item.category)}</span></div><p>{item.detail}</p><small>{item.relatedLabel} · Owner: {item.owner}</small></div>
          <div><small>Open for</small><strong style={{display:'block',marginTop:4}}>{formatAge(item.ageMinutes)}</strong>{item.dueAt?<small style={{display:'block',marginTop:4}}>Due {new Date(item.dueAt).toLocaleDateString('en-GB')}</small>:null}</div>
          <span aria-hidden="true">→</span>
        </Link>)}
      </div>}
    </section>

    <section className="vp-callout"><strong>Issues are state-driven.</strong><p>Resolve the underlying invoice, task, deliverable, overdue document action or message failure. The queue updates from the source record instead of maintaining a second manual status.</p></section>
  </section>;
}
