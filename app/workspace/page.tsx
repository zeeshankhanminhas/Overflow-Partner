import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { formatWaitingMinutes, resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';
import { getOperationalExceptions, summariseExceptions } from '@/lib/operations/exceptions';
import { getApprovalQueue, summariseApprovalQueue } from '@/lib/presentation/approvals';
import { ContextActions, InteractionFact, InteractionFacts, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

function money(value:number){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value)}
function approvalSource(source:string){return source==='acquisition'?'Acquisition':source==='commercial'?'Commercial':source==='document'?'Document control':'Payments'}
function dependencyOwner(item:{stage:string;title:string;reason:string}){
  if(item.stage==='partner')return 'Partner';
  if(item.stage==='quote')return 'Client';
  const text=`${item.title} ${item.reason}`.toLowerCase();
  if(text.includes('client')||text.includes('customer')||text.includes('intake'))return 'Client';
  return 'Internal';
}

export default async function WorkspacePage() {
  const { supabase, organisationId } = await requireUserContext();
  const [dashboard,pendingPartnerResult,operationalExceptions,approvals] = await Promise.all([
    getDashboardSnapshot(supabase, organisationId),
    supabase.from('partner_review_requests')
      .select('id,prospect_id,status,created_at,sent_at,submitted_at,response_due_at,partner:partners(company_name),prospect:prospects(company_name)')
      .eq('organisation_id',organisationId)
      .not('prospect_id','is',null)
      .in('status',['invited','opened','in_progress','clarification_required'])
      .order('created_at',{ascending:false}),
    getOperationalExceptions(supabase,organisationId),
    getApprovalQueue(supabase,organisationId),
  ]);
  const partnerRows=(pendingPartnerResult.data||[]) as any[];
  const prospectIds=new Set(partnerRows.map(row=>String(row.prospect_id)));
  const partnerAttention:AttentionSource[]=partnerRows.map(row=>{
    const clarification=row.status==='clarification_required';
    return {
      id:`partner-${row.id}`,
      title:clarification?'Partner needs clarification':'Waiting for Partner',
      company:row.prospect?.company_name||'Enquiry',
      reason:clarification?'More information is holding up the next step':`${row.partner?.company_name||'Execution Partner'} · due ${new Date(row.response_due_at).toLocaleDateString('en-GB')}`,
      waitingSince:row.submitted_at||row.sent_at||row.created_at,
      priority:clarification?'high':'normal',
      href:`/workspace/acquisition/${row.prospect_id}`,
      stage:clarification?'prospect':'partner',
    };
  });
  const canonicalBase=dashboard.attention.filter(item=>!prospectIds.has(String(item.id)));
  const attention = resolveBusinessAttention([...partnerAttention,...canonicalBase]);
  const approvalSummary=summariseApprovalQueue(approvals);
  const exceptionSummary=summariseExceptions(operationalExceptions);
  const dependencies=attention.items.slice(0,5);
  const readyApprovals=approvals.filter(item=>item.status==='ready').slice(0,5);
  const exceptionActions=operationalExceptions.slice(0,5);
  const nextApproval=readyApprovals[0];
  const nextDependency=dependencies[0];

  return <section className="vp-page">
    <ProductPageHeader
      eyebrow="Mission Control"
      title="Operating position"
      description="Separate authority decisions, external dependencies and off-plan work so the next move is always clear."
      actions={<><Link className="button" href="/workspace/approvals">Open approvals</Link><Link className="button secondary" href="/workspace/exceptions">Open issues</Link></>}
    />

    <section className="operating-brief" aria-label="Current operating position">
      <div className="operating-brief__primary">
        <small>{nextApproval?'Next authority decision':nextDependency?'Next dependency':'Current position'}</small>
        {nextApproval ? <>
          <h2>{nextApproval.type}</h2>
          <p><strong>{nextApproval.title}</strong> · {nextApproval.reason}</p>
          <p style={{marginTop:6}}>{approvalSource(nextApproval.source)}{nextApproval.value!==undefined?` · ${money(nextApproval.value)}`:''}</p>
          <Link href={nextApproval.href}>Review →</Link>
        </> : nextDependency ? <>
          <h2>{nextDependency.title}</h2>
          <p><strong>{nextDependency.company}</strong> · {nextDependency.reason}</p>
          <p style={{marginTop:6}}>Waiting {formatWaitingMinutes(nextDependency.waitingMinutes)}</p>
          <Link href={nextDependency.href}>Open →</Link>
        </> : <>
          <h2>Nothing needs intervention right now.</h2>
          <p>The workspace will surface the next authority decision, external dependency or off-plan issue when one becomes active.</p>
        </>}
      </div>
      <div className="operating-brief__signals" aria-label="Operating queues">
        <div className="operating-brief__signal"><small>Approvals</small><strong>{approvalSummary.ready}</strong></div>
        <div className="operating-brief__signal"><small>External dependencies</small><strong>{attention.waitingOnPartner+attention.waitingOnClient}</strong></div>
        <div className="operating-brief__signal"><small>Internal actions</small><strong>{attention.waitingOnInternal}</strong></div>
        <div className="operating-brief__signal"><small>Off-plan</small><strong>{exceptionSummary.total}</strong></div>
      </div>
    </section>

    <ProductMetrics label="Operations summary">
      <ProductMetric label="Approvals ready" value={approvalSummary.ready} detail={`${approvalSummary.blocked} blocked by evidence`} tone={approvalSummary.ready?'waiting':approvalSummary.blocked?'attention':'complete'} />
      <ProductMetric label="Dependencies" value={attention.items.length} detail="Internal, Partner or client waiting states" tone={attention.items.length?'active':'complete'} />
      <ProductMetric label="Issues" value={exceptionSummary.total} detail={`${exceptionSummary.critical} critical · ${exceptionSummary.high} high`} tone={exceptionSummary.total?'attention':'complete'} />
      <ProductMetric label="Active projects" value={dashboard.activeProjects} detail="Current delivery workload" tone={dashboard.activeProjects?'active':'neutral'} />
    </ProductMetrics>

    <div className="product-split">
      <section className="product-stack">
        <section>
          <ProductSectionHeader eyebrow="Authority" title="Approvals" meta={<Link href="/workspace/approvals">View all {approvalSummary.total} →</Link>} />
          {readyApprovals.length ? <ProductRegister>
            {readyApprovals.map(item=><ProductRegisterRow key={item.id}>
              <ProductStatus tone="waiting">Approval</ProductStatus>
              <div><strong>{item.type}</strong><p>{item.title} · {item.recordLabel}</p></div>
              <div><small>Source</small><strong style={{display:'block',marginTop:3}}>{approvalSource(item.source)}</strong></div>
              <ContextActions label={`Actions for ${item.title}`}>
                <WorkspaceDrawer triggerLabel="Inspect" eyebrow="Authority decision" title={item.title} description={item.reason} footer={<Link className="button" href={item.href}>Open authoritative record</Link>}>
                  <InteractionFacts>
                    <InteractionFact label="Decision">{item.type}</InteractionFact>
                    <InteractionFact label="Record">{item.recordLabel}</InteractionFact>
                    <InteractionFact label="Source">{approvalSource(item.source)}</InteractionFact>
                    <InteractionFact label="Value">{item.value!==undefined?money(item.value):'Not value-based'}</InteractionFact>
                  </InteractionFacts>
                  <p className="interaction-summary__lead">Review the evidence here, then open the owning record only when you are ready to perform the governed decision.</p>
                </WorkspaceDrawer>
                <Link className="button secondary" href={item.href}>Open</Link>
              </ContextActions>
            </ProductRegisterRow>)}
          </ProductRegister> : <ProductEmptyState title="No approvals ready" description="Only evidence-complete authority decisions appear here." />}
        </section>

        <section>
          <ProductSectionHeader eyebrow="Waiting on" title="Dependencies" meta={`${attention.items.length} open`} />
          {dependencies.length ? <ProductRegister>
            {dependencies.map(item=><ProductRegisterRow key={`${item.id}-${item.title}`}>
              <ProductStatus tone={item.priority==='high'?'attention':'waiting'}>{dependencyOwner(item)}</ProductStatus>
              <div><strong>{item.title}</strong><p>{item.company} · {item.reason}</p></div>
              <div><small>Waiting</small><strong style={{display:'block',marginTop:3}}>{formatWaitingMinutes(item.waitingMinutes)}</strong></div>
              <ContextActions label={`Actions for ${item.company}`}>
                <WorkspaceDrawer triggerLabel="Inspect" eyebrow="Dependency" title={item.title} description="Inspect the dependency without losing Mission Control." footer={<Link className="button" href={item.href}>Open owning record</Link>}>
                  <InteractionFacts>
                    <InteractionFact label="Record">{item.company}</InteractionFact>
                    <InteractionFact label="Waiting on">{dependencyOwner(item)}</InteractionFact>
                    <InteractionFact label="Waiting">{formatWaitingMinutes(item.waitingMinutes)}</InteractionFact>
                    <InteractionFact label="Priority">{item.priority}</InteractionFact>
                  </InteractionFacts>
                  <p className="interaction-summary__lead">{item.reason}</p>
                </WorkspaceDrawer>
                <Link className="button secondary" href={item.href}>Open</Link>
              </ContextActions>
            </ProductRegisterRow>)}
          </ProductRegister> : <ProductEmptyState title="No dependencies waiting" description="External and internal waiting states will appear here without being mislabelled as blockers." />}
        </section>
      </section>

      <section className="product-stack">
        <section className="product-panel">
          <ProductSectionHeader eyebrow="Waiting on" title="Ownership" />
          <div className="saas-signal-list">
            <div className="saas-signal"><span>Your team</span><strong>{attention.waitingOnInternal}</strong></div>
            <div className="saas-signal"><span>Execution Partner</span><strong>{attention.waitingOnPartner}</strong></div>
            <div className="saas-signal"><span>Client</span><strong>{attention.waitingOnClient}</strong></div>
          </div>
        </section>

        <section>
          <ProductSectionHeader eyebrow="Issues" title="Off-plan work" meta={<Link href="/workspace/exceptions">View all {exceptionSummary.total} →</Link>} />
          {exceptionActions.length ? <ProductRegister>
            {exceptionActions.map(item=><ProductRegisterRow key={item.id}>
              <ProductStatus tone={item.severity==='critical'?'critical':item.severity==='high'?'blocked':'attention'}>{item.severity}</ProductStatus>
              <div><strong>{item.title}</strong><p>{item.relatedLabel} · {item.detail}</p></div>
              <div><small>Owner</small><strong style={{display:'block',marginTop:3}}>{item.owner}</strong></div>
              <ContextActions label={`Actions for ${item.title}`}>
                <WorkspaceDrawer triggerLabel="Inspect" eyebrow="Off-plan work" title={item.title} description={item.detail} footer={<Link className="button" href={item.href}>Open source record</Link>}>
                  <InteractionFacts>
                    <InteractionFact label="Severity">{item.severity}</InteractionFact>
                    <InteractionFact label="Category">{item.category}</InteractionFact>
                    <InteractionFact label="Owner">{item.owner}</InteractionFact>
                    <InteractionFact label="Related record">{item.relatedLabel}</InteractionFact>
                  </InteractionFacts>
                </WorkspaceDrawer>
                <Link className="button secondary" href={item.href}>Open</Link>
              </ContextActions>
            </ProductRegisterRow>)}
          </ProductRegister> : <ProductEmptyState title="No issues" description="Delivery, finance and actions are currently within plan." />}
        </section>
      </section>
    </div>
  </section>;
}
