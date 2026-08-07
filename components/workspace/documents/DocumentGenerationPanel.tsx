import Link from 'next/link';
import { generateControlledDocumentAction } from '@/app/workspace/documents/generate-actions';
import { requireUserContext } from '@/lib/auth/context';
import { getWorkspaceDocument, type WorkspaceDocumentSlug } from './documentRegistry';

type MinimumStatus = 'draft' | 'signed' | 'approved' | 'issued';

type Item = {
  slug: WorkspaceDocumentSlug;
  reason: string;
  enabled: boolean;
  requiredNow?: boolean;
  minimumStatus?: MinimumStatus;
  blockedReason?: string;
};

type Props = {
  context: 'case' | 'project';
  recordId: string;
  quoteId?: string | null;
  returnTo: string;
  stageLabel: string;
  items: Item[];
};

type GeneratedDocument = {
  id: string;
  document_type: string;
  reference: string;
  title: string;
  status: string;
  version: number;
  created_at: string;
};

const statusRank: Record<string, number> = {
  draft: 1,
  in_review: 2,
  changes_requested: 2,
  signed: 3,
  approved: 4,
  issued: 5,
  published: 5,
  archived: 6,
};

function meetsMinimumStatus(status: string, minimum: MinimumStatus = 'draft') {
  return (statusRank[status] || 0) >= (statusRank[minimum] || 0);
}

function documentUrl(document: GeneratedDocument, context: Props['context'], recordId: string) {
  const contextQuery = context === 'case' ? `case=${recordId}` : `project=${recordId}`;
  return `/workspace/documents/templates/${document.document_type}?${contextQuery}&document_record=${document.id}`;
}

export default async function DocumentGenerationPanel({ context, recordId, quoteId, returnTo, stageLabel, items }: Props) {
  if (!items.length) return null;

  const { supabase, organisationId } = await requireUserContext();
  const ownershipColumn = context === 'case' ? 'lead_id' : 'project_id';
  const { data } = await supabase
    .from('documents')
    .select('id,document_type,reference,title,status,version,created_at')
    .eq('organisation_id', organisationId)
    .eq(ownershipColumn, recordId)
    .order('created_at', { ascending: false });

  const generated = (data || []) as GeneratedDocument[];
  const latestByType = new Map<string, GeneratedDocument>();
  for (const document of generated) {
    if (!latestByType.has(document.document_type)) latestByType.set(document.document_type, document);
  }

  const required = items.filter((item) => item.requiredNow && !latestByType.has(item.slug));
  const available = items.filter((item) => item.enabled && !item.requiredNow && !latestByType.has(item.slug));
  const blocked = items.filter((item) => !item.enabled && !latestByType.has(item.slug));
  const generatedItems = items
    .map((item) => ({ item, document: latestByType.get(item.slug) }))
    .filter((entry): entry is { item: Item; document: GeneratedDocument } => Boolean(entry.document));
  const actionRequired = generatedItems.filter(({ item, document }) => item.requiredNow && !meetsMinimumStatus(document.status, item.minimumStatus || 'draft'));
  const satisfied = generatedItems.filter(({ item, document }) => !item.requiredNow || meetsMinimumStatus(document.status, item.minimumStatus || 'draft'));
  const blockingCount = required.length + actionRequired.length + blocked.filter(item => item.requiredNow).length;

  return <section className="stage-documents" aria-labelledby={`${context}-stage-documents`}>
    <header className="stage-documents__header">
      <div>
        <p className="vp-label">Stage documents · {stageLabel}</p>
        <h2 id={`${context}-stage-documents`}>Documents required where the work happens</h2>
        <p className="vp-subtitle">This panel reads the live controlled-document registry. A generated document only satisfies the stage when it reaches the minimum governed status required for progression.</p>
      </div>
      <Link href={`/workspace/documents?${context === 'case' ? 'lead' : 'project'}=${recordId}`} className="button secondary">Open document registry</Link>
    </header>

    <div className="stage-documents__summary" aria-label="Document state summary">
      <span><strong>{required.length + actionRequired.length}</strong> Action required</span>
      <span><strong>{available.length}</strong> Available</span>
      <span><strong>{satisfied.length}</strong> Satisfied</span>
      <span><strong>{blockingCount}</strong> Blocking</span>
    </div>

    <div className="stage-documents__groups">
      {required.length ? <DocumentGroup title="Required now · not generated" state="required" items={required} context={context} recordId={recordId} quoteId={quoteId} returnTo={returnTo}/> : null}

      {actionRequired.length ? <section className="stage-documents__group">
        <div className="stage-documents__group-title"><h3>Generated · governance action required</h3><span>{actionRequired.length}</span></div>
        <div className="stage-documents__list">
          {actionRequired.map(({ item, document }) => {
            const definition = getWorkspaceDocument(item.slug);
            if (!definition) return null;
            return <article className="stage-document-row is-required" key={document.id}>
              <span className="stage-document-row__icon" aria-hidden="true">▤</span>
              <div className="stage-document-row__copy">
                <div className="stage-document-row__title"><h4>{definition.title}</h4><span>{document.status.replaceAll('_',' ')}</span></div>
                <p>{document.reference} · v{document.version} · Minimum required state: {item.minimumStatus || 'draft'}.</p>
                <p>{item.reason}</p>
              </div>
              <Link className="button" href={documentUrl(document, context, recordId)}>Continue control</Link>
            </article>;
          })}
        </div>
      </section> : null}

      {available.length ? <DocumentGroup title="Available at this stage" state="available" items={available} context={context} recordId={recordId} quoteId={quoteId} returnTo={returnTo}/> : null}

      {satisfied.length ? <section className="stage-documents__group">
        <div className="stage-documents__group-title"><h3>Evidence available</h3><span>{satisfied.length}</span></div>
        <div className="stage-documents__list">
          {satisfied.map(({ item, document }) => {
            const definition = getWorkspaceDocument(item.slug);
            if (!definition) return null;
            return <article className="stage-document-row is-generated" key={document.id}>
              <span className="stage-document-row__icon" aria-hidden="true">✓</span>
              <div className="stage-document-row__copy">
                <div className="stage-document-row__title"><h4>{definition.title}</h4><span>{document.status.replaceAll('_', ' ')}</span></div>
                <p>{document.reference} · v{document.version} · Generated {new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(document.created_at))}</p>
                {item.requiredNow ? <p>Stage requirement satisfied · minimum state {item.minimumStatus || 'draft'}.</p> : null}
              </div>
              <Link className="button secondary" href={documentUrl(document, context, recordId)}>Open</Link>
            </article>;
          })}
        </div>
      </section> : null}

      {blocked.length ? <section className="stage-documents__group">
        <div className="stage-documents__group-title"><h3>Locked by prior evidence</h3><span>{blocked.length}</span></div>
        <div className="stage-documents__list">
          {blocked.map((item) => {
            const definition = getWorkspaceDocument(item.slug);
            if (!definition) return null;
            return <article className="stage-document-row is-blocked" key={item.slug}>
              <span className="stage-document-row__icon" aria-hidden="true">⌁</span>
              <div className="stage-document-row__copy">
                <div className="stage-document-row__title"><h4>{definition.title}</h4><span>Locked</span></div>
                <p>{item.blockedReason || item.reason}</p>
              </div>
              <strong>Complete prior evidence</strong>
            </article>;
          })}
        </div>
      </section> : null}
    </div>
  </section>;
}

function DocumentGroup({ title, state, items, context, recordId, quoteId, returnTo }: {
  title: string;
  state: 'required' | 'available';
  items: Item[];
  context: Props['context'];
  recordId: string;
  quoteId?: string | null;
  returnTo: string;
}) {
  return <section className="stage-documents__group">
    <div className="stage-documents__group-title"><h3>{title}</h3><span>{items.length}</span></div>
    <div className="stage-documents__list">
      {items.map((item) => {
        const definition = getWorkspaceDocument(item.slug);
        if (!definition) return null;
        return <article className={`stage-document-row is-${state}`} key={item.slug}>
          <span className="stage-document-row__icon" aria-hidden="true">▤</span>
          <div className="stage-document-row__copy">
            <div className="stage-document-row__title"><h4>{definition.title}</h4><span>{state === 'required' ? `Required · ${item.minimumStatus || 'draft'}` : 'Available'}</span></div>
            <p>{item.reason}</p>
          </div>
          <form action={generateControlledDocumentAction}>
            <input type="hidden" name="document_slug" value={item.slug}/>
            <input type="hidden" name={context === 'case' ? 'lead_id' : 'project_id'} value={recordId}/>
            {quoteId ? <input type="hidden" name="quote_id" value={quoteId}/> : null}
            <input type="hidden" name="return_to" value={returnTo}/>
            <button className="button" type="submit">Generate</button>
          </form>
        </article>;
      })}
    </div>
  </section>;
}
