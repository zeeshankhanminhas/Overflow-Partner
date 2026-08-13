import type { ReactNode } from 'react';
import { ProductProvenance } from '@/components/workspace/ProductUI';
import OperatingStatePanel from '@/components/workspace/OperatingStatePanel';
import type { OperatingPresentation } from '@/lib/presentation/operatingState';

type RecordWorkspaceProps = {
  header: ReactNode;
  stateStrip: ReactNode;
  readiness: ReactNode;
  nextAction: ReactNode;
  summary: ReactNode;
  presentation?: OperatingPresentation;
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
  presentation,
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
  const waitingOnly = Boolean(presentation?.nextAction.kind === 'wait');

  return <section className={`record-workspace ${presentation ? 'record-workspace--interpreted' : ''} ${className}`.trim()}>
    <header id="record-header" className="record-workspace__header">{header}</header>
    {notices ? <div id="record-feedback" className="record-workspace__notices" data-continuity-notice>{notices}</div> : null}

    <section id="record-state" className="record-workspace__state" aria-label="Current state">
      {stateStrip}
      <div className="record-workspace__provenance" aria-label="Evidence source key">
        <ProductProvenance source="system" />
        <ProductProvenance source="op" />
        <ProductProvenance source="partner" />
        <ProductProvenance source="client" />
      </div>
    </section>

    {presentation ? <OperatingStatePanel presentation={presentation} /> : null}

    <section className={`record-workspace__group record-workspace__group--decision ${presentation ? 'record-workspace__group--interpreted' : ''}`} aria-labelledby="record-decision-area">
      <div className="record-workspace__group-heading">
        <p id="record-decision-area">{presentation ? 'Current checks' : 'What happens next'}</p>
        <span>{presentation ? 'Only the checks relevant to the current stage' : 'Your next action and the evidence needed before you can take it'}</span>
      </div>
      <div className={`record-workspace__decision-grid ${waitingOnly ? 'record-workspace__decision-grid--waiting' : ''}`}>
        {waitingOnly ? null : <Slot id="record-next-action" title={presentation ? 'Next step' : 'Next action'} className="record-workspace__slot--action">{nextAction}</Slot>}
        <Slot id="record-readiness" title={presentation ? 'Requirements' : 'Ready to proceed?'} className="record-workspace__slot--readiness">{readiness}</Slot>
        <Slot id="record-summary" title="Key details" className="record-workspace__slot--summary">{summary}</Slot>
      </div>
    </section>

    {hasCurrentWork ? <section className="record-workspace__group" aria-labelledby="record-current-stage-work">
      <div className="record-workspace__group-heading">
        <p id="record-current-stage-work">Current work</p>
        <span>Live work and external updates</span>
      </div>
      <div className="record-workspace__primary-work">
        {activities ? <Slot id="record-activities" title="Live work" className="record-workspace__slot--primary-work">{activities}</Slot> : null}
        {communications ? <Disclosure id="record-communications" title="Messages" description="Open correspondence only when you need it">{communications}</Disclosure> : null}
      </div>
    </section> : null}

    {evidence ? <section className="record-workspace__group record-workspace__group--evidence" aria-labelledby="record-controlled-evidence">
      <div className="record-workspace__group-heading">
        <p id="record-controlled-evidence">Evidence</p>
        <span>Documents and recorded evidence supporting the current stage</span>
      </div>
      <Slot id="record-documents" title="Current evidence" className="record-workspace__slot--evidence">{evidence}</Slot>
    </section> : null}

    {hasSecondaryContext ? <section className="record-workspace__group record-workspace__group--secondary" aria-labelledby="record-secondary-context">
      <div className="record-workspace__group-heading">
        <p id="record-secondary-context">History & audit</p>
        <span>Open this only when you need background or traceability</span>
      </div>
      <div className="record-workspace__secondary-stack">
        <Disclosure id="record-history" title="History" description="Previous record events">{history}</Disclosure>
        <Disclosure id="record-older-documents" title="Older documents" description="Documents outside the current working set">{olderDocuments}</Disclosure>
        <Disclosure id="record-metadata" title="Record details" description="IDs and system references">{metadata}</Disclosure>
        <Disclosure id="record-audit" title="Audit trail" description="Governance and change history">{audit}</Disclosure>
      </div>
    </section> : null}
  </section>;
}