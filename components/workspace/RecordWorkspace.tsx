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
  return <section className={`record-workspace ${className}`.trim()}>
    <header className="record-workspace__header">{header}</header>
    {notices ? <div className="record-workspace__notices">{notices}</div> : null}

    <section className="record-workspace__state" aria-label="Record state">
      {stateStrip}
    </section>

    <section className="record-workspace__group" aria-labelledby="record-decision-area">
      <div className="record-workspace__group-heading">
        <p id="record-decision-area">Decision area</p>
        <span>Readiness · next permitted action · summary</span>
      </div>
      <div className="record-workspace__decision-grid">
        <Slot title="Readiness" className="record-workspace__slot--readiness">{readiness}</Slot>
        <Slot title="Next permitted action" className="record-workspace__slot--action">{nextAction}</Slot>
        <Slot title="Summary" className="record-workspace__slot--summary">{summary}</Slot>
      </div>
    </section>

    {(evidence || activities || communications) ? <section className="record-workspace__group" aria-labelledby="record-current-stage-work">
      <div className="record-workspace__group-heading">
        <p id="record-current-stage-work">Current-stage work</p>
        <span>Only information relevant to the current governed state</span>
      </div>
      <div className="record-workspace__work-grid">
        <Slot title="Relevant evidence">{evidence}</Slot>
        <Slot title="Relevant activities">{activities}</Slot>
        <Slot title="Relevant communications">{communications}</Slot>
      </div>
    </section> : null}

    {(history || olderDocuments || metadata || audit) ? <section className="record-workspace__group record-workspace__group--secondary" aria-labelledby="record-secondary-context">
      <div className="record-workspace__group-heading">
        <p id="record-secondary-context">Secondary context</p>
        <span>History, older evidence, metadata and audit trail</span>
      </div>
      <div className="record-workspace__secondary-grid">
        <Slot title="History">{history}</Slot>
        <Slot title="Older documents">{olderDocuments}</Slot>
        <Slot title="Metadata">{metadata}</Slot>
        <Slot title="Audit">{audit}</Slot>
      </div>
    </section> : null}
  </section>;
}
