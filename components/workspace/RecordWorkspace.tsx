import type { ReactNode } from 'react';
import { ProductProvenance } from '@/components/workspace/ProductUI';
import OperatingStatePanel from '@/components/workspace/OperatingStatePanel';
import { ContextActions, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
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
  const hasCurrentWork = Boolean(activities);
  const hasContext = Boolean(communications || history || olderDocuments || metadata || audit);
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

    {hasContext ? <div className="record-workspace__context-bar">
      <span>Context · inspect without leaving this record</span>
      <ContextActions>
        {communications ? <WorkspaceDrawer triggerLabel="Messages" eyebrow="Record context" title="Messages" description="Correspondence attached to this record. Close the drawer to return to the same operating position.">{communications}</WorkspaceDrawer> : null}
        {history ? <WorkspaceDrawer triggerLabel="History" eyebrow="Record context" title="History" description="Previous business events for this record. Current truth stays on the main surface.">{history}</WorkspaceDrawer> : null}
        {olderDocuments ? <WorkspaceDrawer triggerLabel="Older documents" eyebrow="Record context" title="Older documents" description="Evidence outside the current working set.">{olderDocuments}</WorkspaceDrawer> : null}
        {metadata ? <WorkspaceDrawer triggerLabel="Record details" eyebrow="Record context" title="Record details" description="Identifiers, references and supporting metadata.">{metadata}</WorkspaceDrawer> : null}
        {audit ? <WorkspaceDrawer triggerLabel="Audit" eyebrow="Governance" title="Audit trail" description="Governance and change history. This is traceability, not the current workflow.">{audit}</WorkspaceDrawer> : null}
      </ContextActions>
    </div> : null}

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
        <Slot id="record-activities" title="Live work" className="record-workspace__slot--primary-work">{activities}</Slot>
      </div>
    </section> : null}

    {evidence ? <section className="record-workspace__group record-workspace__group--evidence" aria-labelledby="record-controlled-evidence">
      <div className="record-workspace__group-heading">
        <p id="record-controlled-evidence">Evidence</p>
        <span>Documents and recorded evidence supporting the current stage</span>
      </div>
      <Slot id="record-documents" title="Current evidence" className="record-workspace__slot--evidence">{evidence}</Slot>
    </section> : null}
  </section>;
}
