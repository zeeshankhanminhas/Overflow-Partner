import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';
import { buildMissionPriorityQueue } from '@/lib/dashboard/priorityQueue';
import { getWorkspaceChromeData } from '@/lib/workspace/request-data';

function actionLabel(kind:'issue'|'approval'|'dependency') {
  return kind==='issue'?'Resolve issue':kind==='approval'?'Review decision':'Open next action';
}

/** One priority and a short queue, without hiding the existing operating alerts
 * or changing their precedence and business interpretation. */
export default async function WorkspacePage(){
  // This branch's preview enters the new OS. Production and other branches retain their governed legacy home.
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === 'design/opos-decision-first-ia') {
    redirect('/opos-next');
  }
  const {supabase,organisationId}=await requireUserContext();
  const [dashboard,pendingPartnerResult,companyReviewResult,chrome]=await Promise.all([
    getDashboardSnapshot(supabase,organisationId),
    supabase.from('partner_review_requests')
      .select('id,prospect_id,status,created_at,sent_at,submitted_at,response_due_at,partner:partners(company_name),prospect:prospects(company_name)')
      .eq('organisation_id',organisationId).not('prospect_id','is',null)
      .in('status',['invited','opened','in_progress','clarification_required'])
      .order('created_at',{ascending:false}),
    supabase.from('companies').select('id,name,next_account_review_at')
      .eq('organisation_id',organisationId).neq('lifecycle_status','archived')
      .not('next_account_review_at','is',null).lte('next_account_review_at',new Date().toISOString())
      .order('next_account_review_at',{ascending:true}).limit(20),
    getWorkspaceChromeData(),
  ]);

  const partnerRows=(pendingPartnerResult.data||[]) as any[];
  const companyReviewAttention:AttentionSource[]=((companyReviewResult.data||[]) as any[]).map(row=>({
    id:`company-review-${row.id}`,title:'Review client account',company:row.name,
    reason:`Account review due ${new Date(row.next_account_review_at).toLocaleDateString('en-GB')}`,
    waitingSince:row.next_account_review_at,priority:'normal',
    href:`/workspace/companies/${row.id}`,stage:'prospect',
  }));
  const activeProspectIds=new Set(partnerRows.map(row=>String(row.prospect_id)));
  const partnerAttention:AttentionSource[]=partnerRows.map(row=>{
    const clarification=row.status==='clarification_required';
    return {
      id:`partner-${row.id}`,
      title:clarification?'Delivery partner needs clarification':'Waiting for delivery partner',
      company:row.prospect?.company_name||'Opportunity',
      reason:clarification?'More information is needed to continue'
        :`${row.partner?.company_name||'Delivery Partner'} · due ${new Date(row.response_due_at).toLocaleDateString('en-GB')}`,
      waitingSince:row.submitted_at||row.sent_at||row.created_at,
      priority:clarification?'high':'normal',href:`/workspace/acquisition/${row.prospect_id}`,
      stage:clarification?'prospect':'partner',
    };
  });
  const canonical:AttentionSource[]=dashboard.cases
    .filter(item=>item.stage!=='project'||['waiting','review'].includes(item.status))
    .filter(item=>!activeProspectIds.has(String(item.id)))
    .map(item=>({
      id:item.id,title:item.nextAction,company:item.company,
      reason:item.deadline?`Deadline ${item.deadline}`:`${item.stageLabel} · ${item.status.replaceAll('_',' ')}`,
      waitingSince:item.waitingSince,priority:item.priority,href:item.href,stage:item.stage,
    }));

  const attention=resolveBusinessAttention([...companyReviewAttention,...partnerAttention,...canonical]);
  // Use exactly the canonical priority ranking: no UI-only alternative to approval/exception rules.
  const ranked=buildMissionPriorityQueue({
    approvals:chrome.approvals,
    dependencies:attention.items,
    issues:chrome.exceptions,
  });
  const primary=ranked[0];
  const more=ranked.slice(1,6);

  return <section className="op-focus-home op-surface" aria-labelledby="workspace-focus-title">
    <header className="op-focus-home__heading">
      <p className="op-focus-home__eyebrow">OPOS / HOME</p>
      <h1 id="workspace-focus-title">What needs your attention?</h1>
      <p>Start with the highest-priority action. Everything else is still available when you need it.</p>
    </header>

    <section className="op-focus-home__primary" aria-label="Top priority">
      <span className="op-focus-home__eyebrow">{primary?'Next priority':'All clear'}</span>
      <h2>{primary?.title||'No immediate action required'}</h2>
      <p>{primary?.detail||'There are no pending decisions, delivery issues or dependencies requiring action right now.'}</p>
      {primary?<p className="op-focus__owner">
        {primary.owner||'Your team'} · {primary.label} · {primary.meta}
      </p>:null}
      <Link className="button" href={primary?.href||'/workspace/projects'}>
        {primary?actionLabel(primary.kind):'Open projects'} →
      </Link>
    </section>

    <section className="op-focus-home__queue" aria-labelledby="other-work-title">
      <header className="op-focus-home__queue-header">
        <h2 id="other-work-title">Up next</h2>
        <Link href="/workspace/attention">See all work →</Link>
      </header>
      {more.length?<ul>{more.map(item=><li key={item.id}>
        <Link href={item.href}>
          <span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
            <small>{item.label} · {item.owner||'Your team'}</small>
          </span>
          <span className="op-focus-home__chevron">{actionLabel(item.kind)} ↗</span>
        </Link>
      </li>)}</ul>:<p className="op-focus-home__empty">Nothing else needs your attention right now.</p>}
    </section>

    <details className="op-focus-home__waiting">
      <summary>Waiting on others</summary>
      <div>
        <span><strong>{attention.waitingOnClient}</strong> Client</span>
        <span><strong>{attention.waitingOnPartner}</strong> Partner</span>
        <span><strong>{attention.waitingOnInternal}</strong> Internal team</span>
      </div>
    </details>
  </section>;
}
