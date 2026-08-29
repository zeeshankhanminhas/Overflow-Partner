import { getWorkspaceDocument, type WorkspaceDocumentSlug } from './documentRegistry';
import { documentLanguage } from './documentLanguage';
import type { AdaptedDocumentData } from './documentAdapter';

function humanStatus(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MobileDocumentReviewView({
  slug,
  adapted,
  status,
}: {
  slug: WorkspaceDocumentSlug;
  adapted?: AdaptedDocumentData;
  status: string;
}) {
  const document = getWorkspaceDocument(slug);
  const language = documentLanguage[slug];
  if (!document || !language) return null;

  const reference = adapted?.reference || `OP-${slug.replaceAll('-', '-').toUpperCase()}-001`;
  const revision = adapted?.revision || 'A';

  return <article className="mobile-document-review" aria-label="Mobile document review">
    <section className="mobile-document-hero">
      <p className="mobile-document-eyebrow">Document</p>
      <h2>{document.title}</h2>
      <p>{language.purpose}</p>
      <div className="mobile-document-status-row">
        <span>{humanStatus(status)}</span>
        <small>Revision {revision}</small>
      </div>
    </section>

    <section className="mobile-document-summary">
      <div><span>Reference</span><strong>{reference}</strong></div>
      <div><span>Subject</span><strong>{adapted?.subject || 'No work selected'}</strong></div>
      <div><span>Source</span><strong>{adapted?.sourceLabel || 'Preview'}</strong></div>
      <div><span>Visibility</span><strong>{language.visibility}</strong></div>
    </section>

    {adapted?.warnings.length ? <section className="mobile-document-blockers">
      <p className="mobile-document-eyebrow">Needs attention</p>
      <ul>{adapted.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </section> : null}

    {adapted?.facts.length ? <section className="mobile-document-section">
      <div className="mobile-document-section-heading"><p className="mobile-document-eyebrow">Key details</p><h3>Document information</h3></div>
      <div className="mobile-document-facts">{adapted.facts.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
    </section> : null}

    <section className="mobile-document-section">
      <div className="mobile-document-section-heading"><p className="mobile-document-eyebrow">Contents</p><h3>Review document</h3></div>
      <div className="mobile-document-accordions">
        {language.sections.map((section, sectionIndex) => <details key={section.title} open={sectionIndex === 0}>
          <summary><span>{String(sectionIndex + 1).padStart(2, '0')}</span><strong>{section.title}</strong></summary>
          <div>{section.entries.map((entry) => <section key={entry.heading}><h4>{entry.heading}</h4><p>{entry.body}</p></section>)}</div>
        </details>)}
      </div>
    </section>

    <section className="mobile-document-control">
      <p className="mobile-document-eyebrow">Release</p>
      <h3>Ready to issue</h3>
      <p>{language.closingStatement}</p>
      <div><span>Before issue</span><strong>{language.issueCondition}</strong></div>
    </section>
  </article>;
}
