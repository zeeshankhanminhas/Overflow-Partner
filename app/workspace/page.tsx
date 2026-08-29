import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { formatWaitingMinutes, resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';
import { getOperationalExceptions, summariseExceptions } from '@/lib/operations/exceptions';
import { getApprovalQueue, summariseApprovalQueue } from '@/lib/presentation/approvals';
import { ContextActions, InteractionFact, InteractionFacts, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';

function money(value:number){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value)}
function approvalSource(source:string){return source==='acquisition'?'Opportunity':source==='commercial'?'Commercial review':source==='document'?'Document':'Payment'}
function dependencyOwner(item:{stage:string;title:string;reason:string}){
  if(item.stage==='partner')return 'Delivery Partner';
  if(item.stage==='quote')return 'Client';
  const text=`${item.title} ${item.reason}`.toLowerCase();
  if(text.includes('client')||text.includes('customer')||text.includes('intake'))return 'Client';
  return 'Your team';
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
      title:clarification?'Delivery partner needs clarification':'Waiting for delivery partner',
      company:row.prospect?.company_name||'Opportunity',
      reason:clarification?'More information is holding up the next step':`${row.partner?.company_name||'Delivery Partner'} · due ${new Date(row.response_due_at).toLocaleDateString('en-GB')}`,
      waitingSince:row.submitted_at||row.sent_at||row.created_at,
      priority:clarification?'high':'normal',
      href:`/workspace/acquisition/${row.prospect_id}`,
      stage:clarification?'prospect':'partner',
    };
  });

  const canonicalBase=dashboard.attention.filter(item=>!prospectIds.has(String(item.id)));
  const attention=resolveBusinessAttention([...partnerAttention,...canonicalBase]);
  const approvalSummary=summariseApprovalQueue(approvals);
  const exceptionSummary=summariseExceptions(operationalExceptions);
  const dependencies=attention.items.slice(0,5);
  const readyApprovals=approvals.filter(item=>item.status==='ready').slice(0,5);
  const exceptionActions=operationalExceptions.slice(0,5);
  const nextApproval=readyApprovals[0];
  const nextDependency=dependencies[0];
  const nextIssue=exceptionActions[0];
  const primaryHref=nextApproval?.href||nextDependency?.href||nextIssue?.href||'/workspace/projects';
  const primaryLabel=nextApproval?'Review approval':nextDependency?'Open dependency':nextIssue?'Resolve issue':'Open active projects';
  const currentTitle=nextApproval?.type||nextDependency?.title||nextIssue?.title||'No immediate action required';
  const currentRecord=nextApproval?.title||nextDependency?.company||nextIssue?.relatedLabel||'All priority queues are controlled';
  const currentReason=nextApproval?.reason||nextDependency?.reason||nextIssue?.detail||'The workspace will surface the next decision, dependency or issue when one becomes active.';

  return <section className="mission-command workspace-reference-workspace">
    <header className="mission-command__header">
      <div className="mission-command__header-copy">
        <p className="mission-command__eyebrow">Workspace</p>
        <h1>Priority work</h1>
        <p className="mission-command__subtitle">What needs attention now across opportunities, approvals, projects and delivery issues.</p>
      </div>
      <div className="mission-command__header-actions">
        <Link className="button secondary" href="/workspace/approvals">Approvals</Link>
        <Link className="button secondary" href="/workspace/exceptions">Issues</Link>
      </div>
    </header>

    <section className="mission-command__signals" aria-label="Workspace signals">
      <div className="mission-command__signal"><small>Approvals</small><strong>{approvalSummary.ready}</strong><span>{approvalSummary.blocked} waiting for information</span></div>
      <div className="mission-command__signal"><small>Dependencies</small><strong>{attention.items.length}</strong><span>{attention.waitingOnPartner+attention.waitingOnClient} external</span></div>
      <div className="mission-command__signal"><small>Issues</small><strong>{exceptionSummary.total}</strong><span>{exceptionSummary.critical} critical · {exceptionSummary.high} high</span></div>
      <div className="mission-command__signal"><small>Active projects</small><strong>{dashboard.activeProjects}</strong><span>Current delivery workload</span></div>
    </section>

    <div className="mission-command__grid">
      <main className="mission-command__main">
        <section className="mission-card">
          <header className="mission-card__header"><strong>Priority focus</strong><small>Live workspace state</small></header>
          <div className="mission-summary">
            <div className="mission-summary__cell"><small>What needs attention</small><strong>{currentTitle}</strong><p>{currentRecord}</p></div>
            <div className="mission-summary__cell"><small>Why now</small><strong>{nextApproval?'Evidence is ready for a decision':nextDependency?'A dependency is holding progress':nextIssue?'An issue is affecting planned work':'No priority queue is overdue'}</strong><p>{currentReason}</p></div>
            <div className="mission-summary__cell"><small>Owner</small><strong>{nextApproval?'Your team':nextDependency?dependencyOwner(nextDependency):nextIssue?nextIssue.owner:'Your team'}</strong><p>{nextApproval?.value!==undefined?`${approvalSource(nextApproval.source)} · ${money(nextApproval.value)}`:nextDependency?`Waiting ${formatWaitingMinutes(nextDependency.waitingMinutes)}`:nextIssue?`${nextIssue.severity} · ${nextIssue.category}`:'Continue monitoring active work.'}</p></div>
            <div className="mission-summary__cell"><small>Next action</small><strong>{primaryLabel}</strong><p>Open the source record for the full context before acting.</p><Link href={primaryHref}>Open next action →</Link></div>
          </div>
        </section>

        <section className="mission-card">
          <header className="mission-card__header"><strong>Approvals</strong><Link href="/workspace/approvals">View all {approvalSummary.total} →</Link></header>
          {readyApprovals.length?<div className="mission-list">{readyApprovals.map(item=><div className="mission-list__row" key={item.id}>
            <span className="mission-pill mission-pill--ready">Ready</span><div><strong>{item.type}</strong><p>{item.title} · {item.recordLabel}</p></div><span className="mission-list__meta">{approvalSource(item.source)}</span>
            <ContextActions label={`Actions for ${item.title}`}><WorkspaceDrawer triggerLabel="Inspect" eyebrow="Decision context" title={item.title} description={item.reason} footer={<Link className="button" href={item.href}>Open decision</Link>}><InteractionFacts><InteractionFact label="Decision">{item.type}</InteractionFact><InteractionFact label="Record">{item.recordLabel}</InteractionFact><InteractionFact label="Source">{approvalSource(item.source)}</InteractionFact><InteractionFact label="Value">{item.value!==undefined?money(item.value):'Not value-based'}</InteractionFact></InteractionFacts></WorkspaceDrawer><Link className="button secondary" href={item.href}>Open</Link></ContextActions>
          </div>)}</div>:<div className="mission-compact"><p>No approvals are ready for decision.</p></div>}
        </section>

        <section className="mission-card">
          <header className="mission-card__header"><strong>Dependencies</strong><small>{attention.items.length} open</small></header>
          {dependencies.length?<div className="mission-list">{dependencies.map(item=><div className="mission-list__row" key={`${item.id}-${item.title}`}>
            <span className={`mission-pill ${item.priority==='high'?'mission-pill--attention':''}`}>{dependencyOwner(item)}</span><div><strong>{item.title}</strong><p>{item.company} · {item.reason}</p></div><span className="mission-list__meta">{formatWaitingMinutes(item.waitingMinutes)}</span>
            <ContextActions label={`Actions for ${item.company}`}><WorkspaceDrawer triggerLabel="Inspect" eyebrow="Dependency" title={item.title} description={item.reason} footer={<Link className="button" href={item.href}>Open record</Link>}><InteractionFacts><InteractionFact label="Record">{item.company}</InteractionFact><InteractionFact label="Waiting on">{dependencyOwner(item)}</InteractionFact><InteractionFact label="Waiting">{formatWaitingMinutes(item.waitingMinutes)}</InteractionFact><InteractionFact label="Priority">{item.priority}</InteractionFact></InteractionFacts></WorkspaceDrawer><Link className="button secondary" href={item.href}>Open</Link></ContextActions>
          </div>)}</div>:<div className="mission-compact"><p>No dependencies are waiting.</p></div>}
        </section>
      </main>

      <aside className="mission-command__rail" aria-label="Next actions">
        <section className="mission-card"><header className="mission-card__header"><strong>Next action</strong><small>What to do now</small></header><div className="mission-actions"><Link className="button" href={primaryHref}>{primaryLabel}</Link><Link className="button secondary" href="/workspace/approvals">Review approvals</Link><Link className="button secondary" href="/workspace/exceptions">Open issues</Link><Link className="button secondary" href="/workspace/projects">Open projects</Link></div><div className="mission-actions__label">Related work</div><div className="mission-actions"><Link className="mission-actions__link" href="/workspace/documents"><span>Documents</span><span>→</span></Link><Link className="mission-actions__link" href="/workspace/payments"><span>Finance</span><span>→</span></Link><Link className="mission-actions__link" href="/workspace/partners"><span>Delivery partners</span><span>→</span></Link></div></section>
        <section className="mission-card"><header className="mission-card__header"><strong>Waiting on</strong><small>Ownership</small></header><div className="mission-ownership"><div className="mission-ownership__row"><span>Your team</span><strong>{attention.waitingOnInternal}</strong></div><div className="mission-ownership__row"><span>Delivery Partner</span><strong>{attention.waitingOnPartner}</strong></div><div className="mission-ownership__row"><span>Client</span><strong>{attention.waitingOnClient}</strong></div></div></section>
      </aside>
    </div>

    <section className="mission-command__lower">
      <article className="mission-card"><header className="mission-card__header"><strong>Off-plan work</strong><Link href="/workspace/exceptions">View all {exceptionSummary.total} →</Link></header><div className="mission-compact">{exceptionActions.length?exceptionActions.slice(0,4).map(item=><div className="mission-compact__line" key={item.id}><span>{item.title}</span><em>{item.severity}</em></div>):<p>No off-plan work.</p>}</div></article>
      <article className="mission-card"><header className="mission-card__header"><strong>Queue health</strong><small>Current workload</small></header><div className="mission-compact"><div className="mission-compact__line"><span>Ready decisions</span><em>{approvalSummary.ready}</em></div><div className="mission-compact__line"><span>Waiting for information</span><em>{approvalSummary.blocked}</em></div><div className="mission-compact__line"><span>Dependencies</span><em>{attention.items.length}</em></div><div className="mission-compact__line"><span>Active projects</span><em>{dashboard.activeProjects}</em></div></div></article>
      <article className="mission-card"><header className="mission-card__header"><strong>Commercial attention</strong><small>Decision value</small></header><div className="mission-compact"><div className="mission-compact__line"><span>Value awaiting approval</span><em>{money(approvalSummary.value)}</em></div><div className="mission-compact__line"><span>Critical issues</span><em>{exceptionSummary.critical}</em></div><div className="mission-compact__line"><span>High issues</span><em>{exceptionSummary.high}</em></div><div className="mission-compact__line"><span>External dependencies</span><em>{attention.waitingOnPartner+attention.waitingOnClient}</em></div></div></article>
    </section>
  </section>;
}
