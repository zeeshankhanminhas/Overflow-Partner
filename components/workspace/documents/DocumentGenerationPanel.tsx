import { generateControlledDocumentAction } from '@/app/workspace/documents/generate-actions';
import { getWorkspaceDocument, type WorkspaceDocumentSlug } from './documentRegistry';

type Item = { slug: WorkspaceDocumentSlug; reason: string; enabled: boolean; blockedReason?: string };

type Props = {
  context: 'case' | 'project';
  recordId: string;
  quoteId?: string | null;
  returnTo: string;
  items: Item[];
};

export default function DocumentGenerationPanel({ context, recordId, quoteId, returnTo, items }: Props) {
  if (!items.length) return null;
  return <section className="vp-object" style={{marginTop:20}}>
    <div className="vp-section-title">
      <div><p className="vp-label">Controlled publications</p><h2>Generate from the governed record</h2><p className="vp-subtitle">Each action registers a draft document, assigns its reference and revision, and opens the live-adapted publication.</p></div>
    </div>
    <div className="vp-list">
      {items.map((item) => {
        const definition = getWorkspaceDocument(item.slug);
        if (!definition) return null;
        return <div className="vp-row" key={item.slug}>
          <div><h3>{definition.title}</h3><p>{item.enabled ? item.reason : item.blockedReason || item.reason}</p></div>
          <div className="vp-row-status">{item.enabled ? 'Available' : 'Locked'}</div>
          <div>
            {item.enabled ? <form action={generateControlledDocumentAction}>
              <input type="hidden" name="document_slug" value={item.slug}/>
              <input type="hidden" name={context === 'case' ? 'lead_id' : 'project_id'} value={recordId}/>
              {quoteId ? <input type="hidden" name="quote_id" value={quoteId}/> : null}
              <input type="hidden" name="return_to" value={returnTo}/>
              <button className="button">Generate document</button>
            </form> : <strong>Complete prior stage</strong>}
          </div>
        </div>;
      })}
    </div>
  </section>;
}
