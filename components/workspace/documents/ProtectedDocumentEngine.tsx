import DocumentEngineIndex from './DocumentEngineIndex';
import DocumentEngineViewer from './DocumentEngineViewer';
import MobileDocumentReviewShell from './MobileDocumentReviewShell';
import { getWorkspaceDocument, type WorkspaceDocumentSlug } from './documentRegistry';

type Props = { mode: 'index' } | { mode: 'viewer'; document: WorkspaceDocumentSlug };

export default function ProtectedDocumentEngine(props: Props) {
  if (props.mode === 'index') return <DocumentEngineIndex />;
  const document = getWorkspaceDocument(props.document);
  return <MobileDocumentReviewShell title={document?.title || 'Overflow Partner document'} status={document?.dataStatus === 'live-backed' ? 'Live-backed' : document?.dataStatus === 'legacy-preview' ? 'Legacy preview' : 'Preview only'}><DocumentEngineViewer slug={props.document} /></MobileDocumentReviewShell>;
}
