import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot } from '@/lib/repositories/dashboard';

function waiting(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function WorkspacePage() {
  const { supabase, organisationId, profile } = await requireUserContext();
  const dashboard = await getDashboardSnapshot(supabase, organisationId);
  const name = profile.first_name || profile.full_name?.split(' ')[0] || 'Operator';
  const allActions = dashboard.attention;
  const actions = allActions.slice(0, 8);
  const overdue = allActions.filter((item) => Date.now() - Date.parse(item.waitingSince) > 48 * 60 * 60 * 1000).length;
  const waitingOnPartner = allActions.filter((item) => item.stage === 'partner').length;
  const waitingOnInternal = allActions.length - waitingOnPartner;

  return <section style={{ display: 'grid', gap: 20 }}>
    <section className="card" style={{ width: '100%', padding: 28, background: 'linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.025))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 28, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 760 }}>
          <p className="eyebrow">Owner command centre</p>
          <h1 style={{ margin: '16px 0 12px' }}>Good morning, {name}.</h1>
          <p className="lede" style={{ margin: 0 }}>Priority work, ageing risk and the next governed decision. Detailed evidence stays inside each Case 360 or Project 360 record.</p>
        </div>
        <Link className="button secondary" href="/workspace/leads">Open all cases</Link>
      </div>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
      <article className="metric"><span>Open actions</span><strong>{allActions.length}</strong><small>Cases requiring attention</small></article>
      <article className="metric"><span>Overdue</span><strong>{overdue}</strong><small>Waiting more than two days</small></article>
      <article className="metric"><span>Active delivery</span><strong>{dashboard.activeProjects}</strong><small>Projects currently live</small></article>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,.72fr) minmax(0,1.28fr)', gap: 20, alignItems: 'start' }}>
      <aside style={{ display: 'grid', gap: 20 }}>
        <section className="card" style={{ width: '100%' }}>
          <p className="eyebrow">Workload</p><h2 style={{ marginTop: 8 }}>Where work is waiting</h2>
          <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', paddingTop: 12 }}><span>Internal decision</span><strong>{waitingOnInternal}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', paddingTop: 12 }}><span>Execution partner</span><strong>{waitingOnPartner}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', paddingTop: 12 }}><span>Client decision</span><strong>{dashboard.quotesAwaitingApproval}</strong></div>
          </div>
        </section>
        <section className="card" style={{ width: '100%' }}>
          <p className="eyebrow">Watchlist</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Technical reviews</span><strong>{dashboard.technicalIntakesAwaitingReview}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Partner responses</span><strong>{dashboard.partnerRfqsOutstanding}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Controlled documents</span><strong>{dashboard.documents}</strong></div>
          </div>
        </section>
      </aside>

      <section className="card" style={{ width: '100%', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'end' }}>
          <div><p className="eyebrow">Needs action now</p><h2 style={{ margin: '8px 0 0' }}>Live action queue</h2></div>
          <span>{allActions.length} open</span>
        </div>
        <div style={{ display: 'grid', marginTop: 20 }}>
          {actions.length ? actions.map((item, index) => <Link href={item.href} key={`${item.id}-${item.title}`} style={{ display: 'grid', gridTemplateColumns: '42px minmax(0,1fr) 100px 32px', gap: 14, alignItems: 'center', padding: '18px 4px', borderTop: '1px solid' }}>
            <span style={{ color: '#b4975a', fontSize: 12 }}>{String(index + 1).padStart(2, '0')}</span>
            <div style={{ minWidth: 0 }}><strong style={{ display: 'block' }}>{item.title}</strong><p style={{ margin: '5px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.company} · {item.reason}</p></div>
            <div><small>Waiting</small><strong style={{ display: 'block', marginTop: 4 }}>{waiting(item.waitingSince)}</strong></div>
            <span>↗</span>
          </Link>) : <p style={{ padding: '24px 0 8px' }}>No cases currently require a decision.</p>}
        </div>
        {allActions.length > actions.length ? <p style={{ margin: '14px 0 0', color: 'var(--op-muted)' }}>Showing the 8 oldest priority items. <Link href="/workspace/leads">Open the full Case queue →</Link></p> : null}
      </section>
    </section>
  </section>;
}
