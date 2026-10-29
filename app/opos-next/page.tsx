import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';
import { resolveBusinessAttention, type AttentionSource } from '@/lib/dashboard/attention';
import { buildMissionPriorityQueue } from '@/lib/dashboard/priorityQueue';
import { getWorkspaceChromeData } from '@/lib/workspace/request-data';
import styles from './mission.module.css';
import { nextHref } from './nextHref';

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
    company: item.prospect?.[0]?.company_name || 'Opportunity',
    reason: item.status === 'clarification_required'
      ? 'More information is needed to continue.'
      : (item.partner?.[0]?.company_name || 'Delivery Partner') + ' · due ' + new Date(item.response_due_at).toLocaleDateString('en-GB'),
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
  const waiting = attention.items.filter(item => item.ownerBucket === 'client' || item.ownerBucket === 'partner').slice(0,3);
  const action = primary ? nextHref(primary.href) : '/opos-next/opportunities';
  const primaryIsGoverned = primary ? action === primary.href : false;
  return <section className={styles.root} aria-labelledby="opos-mission-heading">
    <p className={styles.eyebrow}>{new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/London'}).format(new Date()).toUpperCase()}</p>
    <h1 className={styles.heading} id="opos-mission-heading">Mission Control</h1>
    <p className={styles.lead}>The decisions that matter. Everything else stays in motion.</p>
    <section className={styles.primary} aria-label="Next priority">
      <div className={styles.primaryTop}>
        <span className={styles.eyebrow}>{primary ? 'NEXT PRIORITY' : 'ALL CLEAR'}</span>
        {primary ? <span className={styles.pill}><span className={styles.pillDot}/>{primary.kind==='approval'?'Needs approval':primary.kind==='issue'?'Needs attention':'Work to review'}</span> : null}
      </div>
      <h2 className={styles.primaryTitle}>{primary?.title || 'No immediate decisions'}</h2>
      <p className={styles.primaryDesc}>{primary?.detail || 'There are no issues or decisions currently requiring your attention.'}</p>
      <div className={styles.divider}/>
      <div className={styles.primaryFooter}>
        <div><p className={styles.primaryName}>{primary?.owner || 'Overflow Partner'}</p>
          <p className={styles.primaryMeta}>{primary ? primary.label + ' · ' + primary.meta : 'Your operating desk is clear'}</p>
        </div>
        <Link href={action} className={styles.primaryAction}>{primary ? (primaryIsGoverned ? actionText(primary.kind) : 'Inspect operating position') : 'View opportunities'} →</Link>
      </div>
    </section>
    <div className={styles.columns}>
      <section aria-labelledby="opos-upnext">
        <div className={styles.sectionHead}><h2 id="opos-upnext">Up next</h2><span className={styles.sectionCount}>{next.length} decision{next.length===1?'':'s'}</span></div>
        <div className={styles.sectionPanel}>
          {next.length ? <ul className={styles.list}>{next.map(item=><li key={item.id} className={styles.row}>
            <Link className={styles.rowLink} href={nextHref(item.href)}>
              <span><strong className={styles.rowTitle}>{item.title}</strong><span className={styles.rowCopy}>{item.detail}</span></span>
              <span className={styles.rowAction}>Review ↗</span>
            </Link>
          </li>)}</ul> : <p className={styles.empty}>Nothing else needs a decision right now.</p>}
        </div>
      </section>
      <section aria-labelledby="opos-waiting">
        <div className={styles.sectionHead}><h2 id="opos-waiting">Waiting on others</h2><span className={styles.sectionCount}>{attention.waitingOnClient+attention.waitingOnPartner} records</span></div>
        <div className={styles.sectionPanel}>
          {waiting.length ? <ul className={styles.list}>{waiting.map(item=><li key={item.id} className={styles.row}>
            <Link className={styles.rowLink} href={nextHref(item.href)}>
              <span><strong className={styles.rowTitle}>{item.title}</strong><span className={styles.rowCopy}>{item.company}</span></span>
              <span className={styles.rowAction}>{item.ownerBucket==='client'?'Customer':'Partner'}</span>
            </Link>
          </li>)}</ul> : <p className={styles.empty}>No outstanding customer or partner dependencies.</p>}
        </div>
      </section>
    </div>
  </section>;
}
