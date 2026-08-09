import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';

type RegistryDocument = {
  id: string;
  document_type: string;
  reference: string;
  title: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string | null;
  lead_id: string | null;
  project_id: string | null;
};

type Props = {
  leadId?: string | null;
  projectId?: string | null;
};

function canonicalDocumentSlug(value: string) {
  const aliases: Record<string, string> = {
    client_quote: 'client-quote',
    client_requirements: 'client-requirements',
    scope_of_work: 'scope-of-work',
    statement_of_work: 'statement-of-work',
    commercial_approval: 'commercial-approval',
    partner_technical_assessment_report: 'partner-technical-assessment-report',
    vendor_safe_package: 'vendor-safe-package',
    handover_pack: 'handover-pack',
    completion_report: 'completion-report',
    document_register: 'document-register',
  };
  return aliases[value] || value.replaceAll('_', '-');
}

function openUrl(document: RegistryDocument) {
  const context = document.project_id
    ? `project=${document.project_id}`
    : `case=${document.lead_id}`;
  return `/workspace/documents/templates/${canonicalDocumentSlug(document.document_type)}?${context}&document_record=${document.id}`;
}

export default async function DocumentEngineIndex({ leadId, projectId }: Props) {
  const { supabase, organisationId } = await requireUserContext();
  const contextType = projectId ? 'project' : leadId ? 'case' : null;
  const contextId = projectId || leadId || null;

  let query = supabase
    .from('documents')
    .select('id,document_type,reference,title,status,version,created_at,updated_at,lead_id,project_id')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);
  else if (leadId) query = query.eq('lead_id', leadId);

  const { data, error } = await query;
  const documents = (data || []) as RegistryDocument[];
  const drafts = documents.filter((document) => document.status === 'draft').length;
  const approved = documents.filter((document) => ['approved','issued','published'].includes(document.status)).length;
  const contextLabel = contextType === 'project' ? 'Project 360 evidence' : contextType === 'case' ? 'Case 360 evidence' : 'Controlled document registry';

  return <div className="document-registry">
    <section className="document-suite-hero">
      <p>{contextLabel}</p>
      <h1>{contextType ? 'Evidence attached to this operating record.' : 'Every publication, version and approval in one auditable register.'}</h1>
      <p>{contextType
        ? `This view is scoped to the current ${contextType === 'project' ? 'Project 360' : 'Case 360'} record. Documents remain generated and governed from the workflow stage where they are required.`
        : 'Documents are generated from Case 360 or Project 360 when the workflow requires them. This registry provides visibility, review and control without initiating work outside its operational context.'}</p>
      {contextType && contextId ? <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:18}}>
        <Link className="button secondary" href={contextType === 'project' ? `/workspace/projects/${contextId}` : `/workspace/leads/${contextId}`}>Back to {contextType === 'project' ? 'Project 360' : 'Case 360'}</Link>
        <Link className="button secondary" href="/workspace/documents">View global registry</Link>
      </div> : null}
    </section>

    <section className="document-registry__metrics" aria-label="Document registry summary">
      <article><span>{contextType ? 'Context records' : 'Total records'}</span><strong>{documents.length}</strong></article>
      <article><span>Drafts</span><strong>{drafts}</strong></article>
      <article><span>Approved or issued</span><strong>{approved}</strong></article>
    </section>

    {error ? <section className="card"><h2>Registry unavailable</h2><p>{error.message}</p></section> : null}

    {!error && documents.length === 0 ? <section className="document-registry__empty">
      <p className="vp-label">No controlled publications yet</p>
      <h2>{contextType ? `No evidence has been generated for this ${contextType === 'project' ? 'project' : 'case'} yet.` : 'Generate the first document from its case or project stage.'}</h2>
      <p>{contextType ? 'Return to the operating record and generate the required document from its current lifecycle stage.' : 'The registry will populate automatically as governed documents are created in the workflow.'}</p>
      <div>{contextType && contextId
        ? <Link className="button" href={contextType === 'project' ? `/workspace/projects/${contextId}` : `/workspace/leads/${contextId}`}>Return to operating record</Link>
        : <><Link className="button" href="/workspace/leads">Open cases</Link><Link className="button secondary" href="/workspace/projects">Open projects</Link></>}</div>
    </section> : null}

    {documents.length ? <section className="document-registry__table-wrap">
      <div className="document-registry__heading">
        <div><p className="vp-label">Publication register</p><h2>{contextType ? `${contextType === 'project' ? 'Project' : 'Case'} evidence` : 'Controlled records'}</h2></div>
        <span>{documents.length} documents</span>
      </div>
      <div className="document-registry__table-scroll">
        <table>
          <thead><tr><th>Reference</th><th>Document</th><th>Context</th><th>Version</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
          <tbody>
            {documents.map((document) => <tr key={document.id}>
              <td><strong>{document.reference}</strong></td>
              <td><span>{document.title}</span><small>{canonicalDocumentSlug(document.document_type).replaceAll('-',' ')}</small></td>
              <td>{document.project_id ? 'Project 360' : 'Case 360'}</td>
              <td>v{document.version}</td>
              <td><span className={`document-status document-status--${document.status}`}>{document.status.replaceAll('_',' ')}</span></td>
              <td>{new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(document.created_at))}</td>
              <td><Link className="button secondary" href={openUrl(document)}>Open</Link></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section> : null}
  </div>;
}
