import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { formatWaitingMinutes, resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';
import { buildMissionPriorityQueue, summariseMissionPriorityQueue } from '@/lib/dashboard/priorityQueue';
import { getOperationalExceptions } from '@/lib/operations/exceptions';
import { getApprovalQueue } from '@/lib/presentation/approvals';
import { WorkQueue, type WorkQueueItem } from '@/components/workspace/OperationalUI';

function actionLabel(kind:'issue'|'approval'|'dependency'){return kind==='issue'?'Resolve':kind==='approval'?'Review':'Open'}

type View='all'|'approval'|'issue'|'dependency';
export default async function AttentionPage({searchParams}:{searchParams?:Promise<{view?:string}>}){
  const params=searchParams?await searchParams:{};
  const view:View=['approval','issue','dependency'].includes(String(params.view))?params.view as View:'all';
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
  const filtered=view==='all'?queue:queue.filter(item=>item.kind===view);
  const queueItems:WorkQueueItem[]=filtered.map(item=>({
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

  return <section className="attention-page op-unified-page" aria-labelledby="my-work-heading">
    <header className="op-unified-page__top">
      <div>
        <Link href="/workspace" className="op-unified-page__back">← Home</Link>
        <p className="op-unified-page__eyebrow">OPOS / MY WORK</p>
        <h1 id="my-work-heading">My Work</h1>
        <p>One priority queue for decisions, issues and dependencies. Ranked by existing business rules.</p>
      </div>
    </header>
    <nav className="op-unified-page__filters" aria-label="Filter work">
      {([
        ['all','Everything',summary.total],
        ['approval','Approvals',summary.decisions],
        ['issue','Issues',summary.issues],
        ['dependency','Waiting & dependencies',summary.dependencies],
      ] as const).map(([key,label,count])=><Link key={key}
        href={key==='all'?'/workspace/attention':'/workspace/attention?view='+key}
        aria-current={view===key?'page':undefined} className={view===key?'is-active':''}>
        {label} <small>{count}</small>
      </Link>)}
    </nav>
    <WorkQueue eyebrow="P1 → P4" title={view==='all'?'Prioritised work':'Matching work'}
      items={queueItems} empty="Nothing in this category needs attention."/>
    <p className="op-unified-page__footnote">Assigned routine tasks are in the <Link href="/workspace/tasks">Tasks register</Link>. Approvals, issues and dependencies retain their existing authoritative owners and controls.</p>
  </section>;
}
