import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getManagementIntelligence, type ReportingPeriod } from '@/lib/intelligence/management';

function money(value: number) {
  return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(value||0));
}
function pct(value: number) { return `${Math.max(0, value || 0) * 100 < 0.1 && value > 0 ? '<0.1' : (Math.max(0,value||0)*100).toFixed(1)}%`; }
function hours(value: number | null) {
  if (value == null) return '—';
  if (value < 24) return `${value.toFixed(1)}h`;
  return `${(value/24).toFixed(1)}d`;
}
function human(value: string) { return value.replaceAll('_',' ').replace(/\b\w/g, c=>c.toUpperCase()); }
function width(value:number,max:number){return `${Math.max(3,Math.min(100,max>0?(value/max)*100:0))}%`;}

export default async function IntelligencePage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}) {
  const params = searchParams ? await searchParams : {};
  const rawPeriod = Array.isArray(params.period) ? params.period[0] : params.period;
  const period: ReportingPeriod = ['30d','90d','365d','all'].includes(String(rawPeriod)) ? rawPeriod as ReportingPeriod : '90d';
  const {supabase,organisationId}=await requireUserContext();
  const bi=await getManagementIntelligence(supabase,organisationId,period);
  const a=bi.acquisition,d=bi.delivery,f=bi.finance,docs=bi.documents,e=bi.exceptions,r=bi.risk;
  const maxSource=Math.max(1,...a.sourcePerformance.map(item=>item.prospects));
  const maxWorkload=Math.max(1,...d.workload.map(item=>item.open));
  const maxException=Math.max(1,...e.categories.map(item=>item.count));
  const periodLabel=period==='30d'?'Last 30 days':period==='90d'?'Last 90 days':period==='365d'?'Last 12 months':'All time';

  return <section className="saas-page intelligence-workspace">
    <section className="saas-hero">
      <div className="saas-hero__inner">
        <div className="saas-hero__copy"><p className="vp-kicker">Management intelligence</p><h1>Run the business from operating truth.</h1><p className="vp-subtitle">Pipeline, conversion, delivery, cash, margin, partners, documents and exceptions from the records your team already uses.</p></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="button secondary" href="/workspace/exceptions">Exceptions</Link><Link className="button secondary" href="/workspace/payments">Payments</Link></div>
      </div>
    </section>

    <section className="saas-section">
      <div className="saas-section__header"><div><p className="vp-label">Reporting window</p><h2>{periodLabel}</h2></div><nav style={{display:'flex',gap:8,flexWrap:'wrap'}}>{(['30d','90d','365d','all'] as ReportingPeriod[]).map(item=><Link key={item} className={`button ${period===item?'':'secondary'}`} href={`/workspace/intelligence?period=${item}`}>{item==='30d'?'30 days':item==='90d'?'90 days':item==='365d'?'12 months':'All time'}</Link>)}</nav></div>
    </section>

    <section className="saas-metrics" aria-label="Management summary">
      <article className="saas-metric"><span>Open quote value</span><strong>{money(a.openQuoteValue)}</strong><small>{a.quoteIssued} quotes in the reporting window</small></article>
      <article className="saas-metric"><span>Quote win rate</span><strong>{pct(a.quoteWinRate)}</strong><small>{a.quoteAccepted} accepted in the reporting window</small></article>
      <article className="saas-metric"><span>Forecast gross margin</span><strong>{money(f.forecastGrossMargin)}</strong><small>{pct(f.forecastMarginRate)} of invoiced value</small></article>
      <article className="saas-metric"><span>Operational exceptions</span><strong>{e.summary.total}</strong><small>{e.summary.critical} critical · {e.summary.high} high</small></article>
    </section>

    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:18}}>
      <section className="saas-panel">
        <div className="saas-section__header"><div><p className="vp-label">Commercial funnel</p><h2>From prospect to won work</h2></div><Link href="/workspace/acquisition/prospects">Acquisition →</Link></div>
        <div className="vp-list" style={{marginTop:12}}>
          <div className="vp-row"><div><strong>Prospects created</strong><p>{a.convertedProspects} converted to Cases</p></div><strong>{a.prospects}</strong></div>
          <div className="vp-row"><div><strong>Prospect → Case</strong><p>Acquisition conversion</p></div><strong>{pct(a.prospectConversionRate)}</strong></div>
          <div className="vp-row"><div><strong>Cases created</strong><p>{a.wonCases} won · {a.lostCases} lost</p></div><strong>{a.cases}</strong></div>
          <div className="vp-row"><div><strong>Quote decisions</strong><p>{a.quoteAccepted} accepted</p></div><strong>{pct(a.quoteWinRate)}</strong></div>
          <div className="vp-row"><div><strong>Accepted quote value</strong><p>Accepted in reporting window</p></div><strong>{money(a.acceptedValue)}</strong></div>
        </div>
      </section>

      <section className="saas-panel">
        <div className="saas-section__header"><div><p className="vp-label">Cash & margin</p><h2>Commercial position</h2></div><Link href="/workspace/payments">Payments →</Link></div>
        <div className="vp-list" style={{marginTop:12}}>
          <div className="vp-row"><div><strong>Invoiced</strong><p>All issued client invoices</p></div><strong>{money(f.invoicedValue)}</strong></div>
          <div className="vp-row"><div><strong>Collected</strong><p>{pct(f.collectionRate)} collection rate · {money(f.cashCollectedPeriod)} in this period</p></div><strong>{money(f.cashCollected)}</strong></div>
          <div className="vp-row"><div><strong>Receivables</strong><p>{money(f.overdueReceivables)} overdue</p></div><strong>{money(f.receivables)}</strong></div>
          <div className="vp-row"><div><strong>Partner commitments</strong><p>{money(f.partnerOutstanding)} still payable</p></div><strong>{money(f.partnerCommitted)}</strong></div>
          <div className="vp-row"><div><strong>Cash contribution</strong><p>Client cash collected less partner cash paid</p></div><strong>{money(f.realisedCashContribution)}</strong></div>
        </div>
      </section>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:18}}>
      <section className="saas-panel">
        <div className="saas-section__header"><div><p className="vp-label">Delivery performance</p><h2>Work moving through Projects</h2></div><Link href="/workspace/projects">Projects →</Link></div>
        <div className="vp-compact-metrics" style={{marginTop:12}}><div className="vp-metric"><span>Live projects</span><strong>{d.liveProjects}</strong></div><div className="vp-metric"><span>Overdue projects</span><strong>{d.overdueProjects}</strong></div><div className="vp-metric"><span>Blocked items</span><strong>{d.blockedItems}</strong></div><div className="vp-metric"><span>On-time delivery</span><strong>{pct(d.onTimeRate)}</strong></div></div>
        <div className="vp-list" style={{marginTop:14}}><div className="vp-row"><div><strong>Open delivery items</strong><p>{d.reviewItems} currently in review / ready to issue</p></div><strong>{d.openItems}</strong></div><div className="vp-row"><div><strong>Overdue deliverables</strong><p>Past their delivery due date</p></div><strong>{d.overdueItems}</strong></div><div className="vp-row"><div><strong>Completed</strong><p>Completed in reporting window</p></div><strong>{d.completedItems}</strong></div><div className="vp-row"><div><strong>Due within 7 days</strong><p>Projects approaching due date</p></div><strong>{d.dueSoonProjects}</strong></div></div>
      </section>

      <section className="saas-panel">
        <div className="saas-section__header"><div><p className="vp-label">Document control</p><h2>Review and issue throughput</h2></div><Link href="/workspace/documents">Documents →</Link></div>
        <div className="vp-compact-metrics" style={{marginTop:12}}><div className="vp-metric"><span>Created</span><strong>{docs.created}</strong></div><div className="vp-metric"><span>Issued</span><strong>{docs.issued}</strong></div><div className="vp-metric"><span>Waiting action</span><strong>{docs.waiting}</strong></div><div className="vp-metric"><span>Issue rate</span><strong>{pct(docs.issueRate)}</strong></div></div>
        <div className="vp-list" style={{marginTop:14}}><div className="vp-row"><div><strong>Average approval cycle</strong><p>Creation to approval</p></div><strong>{hours(docs.averageApprovalHours)}</strong></div><div className="vp-row"><div><strong>Average issue cycle</strong><p>Creation to controlled issue</p></div><strong>{hours(docs.averageIssueHours)}</strong></div><div className="vp-row"><div><strong>Controlled issues</strong><p>Issue-history records in reporting window</p></div><strong>{docs.issueRecords}</strong></div></div>
      </section>
    </div>

    <section className="saas-panel">
      <div className="saas-section__header"><div><p className="vp-label">Acquisition effectiveness</p><h2>Which sources convert</h2></div><span>{a.prospects} prospects</span></div>
      <div className="vp-list" style={{marginTop:12}}>{a.sourcePerformance.length===0?<div className="vp-empty">No source performance data in this reporting window.</div>:a.sourcePerformance.map(item=><div className="vp-row" key={item.source}><div style={{minWidth:160}}><strong>{human(item.source)}</strong><p>{item.converted} converted of {item.prospects}</p></div><div style={{flex:1,minWidth:160}}><div style={{height:8,borderRadius:99,background:'var(--op-surface-muted, #ecebe7)',overflow:'hidden'}}><span style={{display:'block',height:'100%',width:width(item.prospects,maxSource),background:'currentColor',opacity:.7}}/></div></div><strong>{pct(item.conversionRate)}</strong></div>)}</div>
    </section>

    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:18}}>
      <section className="saas-panel">
        <div className="saas-section__header"><div><p className="vp-label">Capacity</p><h2>Delivery workload by owner</h2></div><span>{d.openItems} open items</span></div>
        <div className="vp-list" style={{marginTop:12}}>{d.workload.length===0?<div className="vp-empty">No active delivery workload yet.</div>:d.workload.slice(0,8).map(item=><div className="vp-row" key={item.owner}><div style={{minWidth:150}}><strong>{item.owner}</strong><p>{item.overdue} overdue · {item.blocked} blocked · {item.review} review</p></div><div style={{flex:1,minWidth:140}}><div style={{height:8,borderRadius:99,background:'var(--op-surface-muted, #ecebe7)',overflow:'hidden'}}><span style={{display:'block',height:'100%',width:width(item.open,maxWorkload),background:'currentColor',opacity:.7}}/></div></div><strong>{item.open}</strong></div>)}</div>
      </section>

      <section className="saas-panel">
        <div className="saas-section__header"><div><p className="vp-label">Exception pressure</p><h2>Where operations are under strain</h2></div><Link href="/workspace/exceptions">Open exceptions →</Link></div>
        <div className="vp-list" style={{marginTop:12}}>{e.categories.map(item=><div className="vp-row" key={item.category}><div style={{minWidth:140}}><strong>{human(item.category)}</strong></div><div style={{flex:1,minWidth:140}}><div style={{height:8,borderRadius:99,background:'var(--op-surface-muted, #ecebe7)',overflow:'hidden'}}><span style={{display:'block',height:'100%',width:width(item.count,maxException),background:'currentColor',opacity:.7}}/></div></div><strong>{item.count}</strong></div>)}</div>
        <div className="vp-compact-metrics" style={{marginTop:14}}><div className="vp-metric"><span>Critical</span><strong>{e.summary.critical}</strong></div><div className="vp-metric"><span>Overdue</span><strong>{e.summary.overdue}</strong></div><div className="vp-metric"><span>Blocked</span><strong>{e.summary.blocked}</strong></div><div className="vp-metric"><span>High risks</span><strong>{r.high}</strong></div></div>
      </section>
    </div>

    <section className="saas-panel">
      <div className="saas-section__header"><div><p className="vp-label">Partner performance</p><h2>Response reliability</h2></div><Link href="/workspace/partners">Partners →</Link></div>
      <div className="vp-list" style={{marginTop:12}}>{bi.partners.performance.length===0?<div className="vp-empty">Partner response history will appear after review requests are sent.</div>:bi.partners.performance.slice(0,8).map(item=><div className="vp-row" key={item.id}><div><strong>{item.name}</strong><p>{item.requests} requests · {item.submitted} responses{item.rating!=null?` · rating ${item.rating.toFixed(1)}`:''}</p></div><div><small>Response rate</small><strong style={{display:'block'}}>{pct(item.responseRate)}</strong></div><div><small>On time</small><strong style={{display:'block'}}>{pct(item.onTimeRate)}</strong></div><div><small>Avg response</small><strong style={{display:'block'}}>{hours(item.averageResponseHours)}</strong></div></div>)}</div>
    </section>

    <section className="saas-panel">
      <div className="saas-section__header"><div><p className="vp-label">Management attention</p><h2>Highest-priority operational exceptions</h2></div><Link href="/workspace/exceptions">View all →</Link></div>
      <div className="saas-action-list">{e.top.length===0?<div className="saas-empty">No operational exceptions are open right now.</div>:e.top.map((item,index)=><Link href={item.href} key={item.id} className="saas-action-row"><span className="saas-action-row__index">{String(index+1).padStart(2,'0')}</span><div><strong>{item.title}</strong><p>{item.relatedLabel} · {item.detail}</p></div><div><small>{human(item.category)}</small><strong style={{display:'block',marginTop:4}}>{human(item.severity)}</strong></div><span aria-hidden="true">→</span></Link>)}</div>
    </section>

    <p style={{color:'var(--op-muted)',fontSize:12,marginTop:6}}>Management metrics are derived from live workspace records. Forecast margin is invoiced client value less recorded partner commitments; it is not statutory accounting profit.</p>
  </section>;
}
