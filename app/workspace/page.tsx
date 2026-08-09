import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { formatWaitingMinutes, resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';

export default async function WorkspacePage() {
  const { supabase, organisationId, profile } = await requireUserContext();
  const [dashboard,pendingPartnerResult] = await Promise.all([
    getDashboardSnapshot(supabase, organisationId),
    supabase.from('partner_review_requests')
      .select('id,prospect_id,status,created_at,sent_at,submitted_at,response_due_at,partner:partners(company_name),prospect:prospects(company_name)')
      .eq('organisation_id',organisationId)
      .not('prospect_id','is',null)
      .in('status',['invited','opened','in_progress','submitted','clarification_required'])
      .order('created_at',{ascending:false}),
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
  const actions = attention.items.slice(0, 8);

  return <section className="saas-page">
    <section className="saas-hero">
      <div className="saas-hero__inner">
        <div className="saas-hero__copy">
          <p className="vp-kicker">Home</p>
          <h1>Good morning, {name}.</h1>
          <p className="vp-subtitle">See what needs attention, what is waiting, and where work is moving next.</p>
        </div>
        <Link className="button" href="/workspace/acquisition">Open acquisition</Link>
      </div>
    </section>

    <section className="saas-metrics" aria-label="Business attention summary">
      <article className="saas-metric"><span>Needs attention</span><strong>{attention.items.length}</strong><small>Open items across the workspace</small></article>
      <article className="saas-metric"><span>Overdue</span><strong>{attention.overdue}</strong><small>Waiting more than two days</small></article>
      <article className="saas-metric"><span>Ready for review</span><strong>{partnerRows.filter(row=>row.status==='submitted').length}</strong><small>Partner responses awaiting a decision</small></article>
      <article className="saas-metric"><span>Active projects</span><strong>{dashboard.activeProjects}</strong><small>Current delivery workload</small></article>
    </section>

    <section className="saas-grid--dashboard">
      <aside className="saas-stack">
        <section className="saas-panel">
          <p className="vp-label">Waiting on</p><h2>Workload</h2>
          <div className="saas-signal-list">
            <div className="saas-signal"><span>Internal decision</span><strong>{attention.waitingOnInternal}</strong></div>
            <div className="saas-signal"><span>Execution partner</span><strong>{attention.waitingOnPartner}</strong></div>
            <div className="saas-signal"><span>Client decision</span><strong>{attention.waitingOnClient}</strong></div>
          </div>
        </section>
        <section className="saas-panel">
          <p className="vp-label">Watchlist</p><h2>Coming up</h2>
          <div className="saas-signal-list">
            <div className="saas-signal"><span>Customer intakes</span><strong>{dashboard.technicalIntakesAwaitingReview}</strong></div>
            <div className="saas-signal"><span>Partner responses</span><strong>{partnerRows.filter(row=>['invited','opened','in_progress'].includes(row.status)).length}</strong></div>
            <div className="saas-signal"><span>Active delivery</span><strong>{dashboard.activeProjects}</strong></div>
          </div>
        </section>
      </aside>

      <section className="saas-panel">
        <div className="saas-section__header">
          <div><p className="vp-label">Priority queue</p><h2>Needs action now</h2></div>
          <span>{attention.items.length} open</span>
        </div>
        <div className="saas-action-list">
          {actions.length ? actions.map((item, index) => <Link href={item.href} key={`${item.id}-${item.title}`} className="saas-action-row">
            <span className="saas-action-row__index">{String(index + 1).padStart(2, '0')}</span>
            <div><strong>{item.title}</strong><p>{item.company} · {item.reason}</p></div>
            <div><small>Waiting</small><strong style={{display:'block',marginTop:4}}>{formatWaitingMinutes(item.waitingMinutes)}</strong></div>
            <span aria-hidden="true">→</span>
          </Link>) : <div className="saas-empty">Nothing needs your attention right now.</div>}
        </div>
        {attention.items.length > actions.length ? <p style={{margin:'14px 0 0',color:'var(--op-muted)'}}>Showing the 8 oldest priority items.</p> : null}
      </section>
    </section>
  </section>;
}
