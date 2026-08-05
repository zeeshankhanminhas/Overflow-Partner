import DocumentEngineIndex from './DocumentEngineIndex';
import DocumentEngineViewer from './DocumentEngineViewer';
import MobileDocumentReviewShell from './MobileDocumentReviewShell';
import { getWorkspaceDocument, type WorkspaceDocumentSlug } from './documentRegistry';
import type { AdaptedDocumentData } from './documentAdapter';

type Props =
  | { mode: 'index' }
  | { mode: 'viewer'; document: WorkspaceDocumentSlug; adapted?: AdaptedDocumentData; documentRecordId?: string; documentStatus?: string };

export default function ProtectedDocumentEngine(props: Props) {
  if (props.mode === 'index') return <DocumentEngineIndex />;
  const document = getWorkspaceDocument(props.document);
  const status = props.documentStatus || (props.adapted?.connected
    ? props.adapted.issueState
    : document?.dataStatus === 'live-backed'
      ? 'Live-backed'
      : document?.dataStatus === 'legacy-preview'
        ? 'Legacy preview'
        : 'Preview only');
  return <MobileDocumentReviewShell title={document?.title || 'Overflow Partner document'} status={status} documentRecordId={props.documentRecordId}>
    <DocumentEngineViewer slug={props.document} adapted={props.adapted} />
  </MobileDocumentReviewShell>;
}
