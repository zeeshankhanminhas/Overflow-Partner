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
      title:internal?'Approval required — partner response':clarification?'Partner clarification required':'Waiting on partner response',
      company:row.prospect?.company_name||'Acquisition prospect',
      reason:internal?'Technical + commercial response is ready for Go / No-Go':clarification?'Clarification cycle is blocking progression':`${row.partner?.company_name||'Execution partner'} · due ${new Date(row.response_due_at).toLocaleDateString('en-GB')}`,
      waitingSince:row.submitted_at||row.sent_at||row.created_at,
      priority:internal?'high':'normal',
      href:`/workspace/acquisition/${row.prospect_id}${internal?'#approval-decision':''}`,
      stage:internal||clarification?'prospect':'partner',
    };
  });
  const canonicalBase=dashboard.attention.filter(item=>!prospectIds.has(String(item.id)));
  const attention = resolveBusinessAttention([...partnerAttention,...canonicalBase]);
  const actions = attention.items.slice(0, 8);

  return <section style={{ display: 'grid', gap: 20 }}>
    <section className="card" style={{ width: '100%', padding: 28, background: 'linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.025))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 28, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 760 }}>
          <p className="eyebrow">Owner command centre</p>
          <h1 style={{ margin: '16px 0 12px' }}>Good morning, {name}.</h1>
          <p className="lede" style={{ margin: 0 }}>Priority work, ageing risk and the next governed decision. Approval-required work is surfaced here rather than left hidden inside records.</p>
        </div>
        <Link className="button secondary" href="/workspace/acquisition">Open acquisition</Link>
      </div>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
      <article className="metric"><span>Open actions</span><strong>{attention.items.length}</strong><small>Business items requiring attention</small></article>
      <article className="metric"><span>Overdue</span><strong>{attention.overdue}</strong><small>Waiting more than two days</small></article>
      <article className="metric"><span>Approval required</span><strong>{partnerRows.filter(row=>row.status==='submitted').length}</strong><small>Partner responses awaiting Go / No-Go</small></article>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,.72fr) minmax(0,1.28fr)', gap: 20, alignItems: 'start' }}>
      <aside style={{ display: 'grid', gap: 20 }}>
        <section className="card" style={{ width: '100%' }}>
          <p className="eyebrow">Workload</p><h2 style={{ marginTop: 8 }}>Where work is waiting</h2>
          <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', paddingTop: 12 }}><span>Internal decision</span><strong>{attention.waitingOnInternal}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', paddingTop: 12 }}><span>Execution partner</span><strong>{attention.waitingOnPartner}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', paddingTop: 12 }}><span>Client decision</span><strong>{attention.waitingOnClient}</strong></div>
          </div>
        </section>
        <section className="card" style={{ width: '100%' }}>
          <p className="eyebrow">Watchlist</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Customer intakes</span><strong>{dashboard.technicalIntakesAwaitingReview}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Partner responses outstanding</span><strong>{partnerRows.filter(row=>['invited','opened','in_progress'].includes(row.status)).length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active delivery</span><strong>{dashboard.activeProjects}</strong></div>
          </div>
        </section>
      </aside>

      <section className="card" style={{ width: '100%', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'end' }}>
          <div><p className="eyebrow">Needs action now</p><h2 style={{ margin: '8px 0 0' }}>Live action queue</h2></div>
          <span>{attention.items.length} open</span>
        </div>
        <div style={{ display: 'grid', marginTop: 20 }}>
          {actions.length ? actions.map((item, index) => <Link href={item.href} key={`${item.id}-${item.title}`} style={{ display: 'grid', gridTemplateColumns: '42px minmax(0,1fr) 100px 32px', gap: 14, alignItems: 'center', padding: '18px 4px', borderTop: '1px solid' }}>
            <span style={{ color: '#b4975a', fontSize: 12 }}>{String(index + 1).padStart(2, '0')}</span>
            <div style={{ minWidth: 0 }}><strong style={{ display: 'block' }}>{item.title}</strong><p style={{ margin: '5px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.company} · {item.reason}</p></div>
            <div><small>Waiting</small><strong style={{ display: 'block', marginTop: 4 }}>{formatWaitingMinutes(item.waitingMinutes)}</strong></div>
            <span>↗</span>
          </Link>) : <p style={{ padding: '24px 0 8px' }}>No business items currently require a decision.</p>}
        </div>
        {attention.items.length > actions.length ? <p style={{ margin: '14px 0 0', color: 'var(--op-muted)' }}>Showing the 8 oldest priority items.</p> : null}
      </section>
    </section>
  </section>;
}
