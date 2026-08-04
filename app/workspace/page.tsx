import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot, type DashboardActivity, type MissionCase } from '@/lib/repositories/dashboard';

const stageOrder: MissionCase['stage'][] = ['prospect', 'lead', 'technical', 'partner', 'commercial', 'quote', 'project'];
const stageLabels: Record<MissionCase['stage'], string> = {
  prospect: 'Prospects', lead: 'Leads', technical: 'Technical Review', partner: 'Partner Pricing',
  commercial: 'Commercial', quote: 'Quotes', project: 'Projects',
};

function words(value: string) {
  return value.replaceAll('.', ' ').replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function waiting(value: string) {
  const milliseconds = Math.max(0, Date.now() - Date.parse(value));
  const minutes = Math.floor(milliseconds / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function activityHref(activity: DashboardActivity) {
  if (activity.entity_type === 'lead') return `/workspace/leads/${activity.entity_id}`;
  if (activity.entity_type === 'prospect') return '/workspace/acquisition';
  if (activity.entity_type === 'document') return '/workspace/documents';
  return '/workspace/activity';
}

export default async function WorkspacePage() {
  const { supabase, organisationId, profile } = await requireUserContext();
  const dashboard = await getDashboardSnapshot(supabase, organisationId);
  const name = profile.first_name || profile.full_name?.split(' ')[0] || 'Zeeshan';
  const selected = dashboard.selectedCase;

  return <section className="mission-control">
    <header className="mission-header">
      <div><p className="eyebrow">Mission Control</p><h1>Good morning, {name}</h1>
        <p className="lede">See what changed, what needs attention, and where every engineering case is sitting.</p></div>
      <div className="mission-search" aria-label="Workspace search placeholder">Search by company, contact or reference</div>
    </header>

    <div className="mission-kpis">
      <article><span>New enquiries</span><strong>{dashboard.prospects}</strong><small>Across all acquisition sources</small></article>
      <article><span>Requires action</span><strong>{dashboard.attention.length}</strong><small>Cases and tasks awaiting a decision</small></article>
      <article><span>In progress</span><strong>{dashboard.cases.length}</strong><small>Active cases across all stages</small></article>
      <article><span>Technical review</span><strong>{dashboard.technicalIntakesAwaitingReview}</strong><small>Submitted or clarification required</small></article>
      <article><span>Quotes awaiting</span><strong>{dashboard.quotesAwaitingApproval}</strong><small>Commercial approval required</small></article>
    </div>

    <div className="mission-layout">
      <div className="mission-main">
        <section className="mission-section">
          <div className="section-heading"><div><p className="eyebrow">My work</p><h2>What needs your attention</h2></div><Link href="/workspace/tasks">View all actions →</Link></div>
          <div className="attention-grid">
            {dashboard.attention.length === 0 ? <div className="empty-state">No cases currently require action.</div> : dashboard.attention.slice(0, 4).map((item) =>
              <Link href={item.href} key={`${item.id}-${item.title}`} className="attention-card">
                <span className={`stage-dot stage-${item.stage}`} />
                <div><strong>{item.title}</strong><p>{item.company}</p><small>{item.reason}</small></div>
                <time dateTime={item.waitingSince}>Waiting {waiting(item.waitingSince)}</time>
              </Link>)}
          </div>
        </section>

        <section className="mission-section">
          <div className="section-heading"><div><p className="eyebrow">Case movement</p><h2>Pipeline overview</h2></div><Link href="/workspace/orchestration">Open orchestration →</Link></div>
          <div className="pipeline-board">
            {stageOrder.map((stage) => <div className="pipeline-column" key={stage}>
              <header><span>{stageLabels[stage]}</span><strong>{dashboard.pipeline[stage].length}</strong></header>
              <div className="pipeline-cards">
                {dashboard.pipeline[stage].slice(0, 4).map((item) => <Link className="pipeline-card" href={item.href} key={`${item.kind}-${item.id}`}>
                  <strong>{item.company}</strong><p>{item.requirement}</p>
                  <div><span>{item.service}</span><time dateTime={item.waitingSince}>{waiting(item.waitingSince)}</time></div>
                </Link>)}
                {dashboard.pipeline[stage].length === 0 ? <p className="pipeline-empty">No active cases</p> : null}
                {dashboard.pipeline[stage].length > 4 ? <small>+ {dashboard.pipeline[stage].length - 4} more</small> : null}
              </div>
            </div>)}
          </div>
        </section>

        <section className="activity-grid-v2">
          <div className="mission-section">
            <div className="section-heading"><div><p className="eyebrow">Recent activity</p><h2>Latest movement</h2></div><Link href="/workspace/activity">Full timeline →</Link></div>
            <div className="activity-list-v2">
              {dashboard.recentActivity.slice(0, 6).map((activity) => <Link href={activityHref(activity)} key={activity.id}>
                <span className="activity-mark" /><div><strong>{words(activity.event_type)}</strong><p>{words(activity.entity_type)}</p></div>
                <time dateTime={activity.created_at}>{dateTime(activity.created_at)}</time>
              </Link>)}
              {dashboard.recentActivity.length === 0 ? <div className="empty-state">No activity has been recorded yet.</div> : null}
            </div>
          </div>
          <div className="mission-section">
            <div className="section-heading"><div><p className="eyebrow">Operational pressure</p><h2>Stage workload</h2></div></div>
            <div className="pressure-list">
              <Link href="/workspace/acquisition"><span>Qualified prospects</span><strong>{dashboard.qualifiedProspects}</strong></Link>
              <Link href="/workspace/leads"><span>Open leads</span><strong>{dashboard.openLeads}</strong></Link>
              <Link href="/workspace/partner-quotes"><span>Partner RFQs outstanding</span><strong>{dashboard.partnerRfqsOutstanding}</strong></Link>
              <Link href="/workspace/projects"><span>Active projects</span><strong>{dashboard.activeProjects}</strong></Link>
              <Link href="/workspace/documents"><span>Controlled documents</span><strong>{dashboard.documents}</strong></Link>
            </div>
          </div>
        </section>
      </div>

      <aside className="case-snapshot">
        {selected ? <>
          <div className="case-snapshot-header"><div><p className="eyebrow">Case snapshot</p><h2>{selected.company}</h2><code>{selected.reference}</code></div><span className="status-pill">{words(selected.status)}</span></div>
          <dl className="case-control-strip">
            <div><dt>Current stage</dt><dd>{selected.stageLabel}</dd></div>
            <div><dt>Waiting</dt><dd>{waiting(selected.waitingSince)}</dd></div>
            <div><dt>Next action</dt><dd>{selected.nextAction}</dd></div>
            <div><dt>Priority</dt><dd>{words(selected.priority)}</dd></div>
          </dl>
          <section><h3>Customer</h3><p><strong>{selected.contact || 'Contact not recorded'}</strong></p><small>Created {dateTime(selected.createdAt)}</small></section>
          <section><h3>Requirement summary</h3><p>{selected.requirement}</p>
            <dl className="case-facts"><div><dt>Service</dt><dd>{selected.service}</dd></div><div><dt>Deadline</dt><dd>{selected.deadline || 'Not recorded'}</dd></div><div><dt>Commercial</dt><dd>{selected.amount || 'Not reached'}</dd></div></dl>
          </section>
          <section><h3>Timeline</h3><ol className="case-timeline">
            {selected.timeline.length ? selected.timeline.map((event) => <li key={event.id}><span /><div><strong>{words(event.event_type)}</strong><time dateTime={event.created_at}>{dateTime(event.created_at)}</time></div></li>) :
              <li><span /><div><strong>Case created</strong><time dateTime={selected.createdAt}>{dateTime(selected.createdAt)}</time></div></li>}
          </ol></section>
          <Link href={selected.href} className="case-primary-action">Open case workspace →</Link>
        </> : <div className="empty-state">Create a prospect or lead to begin Mission Control.</div>}
      </aside>
    </div>
  </section>;
}
