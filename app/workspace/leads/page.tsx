import Link from 'next/link';
import LeadForm from '@/components/workspace/LeadForm';
import { requireUserContext } from '@/lib/auth/context';
import { listWorkflowCases } from '@/lib/orchestration/service';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';
import { workspaceLabel } from '@/lib/presentation/vocabulary';

type View = 'all' | 'assessment' | 'partner-review' | 'partner-pricing' | 'commercial-review' | 'client-quotes';

const viewMeta: Record<View,{kicker:string;title:string;subtitle:string}> = {
  all: { kicker: 'Cases', title: 'Engineering work in motion.', subtitle: 'Open a case to see its current state and complete the one decision that moves it forward.' },
  assessment: { kicker: 'Assess', title: 'Cases requiring technical definition.', subtitle: 'Cases remain here while technical scope, feasibility and execution evidence are being established.' },
  'partner-review': { kicker: 'Assess · Partner review', title: 'Cases ready for execution-partner review.', subtitle: 'Approved technical scopes that require partner feasibility, capacity or technical evidence.' },
  'partner-pricing': { kicker: 'Commercial · Partner pricing', title: 'Cases with partner pricing received.', subtitle: 'External delivery cost and lead-time evidence ready for the commercial decision.' },
  'commercial-review': { kicker: 'Commercial · Review', title: 'Cases at commercial review.', subtitle: 'Approved partner cost is being converted into the controlled selling position.' },
  'client-quotes': { kicker: 'Commercial · Client quotes', title: 'Cases at client quotation.', subtitle: 'Draft, issued or concluded client quotations remain attached to their Case 360 record.' },
};

export default async function LeadsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const requested = String(params.view || 'all');
  const view: View = ['assessment','partner-review','partner-pricing','commercial-review','client-quotes'].includes(requested) ? requested as View : 'all';
  const meta = viewMeta[view];
  const { supabase, organisationId } = await requireUserContext();
  const [workflows, companies, contacts] = await Promise.all([
    listWorkflowCases(supabase, organisationId),
    listCompanies(supabase, organisationId),
    listContacts(supabase, organisationId),
  ]);

  const filtered = workflows.filter((workflow) => {
    if (view === 'all') return true;
    if (view === 'assessment') return ['lead','technical_intake'].includes(workflow.stage) && !workflow.project;
    if (view === 'partner-review') return workflow.stage === 'technical_intake' && workflow.technicalIntake?.status === 'approved' && !workflow.project;
    if (view === 'partner-pricing') return workflow.stage === 'partner_pricing' && !workflow.project;
    if (view === 'commercial-review') return workflow.stage === 'commercial_review' && !workflow.project;
    if (view === 'client-quotes') return workflow.stage === 'client_quote' && !workflow.project;
    return true;
  });

  const openCases = workflows.filter((workflow) => !['won','lost'].includes(workflow.lead.status) && !workflow.project);
  const assessmentCount = workflows.filter((workflow) => ['lead','technical_intake'].includes(workflow.stage) && !workflow.project).length;
  const commercialCount = workflows.filter((workflow) => ['partner_pricing','commercial_review','client_quote'].includes(workflow.stage) && !workflow.project).length;

  return <section className="vp-page">
    <header className="vp-header">
      <div><p className="vp-kicker">{meta.kicker}</p><h1>{meta.title}</h1><p className="vp-subtitle">{meta.subtitle}</p></div>
      <div className="vp-toolbar"><details><summary>Exceptional entry</summary><div className="vp-toolbar-panel">{companies.length ? <LeadForm companies={companies} contacts={contacts} /> : <p>Create a company before adding a direct case.</p>}</div></details></div>
    </header>

    {params.created ? <div className="vp-callout"><strong>Case created</strong><p>The direct case is now available below.</p></div> : null}
    {params.converted ? <div className="vp-callout"><strong>Prospect converted</strong><p>The qualified enquiry is now a governed case.</p></div> : null}
    {params.error ? <div className="vp-callout"><strong>Action could not be completed</strong><p>{String(params.error)}</p></div> : null}

    <section className="vp-object vp-object--hero">
      <p className="vp-label">Case position</p>
      <div className="vp-compact-metrics">
        <div className="vp-metric"><span>Open cases</span><strong>{openCases.length}</strong></div>
        <div className="vp-metric"><span>Assessment</span><strong>{assessmentCount}</strong></div>
        <div className="vp-metric"><span>Commercial</span><strong>{commercialCount}</strong></div>
      </div>
    </section>

    <section>
      <div className="vp-section-title"><div><p className="vp-label">Filtered operating register</p><h2>{view === 'all' ? 'Live cases' : meta.kicker}</h2></div>{view !== 'all' ? <Link href="/workspace/leads">View all cases</Link> : null}</div>
      <div className="vp-list">
        {filtered.length === 0 ? <div className="vp-empty">No cases currently match this lifecycle view.</div> : filtered.map((workflow) => {
          const lead = workflow.lead;
          return <Link href={`/workspace/leads/${lead.id}`} className="vp-row" key={lead.id}>
            <div><h3>{lead.title || lead.company_name}</h3><p>{lead.company_name}{lead.contact_name ? ` · ${lead.contact_name}` : ''}</p></div>
            <div className="vp-row-status">{workspaceLabel(workflow.stage, 'lead')}</div>
            <div><strong>Open Case 360 →</strong></div>
          </Link>;
        })}
      </div>
    </section>
  </section>;
}
