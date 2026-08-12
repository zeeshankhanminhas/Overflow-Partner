import type { ReactNode } from 'react';
import OperatingStatePanel from '@/components/workspace/OperatingStatePanel';
import { ContextDrawer, ProductDisclosure } from '@/components/workspace/InteractionPrimitives';
import type { OperatingPresentation } from '@/lib/presentation/operatingState';

type RecordWorkspaceProps = {
  header: ReactNode;
  stateStrip?: ReactNode;
  readiness?: ReactNode;
  nextAction?: ReactNode;
  summary?: ReactNode;
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
  return <ProductDisclosure summary={<span><strong>{title}</strong>{description ? <small style={{display:'block'}}>{description}</small> : null}</span>} className="record-workspace__disclosure">
    <div id={id}>{children}</div>
  </ProductDisclosure>;
}

function ContextButton({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  if (!children) return null;
  return <ContextDrawer title={title} description={description} triggerLabel={title} triggerTone="secondary">{children}</ContextDrawer>;
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
  const hasDecisionDetails = Boolean(nextAction || summary || readiness);
  const hasCurrentWork = Boolean(activities);
  const hasSecondaryContext = Boolean(stateStrip || communications || history || olderDocuments || metadata || audit);

  return <section className={`record-workspace ${presentation ? 'record-workspace--interpreted' : ''} ${className}`.trim()}>
    <header id="record-header" className="record-workspace__header">{header}</header>
    {notices ? <div id="record-feedback" className="record-workspace__notices" data-continuity-notice>{notices}</div> : null}

    {!presentation && stateStrip ? <section id="record-state" className="record-workspace__state" aria-label="Lifecycle position">{stateStrip}</section> : null}
    {presentation ? <OperatingStatePanel presentation={presentation} /> : null}

    {hasDecisionDetails ? <section className={`record-workspace__group record-workspace__group--decision ${presentation ? 'record-workspace__group--interpreted' : ''}`} aria-labelledby="record-decision-area">
      <div className="record-workspace__group-heading">
        <p id="record-decision-area">{presentation ? 'Current decision' : 'What happens next'}</p>
        <span>{presentation ? 'One action or waiting condition, supported only by facts needed now' : 'Your next action and the evidence needed before you can take it'}</span>
      </div>
      <div className="record-workspace__decision-grid">
        <Slot id="record-next-action" title={presentation ? 'Next' : 'Next action'} className="record-workspace__slot--action">{nextAction}</Slot>
        <Slot id="record-summary" title={presentation ? 'Decision facts' : 'Useful context'} className="record-workspace__slot--summary">{summary}</Slot>
      </div>
      {readiness ? <Disclosure id="record-readiness" title="Unresolved requirements" description="Open only when you need the remaining gate detail">{readiness}</Disclosure> : null}
    </section> : null}

    {hasCurrentWork ? <section className="record-workspace__group" aria-labelledby="record-current-stage-work">
      <div className="record-workspace__group-heading">
        <p id="record-current-stage-work">Current work</p>
        <span>Only the sustained work for the current operating state</span>
      </div>
      <Slot id="record-activities" title="Working area" className="record-workspace__slot--primary-work">{activities}</Slot>
    </section> : null}

    {evidence ? <section className="record-workspace__group record-workspace__group--evidence" aria-labelledby="record-controlled-evidence">
      <div className="record-workspace__group-heading">
        <p id="record-controlled-evidence">Evidence needed now</p>
        <span>Only evidence necessary for the current decision remains on the page</span>
      </div>
      <Slot id="record-documents" title="Current evidence" className="record-workspace__slot--evidence">{evidence}</Slot>
    </section> : null}

    {hasSecondaryContext ? <section className="record-workspace__group record-workspace__group--secondary" aria-labelledby="record-secondary-context">
      <div className="record-workspace__group-heading">
        <p id="record-secondary-context">Context</p>
        <span>Open supporting context without leaving the current operating surface</span>
      </div>
      <div className="record-workspace__context-actions">
        {presentation ? <ContextButton title="Lifecycle" description="Orientation only; the operating state on the page remains authoritative.">{stateStrip}</ContextButton> : null}
        <ContextButton title="Messages" description="Related correspondence and contact context.">{communications}</ContextButton>
        <ContextButton title="History" description="Previous record events and completed changes.">{history}</ContextButton>
        <ContextButton title="Older documents" description="Controlled documents outside the current decision set.">{olderDocuments}</ContextButton>
        <ContextButton title="Details" description="Supporting record detail that is not needed for the current decision.">{metadata}</ContextButton>
        <ContextButton title="Audit" description="Governance and change evidence.">{audit}</ContextButton>
      </div>
    </section> : null}
  </section>;
}
