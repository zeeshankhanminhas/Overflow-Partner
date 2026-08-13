import Link from 'next/link';
import { generateControlledDocumentAction } from '@/app/workspace/documents/generate-actions';
import { requireUserContext } from '@/lib/auth/context';
import { documentSatisfiesRequirement } from '@/lib/workspace/state';
import { getWorkspaceDocument, type WorkspaceDocumentSlug } from './documentRegistry';
import DocumentGenerateButton from './DocumentGenerateButton';

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
  generationError?: string | null;
};

type GeneratedDocument = {
  id: string;
  document_type: string;
  reference: string;
  title: string;
  status: string;
  created_at: string;
};

function documentUrl(document: GeneratedDocument, context: Props['context'], recordId: string) {
  const contextQuery = context === 'case' ? `case=${recordId}` : `project=${recordId}`;
  return `/workspace/documents/templates/${document.document_type}?${contextQuery}&document_record=${document.id}`;
}

/** Canonical normal-path presenter for current controlled-document requirements. */
export default async function DocumentGenerationPanel({ context, recordId, quoteId, returnTo, stageLabel, items, generationError }: Props) {
  if (!items.length && !generationError) return null;

  const { supabase, organisationId } = await requireUserContext();
  const ownershipColumn = context === 'case' ? 'lead_id' : 'project_id';
  const { data } = await supabase
    .from('documents')
    .select('id,document_type,reference,title,status,created_at')
    .eq('organisation_id', organisationId)
    .eq(ownershipColumn, recordId)
    .neq('status', 'superseded')
    .order('created_at', { ascending: false });

  const generated = (data || []) as GeneratedDocument[];
  const latestByType = new Map<string, GeneratedDocument>();
  for (const document of generated) {
    if (!latestByType.has(document.document_type)) latestByType.set(document.document_type, document);
  }

  const missingRequired = items.filter(item => item.requiredNow && item.enabled && !latestByType.has(item.slug));
  const blockedRequired = items.filter(item => item.requiredNow && !item.enabled && !latestByType.has(item.slug));
  const actionRequired = items
    .map(item => ({ item, document: latestByType.get(item.slug) }))
    .filter((entry): entry is { item: Item; document: GeneratedDocument } => Boolean(
      entry.item.requiredNow &&
      entry.document &&
      !documentSatisfiesRequirement(entry.document.status, entry.item.minimumStatus || 'draft'),
    ));

  const actionCount = missingRequired.length + blockedRequired.length + actionRequired.length;
  if (!generationError && actionCount === 0) return null;

  const registryHref = `/workspace/documents?${context === 'case' ? 'lead' : 'project'}=${recordId}`;

  return <section className="stage-documents" aria-labelledby={`${context}-documents-needed-now`}>
    <header className="stage-documents__header">
      <div>
        <p className="vp-label">Documents · {stageLabel}</p>
        <h2 id={`${context}-documents-needed-now`}>Documents needed now</h2>
        <p className="vp-subtitle">Only controlled-document work that affects the current decision appears here. Completed and later-stage documents remain in the registry.</p>
      </div>
      <Link href={registryHref} className="button secondary">Open document registry</Link>
    </header>

    {generationError ? <div data-continuity-notice className="vp-callout" style={{marginBottom:14}}>
      <strong>Document could not be generated</strong>
      <p>{generationError}</p>
    </div> : null}

    {actionCount ? <div className="stage-documents__groups">
      {missingRequired.length ? <DocumentGroup items={missingRequired} context={context} recordId={recordId} quoteId={quoteId} returnTo={returnTo}/> : null}

      {actionRequired.length ? <section className="stage-documents__group">
        <div className="stage-documents__group-title"><h3>Review required</h3><span>{actionRequired.length}</span></div>
        <div className="stage-documents__list">
          {actionRequired.map(({ item, document }) => {
            const definition = getWorkspaceDocument(item.slug);
            if (!definition) return null;
            return <article className="stage-document-row is-required" key={document.id}>
              <span className="stage-document-row__icon" aria-hidden="true">▤</span>
              <div className="stage-document-row__copy">
                <div className="stage-document-row__title"><h4>{definition.title}</h4><span>{document.status.replaceAll('_',' ')}</span></div>
                <p>{document.reference} · Required status: {item.minimumStatus || 'draft'}.</p>
                <p>{item.reason}</p>
              </div>
              <Link className="button" href={documentUrl(document, context, recordId)}>Review document</Link>
            </article>;
          })}
        </div>
      </section> : null}

      {blockedRequired.length ? <section className="stage-documents__group">
        <div className="stage-documents__group-title"><h3>Waiting on earlier requirement</h3><span>{blockedRequired.length}</span></div>
        <div className="stage-documents__list">
          {blockedRequired.map(item => {
            const definition = getWorkspaceDocument(item.slug);
            if (!definition) return null;
            return <article className="stage-document-row is-blocked" key={item.slug}>
              <span className="stage-document-row__icon" aria-hidden="true">⌁</span>
              <div className="stage-document-row__copy">
                <div className="stage-document-row__title"><h4>{definition.title}</h4><span>Not available yet</span></div>
                <p>{item.blockedReason || item.reason}</p>
              </div>
            </article>;
          })}
        </div>
      </section> : null}
    </div> : null}
  </section>;
}

function DocumentGroup({ items, context, recordId, quoteId, returnTo }: {
  items: Item[];
  context: Props['context'];
  recordId: string;
  quoteId?: string | null;
  returnTo: string;
}) {
  return <section className="stage-documents__group">
    <div className="stage-documents__group-title"><h3>Generate required document</h3><span>{items.length}</span></div>
    <div className="stage-documents__list">
      {items.map(item => {
        const definition = getWorkspaceDocument(item.slug);
        if (!definition) return null;
        return <article className="stage-document-row is-required" key={item.slug}>
          <span className="stage-document-row__icon" aria-hidden="true">▤</span>
          <div className="stage-document-row__copy">
            <div className="stage-document-row__title"><h4>{definition.title}</h4><span>Required · {item.minimumStatus || 'draft'}</span></div>
            <p>{item.reason}</p>
          </div>
          <form action={generateControlledDocumentAction}>
            <input type="hidden" name="document_slug" value={item.slug}/>
            <input type="hidden" name={context === 'case' ? 'lead_id' : 'project_id'} value={recordId}/>
            {quoteId ? <input type="hidden" name="quote_id" value={quoteId}/> : null}
            <input type="hidden" name="return_to" value={returnTo}/>
            <DocumentGenerateButton/>
          </form>
        </article>;
      })}
    </div>
  </section>;
}
