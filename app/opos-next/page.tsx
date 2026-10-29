import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';
import { buildMissionPriorityQueue } from '@/lib/dashboard/priorityQueue';
import { getWorkspaceChromeData } from '@/lib/workspace/request-data';
import css from './opos.module.css';

function actionText(kind: 'issue' | 'approval' | 'dependency') {
  return kind === 'issue' ? 'Resolve issue' : kind === 'approval' ? 'Review decision' : 'Review next step';
}

export default async function NewMissionControl() {
  const { supabase, organisationId } = await requireUserContext();
  const [dashboard, pendingPartners, overdueAccounts, chrome] = await Promise.all([
    getDashboardSnapshot(supabase, organisationId),
    supabase.from('partner_review_requests')
      .select('id,prospect_id,status,created_at,sent_at,submitted_at,response_due_at,partner:partners(company_name),prospect:prospects(company_name)')
      .eq('organisation_id', organisationId).not('prospect_id','is',null)
      .in('status', ['invited', 'opened', 'in_progress', 'clarification_required'])
      .order('created_at', { ascending: false }),
    supabase.from('companies').select('id,name,next_account_review_at')
      .eq('organisation_id',organisationId).neq('lifecycle_status','archived')
      .not('next_account_review_at','is',null)
      .lte('next_account_review_at', new Date().toISOString())
      .order('next_account_review_at',{ascending:true}).limit(20),
    getWorkspaceChromeData(),
  ]);
  // Feed the same canonical prioritisation inputs as production Mission Control.
  const partners = pendingPartners.data || [];
  const partnerIds = new Set(partners.map(p => String(p.prospect_id)));
  const accountAttention: AttentionSource[] = (overdueAccounts.data || []).map(item => ({
    id: 'account-' + item.id, title: 'Review client account', company: item.name,
    reason: 'Account review due ' + new Date(item.next_account_review_at).toLocaleDateString('en-GB'),
    waitingSince: item.next_account_review_at, priority: 'normal',
    href: '/workspace/companies/' + item.id, stage: 'prospect',
  }));
  const partnerAttention: AttentionSource[] = partners.map(item => ({
    id: 'partner-' + item.id,
    title: item.status === 'clarification_required' ? 'Delivery partner needs clarification' : 'Waiting for delivery partner',
    company: item.prospect?.company_name || 'Opportunity',
    reason: item.status === 'clarification_required'
      ? 'More information is needed to continue.'
      : (item.partner?.company_name || 'Delivery Partner') + ' · due ' + new Date(item.response_due_at).toLocaleDateString('en-GB'),
    waitingSince: item.submitted_at || item.sent_at || item.created_at,
    priority: item.status === 'clarification_required' ? 'high' : 'normal',
    href: '/workspace/acquisition/' + item.prospect_id,
    stage: item.status === 'clarification_required' ? 'prospect' : 'partner',
  }));
  const coreAttention: AttentionSource[] = dashboard.cases
    .filter(item => item.stage !== 'project' || ['waiting','review'].includes(item.status))
    .filter(item => !partnerIds.has(String(item.id)))
    .map(item => ({
      id: item.id, title: item.nextAction, company: item.company,
      reason: item.deadline ? 'Deadline ' + item.deadline : item.stageLabel + ' · ' + item.status.replaceAll('_',' '),
      waitingSince: item.waitingSince, priority: item.priority, href: item.href, stage: item.stage,
    }));
  const attention = resolveBusinessAttention([...accountAttention, ...partnerAttention, ...coreAttention]);
  const ranked = buildMissionPriorityQueue({
    approvals: chrome.approvals,
    dependencies: attention.items,
    issues: chrome.exceptions,
  });
  const primary = ranked[0];
  const next = ranked.slice(1,5);
  return <section aria-labelledby="opos-mission-heading">
    <header className={css.pageHeader}>
      <p className={css.eyebrow}>OPOS / HOME</p>
      <h1 id="opos-mission-heading" className={css.title}>Your operating desk.</h1>
      <p className={css.subhead}>Decisions that need you. Everything else continues in the background.</p>
    </header>
    <section className={css.card} aria-label="Highest-priority decision">
      <span className={css.overline}>{primary ? 'Priority / Your next decision' : 'Operating state / Clear'}</span>
      <h2 className={css.cardTitle}>{primary?.title || 'Nothing needs your attention right now'}</h2>
      <p className={css.cardDescription}>{primary?.detail || 'No outstanding approvals, issues or dependencies need an immediate intervention.'}</p>
      {primary ? <>
        <p className={css.factRow}><span>Responsible: <strong>{primary.owner || 'Your team'}</strong></span><span>{primary.label} · {primary.meta}</span></p>
        <Link href={primary.href} className={css.action}>{actionText(primary.kind)} →</Link>
      </> : <Link href="/opos-next/opportunities" className={css.action}>View opportunities →</Link>}
    </section>
    <section className={css.section} aria-labelledby="upcoming-decisions">
      <div className={css.sectionHeading}><h2 id="upcoming-decisions">Following decisions</h2><span className={css.meta}>Ordered by operational priority</span></div>
      {next.length ? <ul className={css.queue}>{next.map(item => <li key={item.id}><Link href={item.href}>
        <span><strong>{item.title}</strong><p>{item.detail}</p><small>{item.owner || 'Your team'} · {item.label}</small></span>
        <span className={css.queueArrow}>Review ↗</span>
      </Link></li>)}</ul> : <p className={css.empty}>No further decisions are waiting.</p>}
    </section>
    <details className={css.waiting}>
      <summary>Waiting on others</summary>
      <div className={css.waitingGrid}>
        <span><strong>{attention.waitingOnClient}</strong>Customer</span>
        <span><strong>{attention.waitingOnPartner}</strong>Execution partner</span>
        <span><strong>{attention.waitingOnInternal}</strong>Internal</span>
      </div>
    </details>
  </section>;
}
