import type { ReactNode } from 'react';
import { statusTone, type OpdsStatus } from '@/lib/opds/tokens';

export function OpdsBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: OpdsStatus }) {
  return <span className={`opds-badge opds-badge--${tone}`}>{children}</span>;
}

export function WorkflowStatus({ status }: { status: string }) {
  const tone = statusTone[status] ?? 'neutral';
  return <OpdsBadge tone={tone}>{status.replaceAll('_', ' ')}</OpdsBadge>;
}

export function OpdsPanel({ eyebrow, title, children, action }: { eyebrow?: string; title?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="opds-panel">
    {(eyebrow || title || action) ? <header className="opds-panel__header"><div>{eyebrow ? <p className="opds-eyebrow">{eyebrow}</p> : null}{title ? <h2 className="opds-panel__title">{title}</h2> : null}</div>{action}</header> : null}
    <div className="opds-panel__body">{children}</div>
  </section>;
}

export function OpdsReference({ children }: { children: ReactNode }) {
  return <span className="opds-reference">{children}</span>;
}

export function OpdsDocumentFrame({ reference, version, status, documentType, title, children, footer }: {
  reference: string; version: number; status: string; documentType: string; title: string; children: ReactNode; footer?: ReactNode;
}) {
  return <article className="opds-document">
    <header className="opds-document__masthead">
      <div className="opds-document__brand"><span className="opds-mark" aria-hidden="true"><i /><b /></span><div><strong>Overflow Partner</strong><small>Engineering capacity, controlled.</small></div></div>
      <dl className="opds-document__control"><div><dt>Reference</dt><dd>{reference}</dd></div><div><dt>Revision</dt><dd>{version}</dd></div><div><dt>Status</dt><dd>{status.replaceAll('_', ' ')}</dd></div></dl>
    </header>
    <div className="opds-document__titleblock"><p className="opds-eyebrow">{documentType}</p><h1>{title}</h1></div>
    <div className="opds-document__content">{children}</div>
    <footer className="opds-document__footer">{footer}</footer>
  </article>;
}
