import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { formatWaitingMinutes, resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';
import { buildMissionPriorityQueue, summariseMissionPriorityQueue } from '@/lib/dashboard/priorityQueue';
import { getOperationalExceptions } from '@/lib/operations/exceptions';
import { getApprovalQueue } from '@/lib/presentation/approvals';
import { SignalStrip, WorkQueue, type WorkQueueItem } from '@/components/workspace/OperationalUI';

function actionLabel(kind:'issue'|'approval'|'dependency'){return kind==='issue'?'Resolve':kind==='approval'?'Review':'Open'}

export default async function AttentionPage(){
  const {supabase,organisationId}=await requireUserContext();
  const [dashboard,pendingPartnerResult,issues,approvals]=await Promise.all([
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

  const canonicalAttention:AttentionSource[]=dashboard.cases
    .filter(item=>item.stage!=='project'||['waiting','review'].includes(item.status))
    .filter(item=>!prospectIds.has(String(item.id)))
    .map(item=>({
      id:item.id,
      title:item.nextAction,
      company:item.company,
      reason:item.deadline?`Deadline ${item.deadline}`:`${item.stageLabel} · ${item.status.replaceAll('_',' ')}`,
      waitingSince:item.waitingSince,
      priority:item.priority,
      href:item.href,
      stage:item.stage,
    }));

  const attention=resolveBusinessAttention([...partnerAttention,...canonicalAttention]);
  const queue=buildMissionPriorityQueue({approvals,dependencies:attention.items,issues});
  const summary=summariseMissionPriorityQueue(queue);
  const queueItems:WorkQueueItem[]=queue.map(item=>({
    id:item.id,
    label:`${item.tier} · ${item.label}`,
    title:item.title,
    detail:item.detail,
    owner:item.owner,
    meta:`${item.meta} · ${formatWaitingMinutes(item.ageMinutes)}`,
    href:item.href,
    tone:item.tone,
    actionLabel:actionLabel(item.kind),
  }));

  return <section className="attention-page">
    <header className="attention-page__header">
      <div><Link className="op-object-header__back" href="/workspace">← Mission Control</Link><p className="op-ui-eyebrow">Operating attention</p><h1>All attention</h1><p>Every active decision, dependency and operational exception in one deterministic priority order.</p></div>
      <Link className="button secondary" href="/workspace">Back to Mission Control</Link>
    </header>

    <SignalStrip items={[
      {label:'Total attention',value:summary.total,detail:'Ranked active items'},
      {label:'P1 critical',value:summary.p1,detail:'Immediate business consequence',tone:summary.p1?'critical':'neutral'},
      {label:'P2 high',value:summary.p2,detail:'High priority intervention',tone:summary.p2?'attention':'neutral'},
      {label:'Composition',value:summary.decisions,detail:`${summary.issues} issues · ${summary.dependencies} dependencies`,tone:summary.total?'waiting':'neutral'},
    ]}/>

    <WorkQueue eyebrow="P1 → P4" title="Ranked attention queue" items={queueItems} empty="Nothing currently needs intervention."/>
  </section>;
}
