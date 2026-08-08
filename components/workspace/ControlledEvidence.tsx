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

export default function ControlledEvidence({ recordType, recordId, resolved, contextualDocuments = [] }: Props) {
  const blocking = resolved.filter(item => item.blocking);
  const satisfied = resolved.filter(item => item.satisfied);
  const resolvedIds = new Set(resolved.map(item => item.document?.id).filter(Boolean));
  const contextual = contextualDocuments.filter(document => !resolvedIds.has(document.id)).slice(0, 5);
  const registryHref = recordType === 'project' ? `/workspace/documents?project=${recordId}` : `/workspace/documents?lead=${recordId}`;

  return <div className="controlled-evidence">
    <div className="controlled-evidence__metrics">
      <span><strong>{blocking.length}</strong> blocking</span>
      <span><strong>{satisfied.length}</strong> satisfied</span>
      <span><strong>{contextual.length}</strong> contextual</span>
    </div>

    {resolved.length === 0 ? <div className="vp-empty">
      <strong>No explicit stage-document blockers.</strong>
      <p>Current governed documents remain available below.</p>
    </div> : <div className="controlled-evidence__list">
      {resolved.map(item => <article className={`controlled-evidence__row ${item.blocking ? 'is-blocking' : 'is-satisfied'}`} key={item.key}>
        <div>
          <small>{item.blocking ? 'Required now' : 'Satisfied'}</small>
          <strong>{item.label}</strong>
          <p>{item.operatorState}</p>
          {item.document?.reference ? <span>{item.document.reference}</span> : null}
        </div>
        <div className="controlled-evidence__action">
          <span>{item.exists ? statusLabel(item.currentStatus) : 'Missing'}</span>
          {item.document ? <Link className="button secondary" href={`/workspace/documents/${item.document.id}`}>{item.action === 'review' ? 'Review' : 'Open'}</Link> : <Link className="button secondary" href={registryHref}>Generate</Link>}
        </div>
      </article>)}
    </div>}

    {contextual.length > 0 ? <details className="vp-disclosure controlled-evidence__context">
      <summary>Other current evidence · {contextual.length}</summary>
      <div className="controlled-evidence__list">
        {contextual.map(document => <article className="controlled-evidence__row" key={document.id}>
          <div><strong>{document.title || document.document_type || 'Controlled document'}</strong><p>{document.reference || 'No reference'}</p></div>
          <div className="controlled-evidence__action"><span>{statusLabel(String(document.status || 'draft'))}</span><Link className="button secondary" href={`/workspace/documents/${document.id}`}>Open</Link></div>
        </article>)}
      </div>
    </details> : null}

    <p className="project-os-help"><Link href={registryHref}>Open complete evidence registry →</Link></p>
  </div>;
}
