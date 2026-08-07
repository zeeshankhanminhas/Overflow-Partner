import Link from 'next/link';
import LeadForm from '@/components/workspace/LeadForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';
import { workspaceLabel } from '@/lib/presentation/vocabulary';

type View = 'all' | 'assessment' | 'partner-review' | 'partner-pricing' | 'commercial-review' | 'client-quotes';
type QueueRow = {
  id: string;
  title: string | null;
  company_name: string;
  contact_name: string | null;
  lead_status: string;
  workflow_stage: string;
  created_at: string;
  total_count: number | string;
};

const PAGE_SIZE = 25;
const viewMeta: Record<View,{kicker:string;title:string;subtitle:string}> = {
  all: { kicker: 'Cases', title: 'Engineering work in motion.', subtitle: 'Open a case to see its current state and complete the one decision that moves it forward.' },
  assessment: { kicker: 'Assess', title: 'Cases requiring technical definition.', subtitle: 'Cases remain here while technical scope, feasibility and execution evidence are being established.' },
  'partner-review': { kicker: 'Assess · Partner review', title: 'Cases ready for execution-partner review.', subtitle: 'Approved technical scopes that require partner feasibility, capacity or technical evidence.' },
  'partner-pricing': { kicker: 'Commercial · Partner pricing', title: 'Cases with partner pricing received.', subtitle: 'External delivery cost and lead-time evidence ready for the commercial decision.' },
  'commercial-review': { kicker: 'Commercial · Review', title: 'Cases at commercial review.', subtitle: 'Approved partner cost is being converted into the controlled selling position.' },
  'client-quotes': { kicker: 'Commercial · Client quotes', title: 'Cases at client quotation.', subtitle: 'Draft, issued or concluded client quotations remain attached to their Case 360 record.' },
};

function pageHref(view: View, page: number) {
  const params = new URLSearchParams();
  if (view !== 'all') params.set('view', view);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return `/workspace/leads${query ? `?${query}` : ''}`;
}

export default async function LeadsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const requested = String(params.view || 'all');
  const view: View = ['assessment','partner-review','partner-pricing','commercial-review','client-quotes'].includes(requested) ? requested as View : 'all';
  const requestedPage = Number.parseInt(String(params.page || '1'), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const meta = viewMeta[view];
  const { supabase, organisationId } = await requireUserContext();

  const [{ data, error }, companies, contacts] = await Promise.all([
    supabase.rpc('op_case_queue', {
      p_organisation_id: organisationId,
      p_view: view,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    listCompanies(supabase, organisationId),
    listContacts(supabase, organisationId),
  ]);
  if (error) throw new Error(`Case queue could not be loaded: ${error.message}`);

  const rows = (data || []) as QueueRow[];
  const total = rows.length ? Number(rows[0].total_count || 0) : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <section className="vp-page">
    <header className="vp-header">
      <div><p className="vp-kicker">{meta.kicker}</p><h1>{meta.title}</h1><p className="vp-subtitle">{meta.subtitle}</p></div>
      <div className="vp-toolbar"><details><summary>Exceptional entry</summary><div className="vp-toolbar-panel">{companies.length ? <LeadForm companies={companies} contacts={contacts} /> : <p>Create a company before adding a direct case.</p>}</div></details></div>
    </header>

    {params.created ? <div className="vp-callout"><strong>Case created</strong><p>The direct case is now available below.</p></div> : null}
    {params.converted ? <div className="vp-callout"><strong>Prospect converted</strong><p>The qualified enquiry is now a governed case.</p></div> : null}
    {params.error ? <div className="vp-callout"><strong>Action could not be completed</strong><p>{String(params.error)}</p></div> : null}

    <section className="vp-object vp-object--hero">
      <p className="vp-label">Queue position</p>
      <div className="vp-compact-metrics">
        <div className="vp-metric"><span>Queue records</span><strong>{total}</strong></div>
        <div className="vp-metric"><span>Page</span><strong>{Math.min(page,totalPages)} / {totalPages}</strong></div>
        <div className="vp-metric"><span>Rows per page</span><strong>{PAGE_SIZE}</strong></div>
      </div>
    </section>

    <section>
      <div className="vp-section-title"><div><p className="vp-label">Paginated operating queue</p><h2>{view === 'all' ? 'Live cases' : meta.kicker}</h2></div>{view !== 'all' ? <Link href="/workspace/leads">View all cases</Link> : null}</div>
      <div className="vp-list">
        {rows.length === 0 ? <div className="vp-empty">No cases currently match this lifecycle view.</div> : rows.map((row) => <Link href={`/workspace/leads/${row.id}`} className="vp-row" key={row.id}>
          <div><h3>{row.title || row.company_name}</h3><p>{row.company_name}{row.contact_name ? ` · ${row.contact_name}` : ''}</p></div>
          <div className="vp-row-status">{workspaceLabel(row.workflow_stage as any, 'lead')}</div>
          <div><strong>Open Case 360 →</strong></div>
        </Link>)}
      </div>
      {totalPages > 1 ? <nav className="vp-pagination" aria-label="Case queue pages" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginTop:20}}>
        <div>{page > 1 ? <Link className="button secondary" href={pageHref(view,page-1)}>← Previous</Link> : <span />}</div>
        <span>Page {Math.min(page,totalPages)} of {totalPages}</span>
        <div>{page < totalPages ? <Link className="button secondary" href={pageHref(view,page+1)}>Next →</Link> : <span />}</div>
      </nav> : null}
    </section>
  </section>;
}
