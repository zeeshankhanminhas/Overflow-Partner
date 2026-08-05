import Link from 'next/link';
import { generateControlledDocumentAction } from '@/app/workspace/documents/generate-actions';
import { requireUserContext } from '@/lib/auth/context';
import { getWorkspaceDocument, type WorkspaceDocumentSlug } from './documentRegistry';

type Item = {
  slug: WorkspaceDocumentSlug;
  reason: string;
  enabled: boolean;
  requiredNow?: boolean;
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

  return <section className="stage-documents" aria-labelledby={`${context}-stage-documents`}>
    <header className="stage-documents__header">
      <div>
        <p className="vp-label">Stage documents · {stageLabel}</p>
        <h2 id={`${context}-stage-documents`}>Documents required where the work happens</h2>
        <p className="vp-subtitle">Generate from governed data, review the controlled version and keep the complete record attached to this {context}.</p>
      </div>
      <Link href="/workspace/documents" className="button secondary">Open document registry</Link>
    </header>

    <div className="stage-documents__summary" aria-label="Document state summary">
      <span><strong>{required.length}</strong> Required now</span>
      <span><strong>{available.length}</strong> Available</span>
      <span><strong>{generatedItems.length}</strong> Generated</span>
      <span><strong>{blocked.length}</strong> Blocked</span>
    </div>

    <div className="stage-documents__groups">
      {required.length ? <DocumentGroup title="Required now" state="required" items={required} context={context} recordId={recordId} quoteId={quoteId} returnTo={returnTo}/> : null}
      {available.length ? <DocumentGroup title="Available at this stage" state="available" items={available} context={context} recordId={recordId} quoteId={quoteId} returnTo={returnTo}/> : null}

      {generatedItems.length ? <section className="stage-documents__group">
        <div className="stage-documents__group-title"><h3>Generated at this stage</h3><span>{generatedItems.length}</span></div>
        <div className="stage-documents__list">
          {generatedItems.map(({ item, document }) => {
            const definition = getWorkspaceDocument(item.slug);
            if (!definition) return null;
            return <article className="stage-document-row is-generated" key={document.id}>
              <span className="stage-document-row__icon" aria-hidden="true">▤</span>
              <div className="stage-document-row__copy">
                <div className="stage-document-row__title"><h4>{definition.title}</h4><span>{document.status.replaceAll('_', ' ')}</span></div>
                <p>{document.reference} · v{document.version} · Generated {new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(document.created_at))}</p>
              </div>
              <Link className="button secondary" href={documentUrl(document, context, recordId)}>Open</Link>
            </article>;
          })}
        </div>
      </section> : null}

      {blocked.length ? <section className="stage-documents__group">
        <div className="stage-documents__group-title"><h3>Blocked</h3><span>{blocked.length}</span></div>
        <div className="stage-documents__list">
          {blocked.map((item) => {
            const definition = getWorkspaceDocument(item.slug);
            if (!definition) return null;
            return <article className="stage-document-row is-blocked" key={item.slug}>
              <span className="stage-document-row__icon" aria-hidden="true">⌁</span>
              <div className="stage-document-row__copy">
                <div className="stage-document-row__title"><h4>{definition.title}</h4><span>Blocked</span></div>
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
            <div className="stage-document-row__title"><h4>{definition.title}</h4><span>{state === 'required' ? 'Required now' : 'Available'}</span></div>
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
