import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { formatWaitingMinutes, resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';
import { getOperationalExceptions, summariseExceptions } from '@/lib/operations/exceptions';

export default async function WorkspacePage() {
  const { supabase, organisationId, profile } = await requireUserContext();
  const [dashboard,pendingPartnerResult,operationalExceptions] = await Promise.all([
    getDashboardSnapshot(supabase, organisationId),
    supabase.from('partner_review_requests')
      .select('id,prospect_id,status,created_at,sent_at,submitted_at,response_due_at,partner:partners(company_name),prospect:prospects(company_name)')
      .eq('organisation_id',organisationId)
      .not('prospect_id','is',null)
      .in('status',['invited','opened','in_progress','submitted','clarification_required'])
      .order('created_at',{ascending:false}),
    getOperationalExceptions(supabase,organisationId),
  ]);
  const name = profile.first_name || profile.full_name?.split(' ')[0] || 'Operator';
  const partnerRows=(pendingPartnerResult.data||[]) as any[];
  const prospectIds=new Set(partnerRows.map(row=>String(row.prospect_id)));
  const partnerAttention:AttentionSource[]=partnerRows.map(row=>{
    const internal=row.status==='submitted';
    const clarification=row.status==='clarification_required';
    return {
      id:`partner-${row.id}`,
      title:internal?'Partner response ready for review':clarification?'Partner clarification needed':'Waiting on partner response',
      company:row.prospect?.company_name||'Acquisition prospect',
      reason:internal?'Technical and pricing response is ready for an internal decision':clarification?'Clarification is holding up the next step':`${row.partner?.company_name||'Execution partner'} · due ${new Date(row.response_due_at).toLocaleDateString('en-GB')}`,
      waitingSince:row.submitted_at||row.sent_at||row.created_at,
      priority:internal?'high':'normal',
      href:`/workspace/acquisition/${row.prospect_id}${internal?'#approval-decision':''}`,
      stage:internal||clarification?'prospect':'partner',
    };
  });
  const canonicalBase=dashboard.attention.filter(item=>!prospectIds.has(String(item.id)));
  const attention = resolveBusinessAttention([...partnerAttention,...canonicalBase]);
  const exceptionSummary=summariseExceptions(operationalExceptions);
  const businessActions=attention.items.slice(0,5);
  const exceptionActions=operationalExceptions.slice(0,5);

  return <section className="saas-page">
    <section className="saas-hero">
      <div className="saas-hero__inner">
        <div className="saas-hero__copy">
          <p className="vp-kicker">Home</p>
          <h1>Good morning, {name}.</h1>
          <p className="vp-subtitle">See what needs attention, what is off-track, and where work is moving next.</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="button" href="/workspace/acquisition">Open acquisition</Link><Link className="button secondary" href="/workspace/exceptions">Open exceptions</Link></div>
      </div>
    </section>

    <section className="saas-metrics" aria-label="Business attention summary">
      <article className="saas-metric"><span>Business decisions</span><strong>{attention.items.length}</strong><small>Work waiting on a person or external response</small></article>
      <article className="saas-metric"><span>Operational exceptions</span><strong>{exceptionSummary.total}</strong><small>{exceptionSummary.critical} critical · {exceptionSummary.high} high</small></article>
      <article className="saas-metric"><span>Overdue / blocked</span><strong>{exceptionSummary.overdue + exceptionSummary.blocked}</strong><small>Conditions already outside plan</small></article>
      <article className="saas-metric"><span>Active projects</span><strong>{dashboard.activeProjects}</strong><small>Current delivery workload</small></article>
    </section>

    <section className="saas-grid--dashboard">
      <aside className="saas-stack">
        <section className="saas-panel">
          <p className="vp-label">Waiting on</p><h2>Business workload</h2>
          <div className="saas-signal-list">
            <div className="saas-signal"><span>Internal decision</span><strong>{attention.waitingOnInternal}</strong></div>
            <div className="saas-signal"><span>Execution partner</span><strong>{attention.waitingOnPartner}</strong></div>
            <div className="saas-signal"><span>Client decision</span><strong>{attention.waitingOnClient}</strong></div>
          </div>
        </section>
        <section className="saas-panel">
          <p className="vp-label">Exception watch</p><h2>Operating health</h2>
          <div className="saas-signal-list">
            <div className="saas-signal"><span>Critical</span><strong>{exceptionSummary.critical}</strong></div>
            <div className="saas-signal"><span>Overdue</span><strong>{exceptionSummary.overdue}</strong></div>
            <div className="saas-signal"><span>Blocked</span><strong>{exceptionSummary.blocked}</strong></div>
          </div>
        </section>
      </aside>

      <section className="saas-stack">
        <section className="saas-panel">
          <div className="saas-section__header"><div><p className="vp-label">Priority queue</p><h2>Business decisions</h2></div><span>{attention.items.length} open</span></div>
          <div className="saas-action-list">
            {businessActions.length ? businessActions.map((item, index) => <Link href={item.href} key={`${item.id}-${item.title}`} className="saas-action-row">
              <span className="saas-action-row__index">{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{item.title}</strong><p>{item.company} · {item.reason}</p></div>
              <div><small>Waiting</small><strong style={{display:'block',marginTop:4}}>{formatWaitingMinutes(item.waitingMinutes)}</strong></div>
              <span aria-hidden="true">→</span>
            </Link>) : <div className="saas-empty">No business decisions need attention right now.</div>}
          </div>
        </section>

        <section className="saas-panel">
          <div className="saas-section__header"><div><p className="vp-label">Exception queue</p><h2>Off-track work</h2></div><Link href="/workspace/exceptions">View all {exceptionSummary.total} →</Link></div>
          <div className="saas-action-list">
            {exceptionActions.length ? exceptionActions.map((item,index)=><Link href={item.href} key={item.id} className="saas-action-row">
              <span className="saas-action-row__index">{String(index+1).padStart(2,'0')}</span>
              <div><strong>{item.title}</strong><p>{item.relatedLabel} · {item.detail}</p></div>
              <div><small>{item.severity}</small><strong style={{display:'block',marginTop:4}}>{item.owner}</strong></div><span aria-hidden="true">→</span>
            </Link>):<div className="saas-empty">No operational exceptions right now.</div>}
          </div>
        </section>
      </section>
    </section>
  </section>;
}
