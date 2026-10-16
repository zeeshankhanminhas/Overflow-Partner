import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getDashboardSnapshot, type MissionCase } from '@/lib/repositories/dashboard';
import { resolveBusinessAttention } from '@/lib/dashboard/attention';
import styles from './page.module.css';

type Params = { q?: string; view?: string; id?: string };
function normal(value: string) { return value.replaceAll('_', ' '); }
function fmtDate(value: string | null) {
  if (!value) return 'Not specified';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not specified' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function buildHref(params: Params) {
  const q = new URLSearchParams();
  if (params.view && params.view !== 'all') q.set('view', params.view);
  if (params.q) q.set('q', params.q);
  if (params.id) q.set('id', params.id);
  const suffix = q.toString();
  return `/workspace/v2${suffix ? `?${suffix}` : ''}`;
}
function CaseRow({ item, href }: { item: MissionCase; href: string }) {
  return <Link className={styles.item} href={href}>
    <div className={styles.itemmain}>
      <div className={styles.itemtitle}>{item.company}</div>
      <div className={styles.meta}>{item.reference} · {item.requirement}</div>
      <div className={styles.next}>{item.nextAction}</div>
    </div>
    <span className={styles.pill}>{item.stageLabel} · {normal(item.status)}</span>
    <span aria-hidden="true">→</span>
  </Link>;
}
export default async function WorkspaceV2({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, organisationId } = await requireUserContext();
  const dashboard = await getDashboardSnapshot(supabase, organisationId);
  const attention = resolveBusinessAttention(dashboard.attention);
  const query = String(params.q || '').trim().toLowerCase();
  const view = ['all', 'attention', 'delivery', 'waiting'].includes(params.view || '') ? params.view || 'all' : 'all';
  const cases = dashboard.cases;
  const waitingIds = new Set(attention.items.filter(item => item.ownerBucket !== 'internal').map(item => item.id));
  const attentionIds = new Set(attention.items.map(item => item.id));
  const filtered = cases.filter(item => {
    const matches = !query || [item.company, item.reference, item.requirement, item.service].some(v => v.toLowerCase().includes(query));
    if (!matches) return false;
    if (view === 'delivery') return item.kind === 'project';
    if (view === 'attention') return attentionIds.has(item.id);
    if (view === 'waiting') return waitingIds.has(item.id);
    return true;
  });
  const selected = params.id ? cases.find(item => item.id === params.id) : undefined;

  if (selected) return <div className={styles.root}>
    <Link className={styles.back} href={buildHref({ view, q: params.q })}>← All engagements</Link>
    <div className={styles.eyebrow}>Engagement · {selected.reference}</div>
    <h1 className={styles.heading}>{selected.company}</h1>
    <p className={styles.lead}>{selected.requirement}</p>
    <span className={styles.pill}>{selected.stageLabel} · {normal(selected.status)}</span>
    <section className={styles.focus}>
      <div className={styles.eyebrow}>Next indicated action</div>
      <h2>{selected.nextAction}</h2>
      <p className={styles.muted}>This preview uses the existing dashboard presentation. Its next-action summary is not an authorisation to advance the workflow.</p>
      <Link className={styles.button} href={selected.href}>Open governed record →</Link>
    </section>
    <div className={styles.grid}>
      <section className={styles.card}>
        <h3>Current engagement</h3>
        <div className={styles.detail}><div className={styles.eyebrow}>Service</div>{selected.service}</div>
        <div className={styles.detail}><div className={styles.eyebrow}>State</div>{normal(selected.status)}</div>
        <div className={styles.detail}><div className={styles.eyebrow}>Deadline</div>{fmtDate(selected.deadline)}</div>
        {selected.amount && <div className={styles.detail}><div className={styles.eyebrow}>Indicative commercial value</div>{selected.amount}</div>}
      </section>
      <section className={styles.card}>
        <h3>Recent evidence</h3>
        {selected.timeline.length ? selected.timeline.map(event => <div key={event.id} className={styles.detail}>
          <strong>{normal(event.event_type)}</strong>
          <div className={styles.meta}>{fmtDate(event.created_at)}</div>
        </div>) : <p className={styles.muted}>No recent activity available in the dashboard snapshot. Open the governed record for the full audit history.</p>}
      </section>
    </div>
    <p className={styles.meta}>Read-only design preview. Quotation acceptance, payment verification and delivery release remain controlled by the existing workflow.</p>
  </div>;

  return <div className={styles.root}>
    <div className={styles.eyebrow}>Overflow Partner · Workspace 2.0 preview</div>
    <h1 className={styles.heading}>Your active work</h1>
    <p className={styles.lead}>A simpler portfolio over your existing prospects, cases and projects. Open any engagement without leaving the authoritative system behind.</p>
    <div className={styles.summary}>
      <div className={styles.metric}><span className={styles.number}>{cases.length}</span><span className={styles.meta}>Active work items</span></div>
      <div className={styles.metric}><span className={styles.number}>{attention.items.length}</span><span className={styles.meta}>Attention signals</span></div>
      <div className={styles.metric}><span className={styles.number}>{dashboard.activeProjects}</span><span className={styles.meta}>Active projects</span></div>
    </div>
    {dashboard.warnings.length > 0 && <div className={styles.notice}>Some portfolio data could not be loaded. Figures may be incomplete; use existing governed records for decisions.</div>}
    <form method="get" className={styles.toolbar}>
      <input className={styles.search} type="search" name="q" defaultValue={params.q || ''} placeholder="Search company, reference or work" aria-label="Search engagements" />
      {view !== 'all' && <input type="hidden" name="view" value={view} />}
      <button className={styles.button} type="submit">Search</button>
      <Link className={styles.button} href="/workspace/v2">Clear</Link>
    </form>
    <div className={styles.toolbar} aria-label="Filter portfolio">
      {([
        ['all', 'All'],
        ['attention', 'Needs attention'],
        ['delivery', 'Projects'],
        ['waiting', 'Waiting externally'],
      ] as const).map(([key, label]) => <Link key={key} className={`${styles.button} ${view === key ? styles.selected : ''}`} href={buildHref({ view: key, q: params.q })}>{label}</Link>)}
    </div>
    <div className={styles.section}><h2>Engagements</h2><span className={styles.meta}>{filtered.length} shown</span></div>
    <div className={styles.list}>
      {filtered.length ? filtered.map(item => <CaseRow key={`${item.kind}-${item.id}`} item={item} href={buildHref({ view, q: params.q, id: item.id })} />) : <div className={styles.empty}>No records match this view. Try another filter or search.</div>}
    </div>
    <p className={styles.meta} style={{ marginTop: 22 }}>Read-only branch preview. The portfolio is based on the current dashboard snapshot and may omit older records because repository queries are capped. No workflow actions are performed here.</p>
  </div>;
}
