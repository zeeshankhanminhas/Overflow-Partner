import Link from 'next/link';
import { workspaceDocuments, type WorkspaceDocumentItem } from './documentRegistry';

function statusLabel(status: WorkspaceDocumentItem['dataStatus']) {
  if (status === 'live-backed') return 'Live-backed';
  if (status === 'legacy-preview') return 'Legacy preview';
  return 'Preview only';
}
function issueState(status: WorkspaceDocumentItem['dataStatus']) { return status === 'live-backed' ? 'Controlled record' : 'Issue blocked'; }
function documentType(document: WorkspaceDocumentItem) {
  if (document.slug.includes('invoice')) return 'Invoice';
  if (document.slug.includes('quote')) return 'Quote';
  if (document.slug.includes('report') || document.slug.includes('review')) return 'Report';
  if (document.slug.includes('register')) return 'Register';
  if (document.slug.includes('email')) return 'Template set';
  if (document.slug.includes('package') || document.slug.includes('pack')) return 'Package';
  return 'Controlled document';
}

export default function DocumentEngineIndex() {
  return <div className="document-suite-index">
    <section className="document-suite-hero">
      <p>Protected document engine</p>
      <h1>Controlled publications for the complete engineering journey.</h1>
      <p>Live-backed documents inherit governed workspace records. Preview-only templates remain blocked from final issue until their adapters and approval evidence are complete.</p>
    </section>
    <section className="document-suite-grid" aria-label="Workspace documents">
      {workspaceDocuments.map((document) => <Link key={document.slug} href={`/workspace/documents/templates/${document.slug}`} className="document-suite-card">
        <span className="document-suite-card-icon" aria-hidden="true">▤</span>
        <div className="document-suite-card-copy">
          <small>{documentType(document)}</small>
          <h2>{document.title}</h2>
          <p>{document.description}</p>
        </div>
        <div className="document-suite-card-state">
          <span>{statusLabel(document.dataStatus)}</span>
          <strong>{issueState(document.dataStatus)} →</strong>
        </div>
      </Link>)}
    </section>
  </div>;
}
