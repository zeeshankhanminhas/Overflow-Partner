import Link from 'next/link';
import { documentMeetsStatus, matchesDocumentType, type StageDocumentRequirement } from '@/lib/lifecycle/config';
import { workspaceLabel } from '@/lib/presentation/vocabulary';

type DocumentRecord = {
  id: string;
  title?: string | null;
  reference?: string | null;
  document_type?: string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export default function StageDocumentGuide({
  title,
  purpose,
  requirements,
  documents,
  registryHref,
}: {
  title: string;
  purpose: string;
  requirements: StageDocumentRequirement[];
  documents: DocumentRecord[];
  registryHref: string;
}) {
  const resolved = requirements.map(requirement => {
    const matches = documents.filter(document => matchesDocumentType(document.document_type, requirement));
    const document = matches.sort((a,b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())[0];
    const meets = document ? documentMeetsStatus(document.status, requirement.minimumStatus) : false;
    return { requirement, document, meets };
  });
  const required = resolved.filter(item => item.requirement.required);
  const satisfied = required.filter(item => item.meets).length;
  const missing = required.length - satisfied;

  return <section className="stage-documents">
    <header className="stage-documents__header">
      <div><p className="vp-label">Stage document intelligence</p><h2>{title}</h2><p className="vp-subtitle">{purpose}</p></div>
      <Link className="button secondary" href={registryHref}>Open registry</Link>
    </header>
    <div className="stage-documents__summary">
      <span><strong>{requirements.length}</strong> expected</span>
      <span><strong>{required.length}</strong> required</span>
      <span><strong>{satisfied}</strong> satisfied</span>
      <span><strong>{missing}</strong> blocking</span>
    </div>
    <div className="stage-documents__groups">
      <div className="stage-documents__group">
        <div className="stage-documents__group-title"><h3>Documents for this stage</h3><span>{requirements.length}</span></div>
        <div className="stage-documents__list">
          {resolved.map(({ requirement, document, meets }) => {
            const state = document ? (meets ? 'is-generated' : 'is-required') : (requirement.required ? 'is-blocked' : 'is-required');
            const stateLabel = document ? (meets ? workspaceLabel(document.status || '', 'document') : `Needs ${requirement.minimumStatus}`) : (requirement.required ? 'Required' : 'Optional');
            return <article key={requirement.key} className={`stage-document-row ${state}`}>
              <span className="stage-document-row__icon">▤</span>
              <div className="stage-document-row__copy">
                <div className="stage-document-row__title"><h4>{requirement.label}</h4><span>{stateLabel}</span></div>
                <p>{requirement.description}</p>
                {document ? <p>{document.reference || document.title || 'Controlled document'} · Minimum state: {requirement.minimumStatus}</p> : <p>No matching controlled document exists yet · Minimum state: {requirement.minimumStatus}</p>}
              </div>
              {document ? <Link className="button secondary" href={`/workspace/documents/${document.id}`}>Open</Link> : <Link className="button secondary" href={registryHref}>Generate</Link>}
            </article>;
          })}
        </div>
      </div>
    </div>
  </section>;
}
