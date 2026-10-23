import type { ReactNode } from 'react';
import { ProductProvenance } from '@/components/workspace/ProductUI';
import { OperatingState, NextActionRail } from '@/components/workspace/OperationalUI';
import { ContextActions, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { commercialCopy } from '@/lib/presentation/commercialLanguage';
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
  focusMode?: boolean;
};

function Slot({ id, title, children, className = '' }: { id?: string; title: string; children?: ReactNode; className?: string }) {
  if (!children) return null;
  return <section id={id} className={`record-workspace__slot ${className}`.trim()}>
    <p className="record-workspace__eyebrow">{title}</p>
    {children}
  </section>;
}

function ownerLabel(presentation: OperatingPresentation) {
  if (!presentation.waitingOn) return 'Your team';
  if (presentation.waitingOn.actor === 'partner') return 'Delivery Partner';
  if (presentation.waitingOn.actor === 'client') return 'Client';
  return 'Your team';
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
  focusMode = false,
}: RecordWorkspaceProps) {
  const hasCurrentWork = Boolean(activities);
  const hasContext = Boolean(communications || history || olderDocuments || metadata || audit);
  const waitingOnly = Boolean(presentation?.nextAction.kind === 'wait');
  const owner = presentation ? ownerLabel(presentation) : 'Your team';

  // Focus-first is a presentation option, not an alternative workflow.
  // The same governed action, evidence, readiness and audit components are reused.
  if (focusMode) {
    const blocking = presentation?.blockers ?? [];
    const hasBlockers = blocking.length > 0;
    return <section data-surface="record" data-view="focused"
      className={`op-surface op-surface--record record-workspace record-workspace--focused ${className}`.trim()}>
      <header id="record-header" className="record-workspace__header">{header}</header>
      {notices ? <div id="record-feedback" className="record-workspace__notices" data-continuity-notice>{notices}</div> : null}

      <div className="op-focus__body">
        <section className="op-focus__decision" aria-labelledby="op-focus-title">
          <p className="op-focus__eyebrow">What needs to happen next</p>
          <h2 id="op-focus-title">{presentation ? commercialCopy(presentation.nextAction.label) : 'Next action'}</h2>
          {presentation ? <p className="op-focus__why">{commercialCopy(presentation.nextAction.reason || presentation.summary)}</p> : null}
          {presentation?.waitingOn ? <p className="op-focus__owner">Waiting on: {owner} · {commercialCopy(presentation.waitingOn.label)}</p> : null}
          {hasBlockers ? <div className="op-focus__blockers" role="status">
            <strong>Before this can proceed</strong>
            <ul>{blocking.slice(0, 4).map((item, index) => <li key={index}>{commercialCopy(item)}</li>)}</ul>
            {blocking.length > 4 ? <p>{blocking.length - 4} more requirement(s) in the checks below.</p> : null}
          </div> : null}
          <div id="record-next-action" className="op-focus__action">{nextAction}</div>
        </section>

        <details className="op-focus__disclosure" open={hasBlockers}>
          <summary><span>Requirements and readiness</span><span className="op-focus__disclosure-hint">{hasBlockers ? `${blocking.length} blocker(s)` : 'Review checks'}</span></summary>
          <div id="record-readiness" className="op-focus__detail-body">{readiness}</div>
        </details>
        {evidence ? <details className="op-focus__disclosure" open={hasBlockers}>
          <summary><span>Documents and evidence</span><span className="op-focus__disclosure-hint">View controlled records</span></summary>
          <div id="record-documents" className="op-focus__detail-body">{evidence}</div>
        </details> : null}
        {activities ? <details className="op-focus__disclosure">
          <summary><span>Current work</span><span className="op-focus__disclosure-hint">Tasks and delivery updates</span></summary>
          <div id="record-activities" className="op-focus__detail-body">{activities}</div>
        </details> : null}
        <details className="op-focus__disclosure">
          <summary><span>Stage, key facts and history</span><span className="op-focus__disclosure-hint">Supporting context</span></summary>
          <div className="op-focus__detail-body op-focus__context">
            <div id="record-state">{stateStrip}</div>
            <div id="record-summary">{summary}</div>
            {hasContext ? <ContextActions>
              {communications ? <WorkspaceDrawer triggerLabel="Messages" eyebrow="Record context" title="Messages">{communications}</WorkspaceDrawer> : null}
              {history ? <WorkspaceDrawer triggerLabel="Activity" eyebrow="Record context" title="Activity">{history}</WorkspaceDrawer> : null}
              {olderDocuments ? <WorkspaceDrawer triggerLabel="Older documents" eyebrow="Record context" title="Older documents">{olderDocuments}</WorkspaceDrawer> : null}
              {metadata ? <WorkspaceDrawer triggerLabel="Record details" eyebrow="Record context" title="Record details">{metadata}</WorkspaceDrawer> : null}
              {audit ? <WorkspaceDrawer triggerLabel="Audit" eyebrow="Traceability" title="Audit trail">{audit}</WorkspaceDrawer> : null}
            </ContextActions> : null}
          </div>
        </details>
      </div>
    </section>;
  }

  return <section data-surface="record" className={`op-surface op-surface--record record-workspace ${presentation ? 'record-workspace--interpreted' : ''} ${className}`.trim()}>
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

    {presentation ? <OperatingState
      eyebrow="Operating state"
      title={commercialCopy(presentation.headline)}
      record={commercialCopy(presentation.state)}
      reason={commercialCopy(presentation.summary)}
      owner={owner}
      ownerDetail={presentation.waitingOn ? commercialCopy(presentation.waitingOn.label) : undefined}
      tone={presentation.tone}
      nextAction={commercialCopy(presentation.nextAction.label)}
      showStatus={false}
      showActionSummary={false}
    /> : null}

    {hasContext ? <div className="record-workspace__context-bar">
      <ContextActions>
        {communications ? <WorkspaceDrawer triggerLabel="Messages" eyebrow="Record context" title="Messages" description="Correspondence attached to this record. Close the drawer to return to the same operating position.">{communications}</WorkspaceDrawer> : null}
        {history ? <WorkspaceDrawer triggerLabel="Activity" eyebrow="Record context" title="Activity" description="Previous business events for this record. Current truth stays on the main surface.">{history}</WorkspaceDrawer> : null}
        {olderDocuments ? <WorkspaceDrawer triggerLabel="Older documents" eyebrow="Record context" title="Older documents" description="Evidence outside the current working set.">{olderDocuments}</WorkspaceDrawer> : null}
        {metadata ? <WorkspaceDrawer triggerLabel="Record details" eyebrow="Record context" title="Record details" description="Identifiers, references and supporting metadata.">{metadata}</WorkspaceDrawer> : null}
        {audit ? <WorkspaceDrawer triggerLabel="Audit" eyebrow="Traceability" title="Audit trail" description="Change history for traceability. Current work stays on the main surface.">{audit}</WorkspaceDrawer> : null}
      </ContextActions>
    </div> : null}

    <section className={`record-workspace__group record-workspace__group--decision ${presentation ? 'record-workspace__group--interpreted' : ''}`} aria-labelledby="record-decision-area">
      <div className="record-workspace__group-heading">
        <p id="record-decision-area">{presentation ? 'Stage control' : 'What happens next'}</p>
        <span>{presentation ? 'The checks, decision and action relevant to this stage' : 'Your next action and the evidence needed before you can take it'}</span>
      </div>
      <div className={`record-workspace__decision-grid ${waitingOnly ? 'record-workspace__decision-grid--waiting' : ''}`}>
        {waitingOnly ? null : presentation ? <NextActionRail
          title="Next action"
          actionLabel={commercialCopy(presentation.nextAction.label)}
          action={nextAction}
          reason={commercialCopy(presentation.nextAction.reason || presentation.summary)}
          owner={owner}
          consequence={presentation.blockers.length ? `Resolve: ${commercialCopy(presentation.blockers[0])}` : 'The record can move to its next permitted stage.'}
        /> : <Slot id="record-next-action" title="Next action" className="record-workspace__slot--action">{nextAction}</Slot>}
        <Slot id="record-readiness" title={presentation ? 'Requirements' : 'Ready to proceed?'} className="record-workspace__slot--readiness">{readiness}</Slot>
        <Slot id="record-summary" title="Key details" className="record-workspace__slot--summary">{summary}</Slot>
      </div>
    </section>

    {hasCurrentWork ? <section id="record-current-stage-work" className="record-workspace__group" aria-labelledby="record-current-stage-work-label">
      <div className="record-workspace__group-heading">
        <p id="record-current-stage-work-label">Current work</p>
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
      <Slot id="record-documents" title="Current documents" className="record-workspace__slot--evidence">{evidence}</Slot>
    </section> : null}
  </section>;
}
