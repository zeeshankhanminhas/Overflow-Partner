import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot, type DashboardActivity } from '@/lib/repositories/dashboard';

function formatEvent(eventType: string) {
  return eventType
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function activityHref(activity: DashboardActivity) {
  if (activity.entity_type === 'lead') return `/workspace/leads/${activity.entity_id}`;
  if (activity.entity_type === 'technical_intake') return '/workspace/leads';
  if (activity.entity_type === 'prospect') return '/workspace/acquisition';
  if (activity.entity_type === 'document') return '/workspace/documents';
  return null;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default async function WorkspacePage() {
  const { supabase, organisationId, profile } = await requireUserContext();
  const dashboard = await getDashboardSnapshot(supabase, organisationId);
  const name = profile.first_name || profile.full_name?.split(' ')[0] || 'Zeeshan';

  const primaryMetrics = [
    { label: 'Prospects', value: dashboard.prospects, href: '/workspace/acquisition', note: 'All acquisition sources' },
    { label: 'Qualified prospects', value: dashboard.qualifiedProspects, href: '/workspace/acquisition', note: 'Ready for lead conversion' },
    { label: 'Open leads', value: dashboard.openLeads, href: '/workspace/leads', note: 'Excludes won and lost' },
    { label: 'Intakes awaiting review', value: dashboard.technicalIntakesAwaitingReview, href: '/workspace/leads', note: 'Submitted or under review' },
  ];

  const workflowMetrics = [
    { label: 'Partner RFQs outstanding', value: dashboard.partnerRfqsOutstanding },
    { label: 'Quotes awaiting approval', value: dashboard.quotesAwaitingApproval },
    { label: 'Active projects', value: dashboard.activeProjects },
    { label: 'Documents', value: dashboard.documents, href: '/workspace/documents' },
  ];

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Operations workspace</p>
          <h1>Good evening, {name}</h1>
          <p className="lede">A live view of acquisition, engineering intake, commercial decisions and delivery workload.</p>
        </div>
        <div className="card" style={{ minWidth: 190, padding: 20 }}>
          <span>Today&apos;s activity</span>
          <strong style={{ display: 'block', marginTop: 8, fontSize: 36 }}>{dashboard.todaysActivity}</strong>
          <small>Recorded workflow events</small>
        </div>
      </div>

      <div className="metric-grid" style={{ marginTop: 28 }}>
        {primaryMetrics.map((metric) => (
          <Link className="metric" href={metric.href} key={metric.label} style={{ textDecoration: 'none' }}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 36 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16 }}>
          <div>
            <p className="eyebrow">Workflow pressure</p>
            <h2>What needs attention</h2>
          </div>
          <Link href="/workspace/leads">Open lead queue</Link>
        </div>
        <div className="metric-grid" style={{ marginTop: 16 }}>
          {workflowMetrics.map((metric) => {
            const content = (
              <>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.value === 0 ? 'No immediate action' : 'Review required'}</small>
              </>
            );

            return metric.href ? (
              <Link className="metric" href={metric.href} key={metric.label} style={{ textDecoration: 'none' }}>{content}</Link>
            ) : (
              <article className="metric" key={metric.label}>{content}</article>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(260px, .7fr)', gap: 24, alignItems: 'start' }}>
        <div>
          <p className="eyebrow">Recent activity</p>
          <h2>Latest movement</h2>
          <div className="card" style={{ width: '100%', marginTop: 16, padding: 0, overflow: 'hidden' }}>
            {dashboard.recentActivity.length === 0 ? (
              <div style={{ padding: 24 }}>
                <h3>No activity yet</h3>
                <p className="lede" style={{ fontSize: 16 }}>Create a prospect, lead or technical intake and the timeline will populate automatically.</p>
              </div>
            ) : dashboard.recentActivity.map((activity, index) => {
              const href = activityHref(activity);
              const row = (
                <div style={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr) auto', gap: 14, alignItems: 'start', padding: 20, borderBottom: index === dashboard.recentActivity.length - 1 ? 'none' : '1px solid rgba(23,23,23,.1)' }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: '#E5483F', marginTop: 7 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: 16 }}>{formatEvent(activity.event_type)}</strong>
                    <small>{activity.entity_type.replaceAll('_', ' ')}</small>
                  </div>
                  <time dateTime={activity.created_at} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatTime(activity.created_at)}</time>
                </div>
              );

              return href ? <Link href={href} key={activity.id} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>{row}</Link> : <div key={activity.id}>{row}</div>;
            })}
          </div>
        </div>

        <aside>
          <p className="eyebrow">Quick actions</p>
          <h2>Move work forward</h2>
          <div className="card stack" style={{ width: '100%', marginTop: 16 }}>
            <Link className="button" href="/workspace/acquisition">Add prospect</Link>
            <Link className="button secondary" href="/workspace/leads">Create lead</Link>
            <Link href="/workspace/documents">Open Document Engine</Link>
          </div>

          {dashboard.warnings.length > 0 ? (
            <div className="card" style={{ width: '100%', marginTop: 16 }}>
              <p className="eyebrow">Setup notice</p>
              <p style={{ marginTop: 8, fontSize: 14 }}>Some future modules are not available yet. Their dashboard values are shown as zero until those modules are activated.</p>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
