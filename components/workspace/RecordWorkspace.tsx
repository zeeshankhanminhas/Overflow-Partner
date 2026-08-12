import type { ReactNode } from 'react';
import { ProductProvenance } from '@/components/workspace/ProductUI';

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

function Slot({ id, title, children, className = '' }: { id?: string; title: string; children?: ReactNode; className?: string }) {
  if (!children) return null;
  return <section id={id} className={`record-workspace__slot ${className}`.trim()}>
    <p className="record-workspace__eyebrow">{title}</p>
    {children}
  </section>;
}

function Disclosure({ id, title, description, children }: { id?: string; title: string; description?: string; children?: ReactNode }) {
  if (!children) return null;
  return <details id={id} className="record-workspace__disclosure">
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
    <header id="record-header" className="record-workspace__header">{header}</header>
    {notices ? <div id="record-feedback" className="record-workspace__notices" data-continuity-notice>{notices}</div> : null}

    <section id="record-state" className="record-workspace__state" aria-label="Current operating state">
      {stateStrip}
      <div className="record-workspace__provenance" aria-label="Evidence provenance key">
        <ProductProvenance source="system" />
        <ProductProvenance source="op" />
        <ProductProvenance source="partner" />
        <ProductProvenance source="client" />
      </div>
    </section>

    <section className="record-workspace__group record-workspace__group--decision" aria-labelledby="record-decision-area">
      <div className="record-workspace__group-heading">
        <p id="record-decision-area">Operating decision</p>
        <span>One governed next action, supported by the evidence that permits it</span>
      </div>
      <div className="record-workspace__decision-grid">
        <Slot id="record-next-action" title="Next permitted action" className="record-workspace__slot--action">{nextAction}</Slot>
        <Slot id="record-readiness" title="Gate readiness" className="record-workspace__slot--readiness">{readiness}</Slot>
        <Slot id="record-summary" title="Commercial / record summary" className="record-workspace__slot--summary">{summary}</Slot>
      </div>
    </section>

    {hasCurrentWork ? <section className="record-workspace__group" aria-labelledby="record-current-stage-work">
      <div className="record-workspace__group-heading">
        <p id="record-current-stage-work">Current stage work</p>
        <span>Live work and external execution intelligence</span>
      </div>
      <div className="record-workspace__primary-work">
        {activities ? <Slot id="record-activities" title="Operating position" className="record-workspace__slot--primary-work">{activities}</Slot> : null}
        {communications ? <Disclosure id="record-communications" title="Communications" description="Open correspondence only when it is needed for the decision">{communications}</Disclosure> : null}
      </div>
    </section> : null}

    {evidence ? <section className="record-workspace__group record-workspace__group--evidence" aria-labelledby="record-controlled-evidence">
      <div className="record-workspace__group-heading">
        <p id="record-controlled-evidence">Controlled evidence</p>
        <span>Current-stage documents and governed evidence</span>
      </div>
      <Slot id="record-documents" title="Evidence set" className="record-workspace__slot--evidence">{evidence}</Slot>
    </section> : null}

    {hasSecondaryContext ? <section className="record-workspace__group record-workspace__group--secondary" aria-labelledby="record-secondary-context">
      <div className="record-workspace__group-heading">
        <p id="record-secondary-context">Audit context</p>
        <span>Available without competing with the live operating decision</span>
      </div>
      <div className="record-workspace__secondary-stack">
        <Disclosure id="record-history" title="History" description="Previous governed record events">{history}</Disclosure>
        <Disclosure id="record-older-documents" title="Older documents" description="Documents outside the current working set">{olderDocuments}</Disclosure>
        <Disclosure id="record-metadata" title="Metadata" description="Record and system identifiers">{metadata}</Disclosure>
        <Disclosure id="record-audit" title="Audit" description="Governance and change history">{audit}</Disclosure>
      </div>
    </section> : null}
  </section>;
}
