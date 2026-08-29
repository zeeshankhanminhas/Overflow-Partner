import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { formatWaitingMinutes, resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';
import { getOperationalExceptions, summariseExceptions } from '@/lib/operations/exceptions';
import { getApprovalQueue, summariseApprovalQueue } from '@/lib/presentation/approvals';
import { ContextActions, InteractionFact, InteractionFacts, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { NextActionRail, OperatingState, SignalStrip, WaitingOnPanel, WorkQueue, type WorkQueueItem } from '@/components/workspace/OperationalUI';

function money(value:number){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value)}
function approvalSource(source:string){return source==='acquisition'?'Opportunity':source==='commercial'?'Commercial review':source==='document'?'Document':'Payment'}
function dependencyOwner(item:{stage:string;title:string;reason:string}){
  if(item.stage==='partner')return 'Delivery Partner';
  if(item.stage==='quote')return 'Client';
  const text=`${item.title} ${item.reason}`.toLowerCase();
  if(text.includes('client')||text.includes('customer')||text.includes('intake'))return 'Client';
  return 'Your team';
}

export default async function WorkspacePage(){
  const {supabase,organisationId}=await requireUserContext();
  const [dashboard,pendingPartnerResult,operationalExceptions,approvals]=await Promise.all([
    getDashboardSnapshot(supabase,organisationId),
    supabase.from('partner_review_requests').select('id,prospect_id,status,created_at,sent_at,submitted_at,response_due_at,partner:partners(company_name),prospect:prospects(company_name)').eq('organisation_id',organisationId).not('prospect_id','is',null).in('status',['invited','opened','in_progress','clarification_required']).order('created_at',{ascending:false}),
    getOperationalExceptions(supabase,organisationId),
    getApprovalQueue(supabase,organisationId),
  ]);

  const partnerRows=(pendingPartnerResult.data||[]) as any[];
  const prospectIds=new Set(partnerRows.map(row=>String(row.prospect_id)));
  const partnerAttention:AttentionSource[]=partnerRows.map(row=>{
    const clarification=row.status==='clarification_required';
    return {id:`partner-${row.id}`,title:clarification?'Delivery partner needs clarification':'Waiting for delivery partner',company:row.prospect?.company_name||'Opportunity',reason:clarification?'More information is holding up the next step':`${row.partner?.company_name||'Delivery Partner'} · due ${new Date(row.response_due_at).toLocaleDateString('en-GB')}`,waitingSince:row.submitted_at||row.sent_at||row.created_at,priority:clarification?'high':'normal',href:`/workspace/acquisition/${row.prospect_id}`,stage:clarification?'prospect':'partner'};
  });

  const canonicalBase=dashboard.attention.filter(item=>!prospectIds.has(String(item.id)));
  const attention=resolveBusinessAttention([...partnerAttention,...canonicalBase]);
  const approvalSummary=summariseApprovalQueue(approvals);
  const exceptionSummary=summariseExceptions(operationalExceptions);
  const readyApprovals=approvals.filter(item=>item.status==='ready');
  const dependencies=attention.items;
  const issues=operationalExceptions;

  const nextApproval=readyApprovals[0];
  const nextDependency=dependencies[0];
  const nextIssue=issues[0];
  const primaryHref=nextApproval?.href||nextDependency?.href||nextIssue?.href||'/workspace/projects';
  const primaryLabel=nextApproval?'Review approval':nextDependency?'Resolve dependency':nextIssue?'Resolve issue':'Open active projects';
  const primaryTitle=nextApproval?.type||nextDependency?.title||nextIssue?.title||'No immediate action required';
  const primaryRecord=nextApproval?.title||nextDependency?.company||nextIssue?.relatedLabel||'All priority queues are controlled';
  const primaryReason=nextApproval?.reason||nextDependency?.reason||nextIssue?.detail||'There are no decisions, dependencies or delivery issues requiring immediate intervention.';
  const primaryOwner=nextApproval?'Your team':nextDependency?dependencyOwner(nextDependency):nextIssue?nextIssue.owner:'Your team';
  const primaryDetail=nextApproval?.value!==undefined?`${approvalSource(nextApproval.source)} · ${money(nextApproval.value)}`:nextDependency?`Waiting ${formatWaitingMinutes(nextDependency.waitingMinutes)}`:nextIssue?`${nextIssue.severity} · ${nextIssue.category}`:'Continue monitoring active work.';
  const consequence=nextApproval?'The owning record can progress after the decision.':nextDependency?'The blocked work can continue when this dependency is resolved.':nextIssue?'Planned delivery can return to control once the issue is resolved.':'Open active delivery work.';

  const approvalItems:WorkQueueItem[]=readyApprovals.slice(0,4).map(item=>({
    id:item.id,label:'Ready',title:item.title,detail:`${item.type} · ${item.recordLabel}`,meta:item.value!==undefined?money(item.value):approvalSource(item.source),owner:'Your team',href:item.href,tone:'waiting',actionLabel:'Review',
    inspect:<ContextActions label={`Inspect ${item.title}`}><WorkspaceDrawer triggerLabel="Inspect" eyebrow="Decision context" title={item.title} description={item.reason} footer={<Link className="button" href={item.href}>Open decision</Link>}><InteractionFacts><InteractionFact label="Decision">{item.type}</InteractionFact><InteractionFact label="Record">{item.recordLabel}</InteractionFact><InteractionFact label="Source">{approvalSource(item.source)}</InteractionFact><InteractionFact label="Value">{item.value!==undefined?money(item.value):'Not value-based'}</InteractionFact></InteractionFacts></WorkspaceDrawer></ContextActions>
  }));

  const dependencyItems:WorkQueueItem[]=dependencies.slice(0,4).map(item=>({
    id:`${item.id}-${item.title}`,label:dependencyOwner(item),title:item.company,detail:`${item.title} · ${item.reason}`,meta:formatWaitingMinutes(item.waitingMinutes),owner:dependencyOwner(item),href:item.href,tone:item.priority==='high'?'attention':'neutral',actionLabel:'Open',
    inspect:<ContextActions label={`Inspect ${item.company}`}><WorkspaceDrawer triggerLabel="Inspect" eyebrow="Dependency" title={item.title} description={item.reason} footer={<Link className="button" href={item.href}>Open record</Link>}><InteractionFacts><InteractionFact label="Record">{item.company}</InteractionFact><InteractionFact label="Waiting on">{dependencyOwner(item)}</InteractionFact><InteractionFact label="Waiting">{formatWaitingMinutes(item.waitingMinutes)}</InteractionFact><InteractionFact label="Priority">{item.priority}</InteractionFact></InteractionFacts></WorkspaceDrawer></ContextActions>
  }));

  const issueItems:WorkQueueItem[]=issues.slice(0,4).map(item=>({id:item.id,label:item.severity,title:item.title,detail:item.detail,meta:item.category,owner:item.owner,href:item.href,tone:item.severity==='critical'?'critical':item.severity==='high'?'attention':'neutral',actionLabel:'Resolve'}));

  const nextQueue=[...approvalItems,...dependencyItems,...issueItems].slice(0,6);

  return <section className="mission-v2">
    <header className="mission-v2__header"><div><p className="op-ui-eyebrow">Mission Control</p><h1>What needs your attention</h1><p>One operating view for decisions, dependencies and delivery work that can move now.</p></div><div className="mission-v2__header-actions"><Link className="button secondary" href="/workspace/projects">Projects</Link><Link className="button secondary" href="/workspace/acquisition">Opportunities</Link></div></header>

    <SignalStrip items={[
      {label:'Ready decisions',value:approvalSummary.ready,detail:`${approvalSummary.blocked} waiting for information`,tone:approvalSummary.ready?'waiting':'neutral'},
      {label:'Dependencies',value:attention.items.length,detail:`${attention.waitingOnPartner+attention.waitingOnClient} external`,tone:attention.items.length?'attention':'neutral'},
      {label:'Delivery issues',value:exceptionSummary.total,detail:`${exceptionSummary.critical} critical · ${exceptionSummary.high} high`,tone:exceptionSummary.critical?'critical':exceptionSummary.total?'attention':'neutral'},
      {label:'Active projects',value:dashboard.activeProjects,detail:'Current delivery workload'},
    ]}/>

    <OperatingState title={primaryTitle} record={primaryRecord} reason={primaryReason} owner={primaryOwner} ownerDetail={primaryDetail} status={nextApproval?'Decision ready':nextDependency?'Waiting':nextIssue?'Needs attention':'Controlled'} tone={nextApproval?'waiting':nextIssue?'attention':'active'} nextAction={primaryLabel} href={primaryHref} consequence={consequence}/>

    <div className="mission-v2__workgrid">
      <main className="mission-v2__main">
        <WorkQueue eyebrow="Next up" title="Actions you can move" items={nextQueue} empty="No immediate actions are waiting. Open active projects to continue planned work."/>
        <div className="mission-v2__queues">
          <WorkQueue title="Approvals" items={approvalItems} empty="No approvals are ready for decision." viewAllHref="/workspace/approvals"/>
          <WorkQueue title="Waiting / blocked" items={dependencyItems} empty="No external or internal dependencies are waiting."/>
          <WorkQueue title="Issues" items={issueItems} empty="No delivery issues need attention." viewAllHref="/workspace/exceptions"/>
        </div>
      </main>

      <div className="mission-v2__rail">
        <NextActionRail actionLabel={primaryLabel} href={primaryHref} reason={primaryReason} owner={primaryOwner} deadline={nextDependency?formatWaitingMinutes(nextDependency.waitingMinutes):undefined} consequence={consequence} secondary={[{label:'Review approvals',href:'/workspace/approvals'},{label:'Open projects',href:'/workspace/projects'},{label:'Open documents',href:'/workspace/documents'}]}/>
        <WaitingOnPanel internal={attention.waitingOnInternal} partner={attention.waitingOnPartner} client={attention.waitingOnClient}/>
      </div>
    </div>

    <footer className="mission-v2__management"><span>Management context</span><Link href="/workspace/payments">Commercials →</Link><Link href="/workspace/documents">Documents →</Link><Link href="/workspace/partners">Delivery partners →</Link></footer>
  </section>;
}
