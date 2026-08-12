import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { formatWaitingMinutes, resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';
import { getOperationalExceptions, summariseExceptions } from '@/lib/operations/exceptions';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

export default async function WorkspacePage() {
  const { supabase, organisationId } = await requireUserContext();
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
  const partnerRows=(pendingPartnerResult.data||[]) as any[];
  const prospectIds=new Set(partnerRows.map(row=>String(row.prospect_id)));
  const partnerAttention:AttentionSource[]=partnerRows.map(row=>{
    const internal=row.status==='submitted';
    const clarification=row.status==='clarification_required';
    return {
      id:`partner-${row.id}`,
      title:internal?'Partner assessment ready':clarification?'Partner needs clarification':'Waiting for Partner',
      company:row.prospect?.company_name||'Enquiry',
      reason:internal?'Feasibility and price are ready for Go / No-Go':clarification?'More information is holding up the next step':`${row.partner?.company_name||'Execution Partner'} · due ${new Date(row.response_due_at).toLocaleDateString('en-GB')}`,
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
  const nextDecision=businessActions[0];

  return <section className="vp-page">
    <ProductPageHeader
      eyebrow="Mission Control"
      title="What needs attention"
      description="See the next action, who you are waiting on and anything that has moved off-plan."
      actions={<><Link className="button" href="/workspace/acquisition">Open enquiries</Link><Link className="button secondary" href="/workspace/exceptions">Open issues</Link></>}
    />

    <section className="operating-brief" aria-label="Current operating position">
      <div className="operating-brief__primary">
        <small>Next action</small>
        {nextDecision ? <>
          <h2>{nextDecision.title}</h2>
          <p><strong>{nextDecision.company}</strong> · {nextDecision.reason}</p>
          <p style={{marginTop:6}}>Waiting {formatWaitingMinutes(nextDecision.waitingMinutes)} · {nextDecision.priority==='high'?'Priority':'Normal priority'}</p>
          <Link href={nextDecision.href}>Open →</Link>
        </> : <>
          <h2>Nothing needs a decision right now.</h2>
          <p>The queue is clear. The next action will appear here when an internal decision, Partner response or client outcome is due.</p>
        </>}
      </div>
      <div className="operating-brief__signals" aria-label="Waiting on">
        <div className="operating-brief__signal"><small>Your team</small><strong>{attention.waitingOnInternal}</strong></div>
        <div className="operating-brief__signal"><small>Execution Partner</small><strong>{attention.waitingOnPartner}</strong></div>
        <div className="operating-brief__signal"><small>Client</small><strong>{attention.waitingOnClient}</strong></div>
        <div className="operating-brief__signal"><small>Off-plan</small><strong>{exceptionSummary.total}</strong></div>
      </div>
    </section>

    <ProductMetrics label="Operations summary">
      <ProductMetric label="Decisions waiting" value={attention.items.length} detail="Needs a person or external response" tone={attention.items.length?'attention':'complete'} />
      <ProductMetric label="Issues" value={exceptionSummary.total} detail={`${exceptionSummary.critical} critical · ${exceptionSummary.high} high`} tone={exceptionSummary.total?'attention':'complete'} />
      <ProductMetric label="Overdue / blocked" value={exceptionSummary.overdue + exceptionSummary.blocked} detail="Already outside plan" tone={exceptionSummary.overdue + exceptionSummary.blocked?'blocked':'complete'} />
      <ProductMetric label="Active projects" value={dashboard.activeProjects} detail="Current delivery workload" tone={dashboard.activeProjects?'active':'neutral'} />
    </ProductMetrics>

    <div className="product-split">
      <section className="product-stack">
        <section className="product-panel">
          <ProductSectionHeader eyebrow="Waiting on" title="Dependencies" />
          <div className="saas-signal-list">
            <div className="saas-signal"><span>Your team</span><strong>{attention.waitingOnInternal}</strong></div>
            <div className="saas-signal"><span>Execution Partner</span><strong>{attention.waitingOnPartner}</strong></div>
            <div className="saas-signal"><span>Client</span><strong>{attention.waitingOnClient}</strong></div>
          </div>
        </section>
        <section className="product-panel">
          <ProductSectionHeader eyebrow="Issues" title="Operating health" />
          <div className="saas-signal-list">
            <div className="saas-signal"><span>Critical</span><strong>{exceptionSummary.critical}</strong></div>
            <div className="saas-signal"><span>Overdue</span><strong>{exceptionSummary.overdue}</strong></div>
            <div className="saas-signal"><span>Blocked</span><strong>{exceptionSummary.blocked}</strong></div>
          </div>
        </section>
      </section>

      <section className="product-stack">
        <section>
          <ProductSectionHeader eyebrow="Priority queue" title="Decisions waiting" meta={`${attention.items.length} open`} />
          {businessActions.length ? <ProductRegister>
            {businessActions.map((item,index)=><ProductRegisterRow href={item.href} key={`${item.id}-${item.title}`}>
              <ProductStatus tone={item.priority==='high'?'attention':'waiting'}>{String(index+1).padStart(2,'0')}</ProductStatus>
              <div><strong>{item.title}</strong><p>{item.company} · {item.reason}</p></div>
              <div><small>Waiting</small><strong style={{display:'block',marginTop:3}}>{formatWaitingMinutes(item.waitingMinutes)}</strong></div>
              <strong>Open →</strong>
            </ProductRegisterRow>)}
          </ProductRegister> : <ProductEmptyState title="No decisions waiting" description="The queue will repopulate when a decision or external response is due." />}
        </section>

        <section>
          <ProductSectionHeader eyebrow="Issues" title="Off-plan work" meta={<Link href="/workspace/exceptions">View all {exceptionSummary.total} →</Link>} />
          {exceptionActions.length ? <ProductRegister>
            {exceptionActions.map(item=><ProductRegisterRow href={item.href} key={item.id}>
              <ProductStatus tone={item.severity==='critical'?'critical':item.severity==='high'?'blocked':'attention'}>{item.severity}</ProductStatus>
              <div><strong>{item.title}</strong><p>{item.relatedLabel} · {item.detail}</p></div>
              <div><small>Owner</small><strong style={{display:'block',marginTop:3}}>{item.owner}</strong></div>
              <strong>Open →</strong>
            </ProductRegisterRow>)}
          </ProductRegister> : <ProductEmptyState title="No issues" description="Delivery, finance and actions are currently within plan." />}
        </section>
      </section>
    </div>
  </section>;
}
