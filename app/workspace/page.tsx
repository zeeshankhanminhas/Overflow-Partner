import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { formatWaitingMinutes, resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';
import { buildMissionPriorityQueue, summariseMissionPriorityQueue } from '@/lib/dashboard/priorityQueue';
import { getOperationalExceptions, summariseExceptions } from '@/lib/operations/exceptions';
import { getApprovalQueue, summariseApprovalQueue } from '@/lib/presentation/approvals';
import { ContextActions, InteractionFact, InteractionFacts, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { NextActionRail, OperatingState, SignalStrip, WaitingOnPanel, WorkQueue, type WorkQueueItem } from '@/components/workspace/OperationalUI';
import MobileMissionControl from '@/components/workspace/MobileMissionControl';

function money(value:number){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value)}
function approvalSource(source:string){return source==='acquisition'?'Opportunity':source==='commercial'?'Commercial review':source==='document'?'Document':'Payment'}
function dependencyOwner(item:{stage:string;title:string;reason:string}){
  if(item.stage==='partner')return 'Delivery Partner';
  if(item.stage==='quote')return 'Client';
  const text=`${item.title} ${item.reason}`.toLowerCase();
  if(text.includes('client')||text.includes('customer')||text.includes('intake'))return 'Client';
  return 'Your team';
}
function priorityAction(kind:'issue'|'approval'|'dependency'){return kind==='issue'?'Resolve':kind==='approval'?'Review':'Open'}
function priorityConsequence(kind:'issue'|'approval'|'dependency'){
  if(kind==='issue')return 'Resolve the exception so delivery or commercial control can recover.';
  if(kind==='approval')return 'The owning record can progress once the decision is recorded.';
  return 'The blocked work can continue when this dependency is resolved.';
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

  const canonicalBase:AttentionSource[]=dashboard.cases
    .filter(item=>item.stage!=='project'||['waiting','review'].includes(item.status))
    .filter(item=>!prospectIds.has(String(item.id)))
    .map(item=>({id:item.id,title:item.nextAction,company:item.company,reason:item.deadline?`Deadline ${item.deadline}`:`${item.stageLabel} · ${item.status.replaceAll('_',' ')}`,waitingSince:item.waitingSince,priority:item.priority,href:item.href,stage:item.stage}));
  const attention=resolveBusinessAttention([...partnerAttention,...canonicalBase]);
  const approvalSummary=summariseApprovalQueue(approvals);
  const exceptionSummary=summariseExceptions(operationalExceptions);
  const readyApprovals=approvals.filter(item=>item.status==='ready');
  const dependencies=attention.items;
  const issues=operationalExceptions;
  const priorityQueue=buildMissionPriorityQueue({approvals,dependencies,issues});
  const prioritySummary=summariseMissionPriorityQueue(priorityQueue);
  const topPriority=priorityQueue[0];

  const primaryHref=topPriority?.href||'/workspace/projects';
  const primaryLabel=topPriority?priorityAction(topPriority.kind):'Open active projects';
  const primaryTitle=topPriority?.title||'No immediate action required';
  const primaryRecord=topPriority?`${topPriority.tier} · ${topPriority.label}`:'All priority queues are controlled';
  const primaryReason=topPriority?.detail||'There are no decisions, dependencies or delivery issues requiring immediate intervention.';
  const primaryOwner=topPriority?.owner||'Your team';
  const primaryDetail=topPriority?`${topPriority.meta} · ${formatWaitingMinutes(topPriority.ageMinutes)}`:'Continue monitoring active work.';
  const consequence=topPriority?priorityConsequence(topPriority.kind):'Open active delivery work.';

  const approvalItems:WorkQueueItem[]=readyApprovals.slice(0,4).map(item=>({
    id:item.id,label:'Ready',title:item.title,detail:`${item.type} · ${item.recordLabel}`,meta:item.value!==undefined?money(item.value):approvalSource(item.source),owner:'Your team',href:item.href,tone:'waiting',actionLabel:'Review',
    inspect:<ContextActions label={`Inspect ${item.title}`}><WorkspaceDrawer triggerLabel="Inspect" eyebrow="Decision context" title={item.title} description={item.reason} footer={<Link className="button" href={item.href}>Open decision</Link>}><InteractionFacts><InteractionFact label="Decision">{item.type}</InteractionFact><InteractionFact label="Record">{item.recordLabel}</InteractionFact><InteractionFact label="Source">{approvalSource(item.source)}</InteractionFact><InteractionFact label="Value">{item.value!==undefined?money(item.value):'Not value-based'}</InteractionFact></InteractionFacts></WorkspaceDrawer></ContextActions>
  }));

  const dependencyItems:WorkQueueItem[]=dependencies.slice(0,4).map(item=>({
    id:`${item.id}-${item.title}`,label:item.overdue?'Aged':dependencyOwner(item),title:item.company,detail:`${item.title} · ${item.reason}`,meta:formatWaitingMinutes(item.waitingMinutes),owner:dependencyOwner(item),href:item.href,tone:item.priority==='high'||item.overdue?'attention':'neutral',actionLabel:'Open',
    inspect:<ContextActions label={`Inspect ${item.company}`}><WorkspaceDrawer triggerLabel="Inspect" eyebrow="Dependency" title={item.title} description={item.reason} footer={<Link className="button" href={item.href}>Open record</Link>}><InteractionFacts><InteractionFact label="Record">{item.company}</InteractionFact><InteractionFact label="Waiting on">{dependencyOwner(item)}</InteractionFact><InteractionFact label="Waiting">{formatWaitingMinutes(item.waitingMinutes)}</InteractionFact><InteractionFact label="Priority">{item.priority}</InteractionFact></InteractionFacts></WorkspaceDrawer></ContextActions>
  }));

  const issueItems:WorkQueueItem[]=issues.slice(0,4).map(item=>({id:item.id,label:item.severity,title:item.title,detail:item.detail,meta:item.category,owner:item.owner,href:item.href,tone:item.severity==='critical'?'critical':item.severity==='high'?'attention':'neutral',actionLabel:'Resolve'}));

  const nextQueue:WorkQueueItem[]=priorityQueue.slice(0,6).map(item=>({
    id:item.id,
    label:`${item.tier} · ${item.label}`,
    title:item.title,
    detail:item.detail,
    meta:`${item.meta} · ${formatWaitingMinutes(item.ageMinutes)}`,
    owner:item.owner,
    href:item.href,
    tone:item.tone,
    actionLabel:priorityAction(item.kind),
  }));

  const mobileQueue=priorityQueue.slice(0,6).map(item=>({
    id:item.id,
    label:`${item.tier} · ${item.label}`,
    title:item.title,
    detail:item.detail,
    meta:`${item.meta} · ${formatWaitingMinutes(item.ageMinutes)}`,
    owner:item.owner,
    href:item.href,
    tone:item.tone,
    actionLabel:priorityAction(item.kind),
  }));

  return <>
    <MobileMissionControl
      priorityAttention={prioritySummary.p1+prioritySummary.p2}
      p1={prioritySummary.p1}
      p2={prioritySummary.p2}
      readyDecisions={approvalSummary.ready}
      blockedDecisions={approvalSummary.blocked}
      dependencies={attention.items.length}
      externalDependencies={attention.waitingOnPartner+attention.waitingOnClient}
      agedDependencies={attention.overdue}
      deliveryIssues={exceptionSummary.total}
      criticalIssues={exceptionSummary.critical}
      highIssues={exceptionSummary.high}
      waitingInternal={attention.waitingOnInternal}
      waitingPartner={attention.waitingOnPartner}
      waitingClient={attention.waitingOnClient}
      primary={{title:primaryTitle,record:primaryRecord,reason:primaryReason,owner:primaryOwner,detail:primaryDetail,status:topPriority?`${topPriority.tier} priority`:'Controlled',href:primaryHref,actionLabel:primaryLabel}}
      queue={mobileQueue}
    />

    <section className="mission-v2 mission-v2--desktop">
      <header className="mission-v2__header"><div><p className="op-ui-eyebrow">Mission Control</p><h1>What needs your attention</h1><p>A ranked operating queue for decisions, dependencies and delivery issues. Highest business consequence comes first.</p></div><div className="mission-v2__header-actions"><Link className="button" href="/workspace/attention">View all attention</Link><Link className="button secondary" href="/workspace/projects">Projects</Link><Link className="button secondary" href="/workspace/acquisition">Opportunities</Link></div></header>

      <SignalStrip items={[
        {label:'Priority attention',value:prioritySummary.p1+prioritySummary.p2,detail:`${prioritySummary.p1} P1 · ${prioritySummary.p2} P2`,tone:prioritySummary.p1?'critical':prioritySummary.p2?'attention':'neutral'},
        {label:'Ready decisions',value:approvalSummary.ready,detail:`${approvalSummary.blocked} waiting for information`,tone:approvalSummary.ready?'waiting':'neutral'},
        {label:'Dependencies',value:attention.items.length,detail:`${attention.waitingOnPartner+attention.waitingOnClient} external · ${attention.overdue} aged`,tone:attention.items.length?'attention':'neutral'},
        {label:'Delivery issues',value:exceptionSummary.total,detail:`${exceptionSummary.critical} critical · ${exceptionSummary.high} high`,tone:exceptionSummary.critical?'critical':exceptionSummary.total?'attention':'neutral'},
      ]}/>

      <OperatingState title={primaryTitle} record={primaryRecord} reason={primaryReason} owner={primaryOwner} ownerDetail={primaryDetail} status={topPriority?`${topPriority.tier} priority`:'Controlled'} tone={topPriority?.tone||'active'} nextAction={primaryLabel} href={primaryHref} consequence={consequence}/>

      <div className="mission-v2__workgrid">
        <main className="mission-v2__main">
          <WorkQueue eyebrow="Priority queue" title="Next up" items={nextQueue} empty="No immediate actions are waiting. Open active projects to continue planned work." viewAllHref="/workspace/attention" viewAllLabel="View all attention"/>
          <div className="mission-v2__queues">
            <WorkQueue title="Approvals" items={approvalItems} empty="No approvals are ready for decision." viewAllHref="/workspace/approvals"/>
            <WorkQueue title="Waiting / blocked" items={dependencyItems} empty="No external or internal dependencies are waiting." viewAllHref="/workspace/attention" viewAllLabel="View all"/>
            <WorkQueue title="Issues" items={issueItems} empty="No delivery issues need attention." viewAllHref="/workspace/exceptions"/>
          </div>
        </main>

        <div className="mission-v2__rail">
          <NextActionRail actionLabel={primaryLabel} href={primaryHref} reason={primaryReason} owner={primaryOwner} deadline={topPriority?formatWaitingMinutes(topPriority.ageMinutes):undefined} consequence={consequence} secondary={[{label:'View all attention',href:'/workspace/attention'},{label:'Review approvals',href:'/workspace/approvals'},{label:'Open projects',href:'/workspace/projects'}]}/>
          <WaitingOnPanel internal={attention.waitingOnInternal} partner={attention.waitingOnPartner} client={attention.waitingOnClient}/>
        </div>
      </div>

      <footer className="mission-v2__management"><span>Management context</span><Link href="/workspace/payments">Commercials →</Link><Link href="/workspace/documents">Documents →</Link><Link href="/workspace/partners">Delivery partners →</Link></footer>
    </section>
  </>;
}
