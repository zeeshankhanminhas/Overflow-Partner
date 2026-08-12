import Link from 'next/link';
import type { ResolvedEvidenceState, WorkspaceDocument } from '@/lib/workspace/state';

type Props = {
  recordType: 'case' | 'project';
  recordId: string;
  resolved: ResolvedEvidenceState[];
  contextualDocuments?: WorkspaceDocument[];
};

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Compatibility requirement presenter.
 *
 * Wave 8 makes DocumentGenerationPanel the canonical normal-path
 * `Documents needed now` surface. Where older routes still render this
 * component, it must project only unresolved requirements and stay quiet
 * once the requirement is satisfied. Completed/contextual documents belong
 * in the registry/history rather than a second current-decision presenter.
 */
export default function ControlledEvidence({ recordType, recordId, resolved }: Props) {
  const blocking = resolved.filter(item => item.blocking);
  if (blocking.length === 0) return null;

  const registryHref = recordType === 'project' ? `/workspace/documents?project=${recordId}` : `/workspace/documents?lead=${recordId}`;

  return <section className="controlled-evidence" aria-label="Documents needed now">
    <div className="controlled-evidence__list">
      {blocking.map(item => <article className="controlled-evidence__row is-blocking" key={item.key}>
        <div>
          <small>Required now</small>
          <strong>{item.label}</strong>
          <p>{item.operatorState}</p>
          {item.document?.reference ? <span>{item.document.reference}</span> : null}
        </div>
        <div className="controlled-evidence__action">
          <span>{item.exists ? statusLabel(item.currentStatus) : 'Missing'}</span>
          {item.document
            ? <Link className="button secondary" href={`/workspace/documents/${item.document.id}`}>{item.action === 'review' ? 'Review document' : 'Open document'}</Link>
            : <Link className="button secondary" href={registryHref}>Open documents</Link>}
        </div>
      </article>)}
    </div>
  </section>;
}
