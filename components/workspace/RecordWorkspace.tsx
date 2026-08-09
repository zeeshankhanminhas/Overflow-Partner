import type { ReactNode } from 'react';

type RecordWorkspaceProps = {
  header: ReactNode;
  stateStrip: ReactNode;
  readiness: ReactNode;
  nextAction: ReactNode;
  summary: ReactNode;
  evidence?: ReactNode;
  activities?: ReactNode;
  communications?: ReactNode;
  history?: ReactNode;
  olderDocuments?: ReactNode;
  metadata?: ReactNode;
  audit?: ReactNode;
  notices?: ReactNode;
  className?: string;
};

function Slot({ title, children, className = '' }: { title: string; children?: ReactNode; className?: string }) {
  if (!children) return null;
  return <section className={`record-workspace__slot ${className}`.trim()}>
    <p className="record-workspace__eyebrow">{title}</p>
    {children}
  </section>;
}

function Disclosure({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  if (!children) return null;
  return <details className="record-workspace__disclosure">
    <summary>
      <span><strong>{title}</strong>{description ? <small>{description}</small> : null}</span>
      <i aria-hidden="true">+</i>
    </summary>
    <div className="record-workspace__disclosure-body">{children}</div>
  </details>;
}

export default function RecordWorkspace({
  header,
  stateStrip,
  readiness,
  nextAction,
  summary,
  evidence,
  activities,
  communications,
  history,
  olderDocuments,
  metadata,
  audit,
  notices,
  className = '',
}: RecordWorkspaceProps) {
  const hasCurrentWork = Boolean(activities || communications);
  const hasSecondaryContext = Boolean(history || olderDocuments || metadata || audit);

  return <section className={`record-workspace ${className}`.trim()}>
    <header className="record-workspace__header">{header}</header>
    {notices ? <div className="record-workspace__notices">{notices}</div> : null}

    <section className="record-workspace__state" aria-label="Record state">
      {stateStrip}
    </section>

    <section className="record-workspace__group record-workspace__group--decision" aria-labelledby="record-decision-area">
      <div className="record-workspace__group-heading">
        <p id="record-decision-area">Decision</p>
        <span>What needs attention and what to do next</span>
      </div>
      <div className="record-workspace__decision-grid">
        <Slot title="Readiness" className="record-workspace__slot--readiness">{readiness}</Slot>
        <Slot title="Next action" className="record-workspace__slot--action">{nextAction}</Slot>
        <Slot title="Summary" className="record-workspace__slot--summary">{summary}</Slot>
      </div>
    </section>

    {hasCurrentWork ? <section className="record-workspace__group" aria-labelledby="record-current-stage-work">
      <div className="record-workspace__group-heading">
        <p id="record-current-stage-work">Current work</p>
        <span>Work relevant to this stage</span>
      </div>
      <div className="record-workspace__primary-work">
        {activities ? <Slot title="Activities" className="record-workspace__slot--primary-work">{activities}</Slot> : null}
        {communications ? <Disclosure title="Communications" description="Open correspondence when you need it">{communications}</Disclosure> : null}
      </div>
    </section> : null}

    {evidence ? <section className="record-workspace__group record-workspace__group--evidence" aria-labelledby="record-controlled-evidence">
      <div className="record-workspace__group-heading">
        <p id="record-controlled-evidence">Required documents</p>
        <span>Controlled evidence for this stage</span>
      </div>
      <Slot title="Documents" className="record-workspace__slot--evidence">{evidence}</Slot>
    </section> : null}

    {hasSecondaryContext ? <section className="record-workspace__group record-workspace__group--secondary" aria-labelledby="record-secondary-context">
      <div className="record-workspace__group-heading">
        <p id="record-secondary-context">More context</p>
        <span>Details you can open when needed</span>
      </div>
      <div className="record-workspace__secondary-stack">
        <Disclosure title="History" description="Previous record events">{history}</Disclosure>
        <Disclosure title="Older documents" description="Documents outside the current working set">{olderDocuments}</Disclosure>
        <Disclosure title="Metadata" description="Record and system identifiers">{metadata}</Disclosure>
        <Disclosure title="Audit" description="Governance and change history">{audit}</Disclosure>
      </div>
    </section> : null}
  </section>;
}
