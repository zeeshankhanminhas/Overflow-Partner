import './mission-control-v2.css';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { formatWaitingMinutes, resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';
import { buildMissionPriorityQueue, summariseMissionPriorityQueue } from '@/lib/dashboard/priorityQueue';
import { summariseExceptions } from '@/lib/operations/exceptions';
import { summariseApprovalQueue } from '@/lib/presentation/approvals';
import { getWorkspaceChromeData } from '@/lib/workspace/request-data';
import { OperatingState, SignalStrip, WaitingOnPanel, WorkQueue, type WorkQueueItem } from '@/components/workspace/OperationalUI';
import MobileMissionControl from '@/components/workspace/MobileMissionControl';

function priorityAction(kind:'issue'|'approval'|'dependency'){return kind==='issue'?'Resolve':kind==='approval'?'Review':'Open'}
function priorityConsequence(kind:'issue'|'approval'|'dependency'){
  if(kind==='issue')return 'Resolve the exception so delivery or commercial control can recover.';
  if(kind==='approval')return 'The owning record can progress once the decision is recorded.';
  return 'The blocked work can continue when this dependency is resolved.';
}

export default async function WorkspacePage(){
  const {supabase,organisationId}=await requireUserContext();
  const [dashboard,pendingPartnerResult,companyReviewResult,chrome]=await Promise.all([
    getDashboardSnapshot(supabase,organisationId),
    supabase.from('partner_review_requests').select('id,prospect_id,status,created_at,sent_at,submitted_at,response_due_at,partner:partners(company_name),prospect:prospects(company_name)').eq('organisation_id',organisationId).not('prospect_id','is',null).in('status',['invited','opened','in_progress','clarification_required']).order('created_at',{ascending:false}),
    supabase.from('companies').select('id,name,next_account_review_at').eq('organisation_id',organisationId).neq('lifecycle_status','archived').not('next_account_review_at','is',null).lte('next_account_review_at',new Date().toISOString()).order('next_account_review_at',{ascending:true}).limit(20),
    getWorkspaceChromeData(),
  ]);
  const operationalExceptions=chrome.exceptions;
  const approvals=chrome.approvals;

  const partnerRows=(pendingPartnerResult.data||[]) as any[];
  const companyReviewAttention:AttentionSource[]=((companyReviewResult.data||[]) as any[]).map(row=>({id:`company-review-${row.id}`,title:'Review client account',company:row.name,reason:`Account review due ${new Date(row.next_account_review_at).toLocaleDateString('en-GB')}`,waitingSince:row.next_account_review_at,priority:'normal',href:`/workspace/companies/${row.id}`,stage:'prospect'}));
  const prospectIds=new Set(partnerRows.map(row=>String(row.prospect_id)));
  const partnerAttention:AttentionSource[]=partnerRows.map(row=>{
    const clarification=row.status==='clarification_required';
    return {id:`partner-${row.id}`,title:clarification?'Delivery partner needs clarification':'Waiting for delivery partner',company:row.prospect?.company_name||'Opportunity',reason:clarification?'More information is holding up the next step':`${row.partner?.company_name||'Delivery Partner'} · due ${new Date(row.response_due_at).toLocaleDateString('en-GB')}`,waitingSince:row.submitted_at||row.sent_at||row.created_at,priority:clarification?'high':'normal',href:`/workspace/acquisition/${row.prospect_id}`,stage:clarification?'prospect':'partner'};
  });

  const canonicalBase:AttentionSource[]=dashboard.cases
    .filter(item=>item.stage!=='project'||['waiting','review'].includes(item.status))
    .filter(item=>!prospectIds.has(String(item.id)))
    .map(item=>({id:item.id,title:item.nextAction,company:item.company,reason:item.deadline?`Deadline ${item.deadline}`:`${item.stageLabel} · ${item.status.replaceAll('_',' ')}`,waitingSince:item.waitingSince,priority:item.priority,href:item.href,stage:item.stage}));
  const attention=resolveBusinessAttention([...companyReviewAttention,...partnerAttention,...canonicalBase]);
  const approvalSummary=summariseApprovalQueue(approvals);
  const exceptionSummary=summariseExceptions(operationalExceptions);
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
  const nextQueue:WorkQueueItem[]=priorityQueue.slice(1,6).map(item=>({
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
      waitingInternal={attention.waitingOnInternal}
      waitingPartner={attention.waitingOnPartner}
      waitingClient={attention.waitingOnClient}
      primary={{title:primaryTitle,reason:primaryReason,owner:primaryOwner,detail:primaryDetail,status:topPriority?`${topPriority.tier} priority`:'Controlled',href:primaryHref,actionLabel:primaryLabel}}
      queue={nextQueue}
    />

    <section className="mission-v2 mission-v2--desktop">
      <header className="mission-v2__header"><div><p className="op-ui-eyebrow">Mission Control</p><h1>What needs your attention</h1><p>A ranked operating queue for decisions, dependencies and delivery issues. Highest business consequence comes first.</p></div></header>

      <SignalStrip items={[
        {label:'Priority attention',value:prioritySummary.p1+prioritySummary.p2,detail:`${prioritySummary.p1} P1 · ${prioritySummary.p2} P2`,tone:prioritySummary.p1?'critical':prioritySummary.p2?'attention':'neutral'},
        {label:'Ready decisions',value:approvalSummary.ready,detail:`${approvalSummary.blocked} waiting for information`,tone:approvalSummary.ready?'waiting':'neutral'},
        {label:'Dependencies',value:attention.items.length,detail:`${attention.waitingOnPartner+attention.waitingOnClient} external · ${attention.overdue} aged`,tone:attention.items.length?'attention':'neutral'},
        {label:'Delivery issues',value:exceptionSummary.total,detail:`${exceptionSummary.critical} critical · ${exceptionSummary.high} high`,tone:exceptionSummary.critical?'critical':exceptionSummary.total?'attention':'neutral'},
      ]}/>

      <OperatingState title={primaryTitle} record={primaryRecord} reason={primaryReason} owner={primaryOwner} ownerDetail={primaryDetail} status={topPriority?`${topPriority.tier} priority`:'Controlled'} tone={topPriority?.tone||'active'} nextAction={primaryLabel} href={primaryHref} consequence={consequence}/>

      <div className="mission-v2__workgrid">
        <main className="mission-v2__main">
          <WorkQueue eyebrow="Prioritised work" title="Other open work" items={nextQueue} empty="No other priority items are waiting." viewAllHref="/workspace/attention" viewAllLabel="View all attention"/>
        </main>

        <div className="mission-v2__rail">
          <WaitingOnPanel internal={attention.waitingOnInternal} partner={attention.waitingOnPartner} client={attention.waitingOnClient}/>
        </div>
      </div>

    </section>
  </>;
}
