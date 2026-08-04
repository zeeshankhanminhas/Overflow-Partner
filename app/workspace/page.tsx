import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot, type DashboardActivity, type MissionCase } from '@/lib/repositories/dashboard';

const stageOrder: MissionCase['stage'][] = ['prospect', 'lead', 'technical', 'partner', 'commercial', 'quote', 'project'];
const stageLabels: Record<MissionCase['stage'], string> = {
  prospect: 'Prospect', lead: 'Lead', technical: 'Technical', partner: 'Partner',
  commercial: 'Commercial', quote: 'Quote', project: 'Project',
};

function words(value: string) {
  return value.replaceAll('.', ' ').replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
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
  const highestPressure = dashboard.attention[0];

  return <section className="mission-control mission-v3">
    <header className="command-header">
      <div className="command-kicker"><span className="live-dot" /> Live operations</div>
      <div className="command-title-row">
        <div>
          <p className="eyebrow">Overflow Partner / Mission Control</p>
          <h1>Good morning, {name}.</h1>
          <p>Control engineering work from first enquiry to issued delivery.</p>
        </div>
        <div className="command-meta">
          <span>{dashboard.todaysActivity} movements today</span>
          <strong>{dashboard.attention.length} require attention</strong>
        </div>
      </div>
    </header>

    <section className="attention-hero">
      <div className="attention-hero-copy">
        <p className="eyebrow">Priority signal</p>
        {highestPressure ? <>
          <h2>{highestPressure.title}</h2>
          <p>{highestPressure.company} · {highestPressure.reason}</p>
          <div className="attention-meta"><span>Waiting {waiting(highestPressure.waitingSince)}</span><span>{stageLabels[highestPressure.stage]} stage</span></div>
        </> : <><h2>No immediate action required.</h2><p>The operating queue is clear.</p></>}
      </div>
      {highestPressure ? <Link className="attention-primary" href={highestPressure.href}>Open priority case <span>↗</span></Link> : <Link className="attention-primary" href="/workspace/acquisition">Open acquisition <span>↗</span></Link>}
    </section>

    <div className="signal-strip">
      <Link href="/workspace/acquisition"><span>New enquiries</span><strong>{dashboard.prospects}</strong><small>All sources</small></Link>
      <Link href="/workspace/leads"><span>Open cases</span><strong>{dashboard.cases.length}</strong><small>Across workflow</small></Link>
      <Link href="/workspace/leads"><span>Technical pressure</span><strong>{dashboard.technicalIntakesAwaitingReview}</strong><small>Awaiting review</small></Link>
      <Link href="/workspace/commercial-reviews"><span>Commercial decisions</span><strong>{dashboard.quotesAwaitingApproval}</strong><small>Awaiting approval</small></Link>
      <Link href="/workspace/projects"><span>Active delivery</span><strong>{dashboard.activeProjects}</strong><small>Live projects</small></Link>
    </div>

    <div className="mission-layout-v3">
      <main className="mission-flow">
        <section className="flow-section pipeline-section-v3">
          <div className="flow-heading">
            <div><p className="eyebrow">Workflow movement</p><h2>Every case, one controlled route.</h2></div>
            <Link href="/workspace/orchestration">Open orchestration</Link>
          </div>
          <div className="pipeline-rail">
            {stageOrder.map((stage, index) => {
              const items = dashboard.pipeline[stage];
              return <div className="rail-stage" key={stage}>
                <div className="rail-stage-head">
                  <span className="rail-index">0{index + 1}</span>
                  <div><strong>{stageLabels[stage]}</strong><small>{items.length} active</small></div>
                </div>
                <div className="rail-line"><span className={items.length ? 'active' : ''} /></div>
                <div className="rail-cases">
                  {items.slice(0, 2).map((item) => <Link href={item.href} key={`${item.kind}-${item.id}`}>
                    <strong>{item.company}</strong>
                    <p>{item.requirement}</p>
                    <footer><span>{item.service}</span><time>{waiting(item.waitingSince)}</time></footer>
                  </Link>)}
                  {!items.length ? <p className="rail-empty">Clear</p> : null}
                </div>
              </div>;
            })}
          </div>
        </section>

        <section className="flow-section work-section-v3">
          <div className="flow-heading">
            <div><p className="eyebrow">Decision queue</p><h2>Work that needs a human decision.</h2></div>
            <Link href="/workspace/tasks">View all actions</Link>
          </div>
          <div className="decision-list">
            {dashboard.attention.length === 0 ? <div className="editorial-empty">No cases currently require action.</div> : dashboard.attention.slice(0, 6).map((item, index) =>
              <Link href={item.href} key={`${item.id}-${item.title}`}>
                <span className="decision-number">{String(index + 1).padStart(2, '0')}</span>
                <div className="decision-copy"><small>{stageLabels[item.stage]}</small><strong>{item.title}</strong><p>{item.company} · {item.reason}</p></div>
                <div className="decision-wait"><small>Waiting</small><strong>{waiting(item.waitingSince)}</strong></div>
                <span className="decision-arrow">↗</span>
              </Link>)}
          </div>
        </section>

        <section className="flow-grid-bottom">
          <div className="flow-section activity-v3">
            <div className="flow-heading"><div><p className="eyebrow">Evidence trail</p><h2>Latest movement</h2></div><Link href="/workspace/activity">Full timeline</Link></div>
            <div className="activity-editorial">
              {dashboard.recentActivity.slice(0, 6).map((activity) => <Link href={activityHref(activity)} key={activity.id}>
                <time dateTime={activity.created_at}>{dateTime(activity.created_at)}</time>
                <span className="activity-rule" />
                <div><strong>{words(activity.event_type)}</strong><small>{words(activity.entity_type)}</small></div>
              </Link>)}
              {!dashboard.recentActivity.length ? <div className="editorial-empty">No activity recorded yet.</div> : null}
            </div>
          </div>

          <div className="flow-section pressure-v3">
            <div className="flow-heading"><div><p className="eyebrow">System pressure</p><h2>Workload</h2></div></div>
            <div className="pressure-bars">
              {[
                ['Qualified prospects', dashboard.qualifiedProspects, '/workspace/acquisition'],
                ['Open leads', dashboard.openLeads, '/workspace/leads'],
                ['Partner RFQs', dashboard.partnerRfqsOutstanding, '/workspace/partner-quotes'],
                ['Documents', dashboard.documents, '/workspace/documents'],
              ].map(([label, value, href]) => <Link href={String(href)} key={String(label)}>
                <div><span>{label}</span><strong>{value}</strong></div>
                <i style={{ width: `${Math.min(100, Number(value) * 14)}%` }} />
              </Link>)}
            </div>
          </div>
        </section>
      </main>

      <aside className="case-file-v3">
        {selected ? <>
          <div className="case-file-topline"><span>Selected case</span><span className="case-status">{words(selected.status)}</span></div>
          <header>
            <code>{selected.reference}</code>
            <h2>{selected.company}</h2>
            <p>{selected.requirement}</p>
          </header>
          <div className="case-control-v3">
            <div><small>Current stage</small><strong>{selected.stageLabel}</strong></div>
            <div><small>Waiting</small><strong>{waiting(selected.waitingSince)}</strong></div>
            <div><small>Priority</small><strong>{words(selected.priority)}</strong></div>
          </div>
          <section className="case-next-v3"><small>Next controlled action</small><h3>{selected.nextAction}</h3><Link href={selected.href}>Open case workspace ↗</Link></section>
          <section className="case-data-v3">
            <div><small>Contact</small><strong>{selected.contact || 'Not recorded'}</strong></div>
            <div><small>Service</small><strong>{selected.service}</strong></div>
            <div><small>Deadline</small><strong>{selected.deadline || 'Not recorded'}</strong></div>
            <div><small>Commercial</small><strong>{selected.amount || 'Not reached'}</strong></div>
          </section>
          <section className="case-history-v3">
            <div className="case-history-title"><small>Case history</small><span>{selected.timeline.length} events</span></div>
            <ol>
              {(selected.timeline.length ? selected.timeline : [{ id: selected.id, event_type: 'case_created', created_at: selected.createdAt }]).slice(0, 6).map((event) =>
                <li key={event.id}><span /><div><strong>{words(event.event_type)}</strong><time>{dateTime(event.created_at)}</time></div></li>)}
            </ol>
          </section>
        </> : <div className="editorial-empty">Create a prospect or lead to begin Mission Control.</div>}
      </aside>
    </div>
  </section>;
}
