export type OperatingTone = 'neutral' | 'active' | 'waiting' | 'attention' | 'blocked' | 'complete' | 'critical';
export type OperatingActor = 'internal' | 'partner' | 'client' | 'system' | 'none';
export type OperatingActionKind = 'act' | 'review' | 'record' | 'navigate' | 'wait' | 'approve';

export type OperatingAction = {
  label: string;
  available: boolean;
  kind: OperatingActionKind;
  href?: string;
  reason?: string;
};

export type ApprovalPresentation = {
  required: boolean;
  type: string;
  status: 'not_required' | 'waiting' | 'ready' | 'blocked' | 'approved' | 'rejected';
  owner?: string;
  evidence?: string;
  value?: number;
  currency?: string;
  risk?: 'normal' | 'high' | 'critical';
};

export type EvidencePresentation = {
  required: number;
  complete: number;
  blocking: number;
};

export type OperatingPresentation = {
  state: string;
  headline: string;
  summary: string;
  tone: OperatingTone;
  waitingOn: { actor: OperatingActor; label: string } | null;
  nextAction: OperatingAction;
  blockers: string[];
  warnings: string[];
  completed: string[];
  primaryActions: OperatingAction[];
  approval?: ApprovalPresentation;
  evidence?: EvidencePresentation;
};

export type ActionStateLike = {
  label: string;
  permitted: boolean;
  blockers?: string[];
  message?: string;
};

export type ProjectPresentationInput = {
  stage: string;
  ready: boolean;
  readinessReasons?: string[];
  partnerControlled?: boolean;
  partnerName?: string | null;
  executionState?: string | null;
  executionCycle?: number | null;
  commencementConfirmed?: boolean;
  currentCycleDeliverySubmitted?: boolean;
  latestPartnerUpdateAt?: string | null;
  deliveryItems?: number;
  deliveryWorkOpen?: number;
  openPartnerExceptions?: number;
  requiredDocuments?: number;
  completedDocuments?: number;
  evidenceBlockers?: string[];
  financialAuthorised?: boolean;
  clientOutcome?: string | null;
  executionHref?: string;
  deliveryHref?: string;
  documentsHref?: string;
  financeHref?: string;
};

export type AcquisitionPresentationInput = {
  currentState: string;
  nextAction: string;
  nextReason: string;
  actionKey: string;
  waitingExternally?: boolean;
};

export type CasePresentationInput = {
  currentState: string;
  nextAction: string;
  reason: string;
  actionKey: string;
  blocker?: string | null;
  evidenceBlockers?: string[];
  historical?: boolean;
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function includesAny(value: string, candidates: string[]) {
  const lowered = value.toLowerCase();
  return candidates.some(candidate => lowered.includes(candidate));
}

export function humaniseOperatingReason(value: string) {
  const source = clean(value);
  if (!source) return '';
  const replacements: Array<[RegExp, string]> = [
    [/Execution Partner commencement declaration is required\.?/gi, 'Partner commencement has not been confirmed yet.'],
    [/A current-cycle Execution Partner delivery submission is required(?: for Internal Review)?\.?/gi, 'The current execution cycle has not been delivered yet.'],
    [/Execution Partner delivery submission is required before internal review\.?/gi, 'The current execution cycle has not been delivered yet.'],
    [/Execution Partner delivery files are required before internal review\.?/gi, 'The Partner delivery package still needs engineering files.'],
    [/Client transmittal record is required\.?/gi, 'The approved delivery has not been sent to the client yet.'],
    [/Client Review outcome is required\.?/gi, 'A client outcome has not been recorded yet.'],
    [/At least one delivery activity is required\.?/gi, 'A delivery plan has not been created yet.'],
    [/Financial authorisation:/gi, 'Commercial release:'],
    [/controlled document/gi, 'document'],
  ];
  return replacements.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), source);
}

export function resolvePresentedAction(state: ActionStateLike): OperatingAction {
  const blockers = (state.blockers ?? []).map(humaniseOperatingReason).filter(Boolean);
  const raw = clean(state.label);
  const blockerText = blockers.join(' ').toLowerCase();

  if (includesAny(blockerText, ['current execution cycle has not been delivered', 'partner delivery required'])) {
    return {
      label: 'Await Partner delivery',
      available: false,
      kind: 'wait',
      reason: 'The Execution Partner has not submitted the current-cycle delivery package yet.',
    };
  }
  if (includesAny(blockerText, ['partner commencement has not been confirmed', 'partner commencement required'])) {
    return {
      label: 'Await Partner commencement',
      available: false,
      kind: 'wait',
      reason: 'The Execution Partner must confirm commencement before delivery work can start.',
    };
  }
  if (includesAny(blockerText, ['client outcome has not been recorded'])) {
    return {
      label: 'Record client outcome',
      available: false,
      kind: 'record',
      reason: 'Record the client response when written evidence is available.',
    };
  }

  const labels: Record<string, string> = {
    'Await Partner commencement': 'Await Partner commencement',
    'Record controlled client transmittal': 'Send approved delivery to client',
    'Record Client Review outcome': 'Record client outcome',
    'Authorise execution': 'Release to Execution Partner',
    'Start engineering work': 'Await Partner commencement',
    'Submit for internal review': 'Review Partner delivery',
    'Approve for client issue': 'Approve for client release',
    'Record client issue': 'Send approved delivery to client',
    'Start client review': 'Open client review',
    'Record completion': 'Record client outcome',
    'Return to work in progress': 'Return to Partner execution',
    'Create governed Case 360': 'Create Case 360',
    'Request governed partner review': 'Send Partner assessment',
    'Wait for partner response': 'Await Partner assessment',
    'Review and record Go / No-Go': 'Record Go / No-Go',
  };
  const label = labels[raw] || raw;
  const wait = /^Await\b|^Waiting\b/.test(label);
  const approve = /^Approve\b/.test(label);
  const record = /^Record\b|^Send approved/.test(label);
  const review = /^Review\b/.test(label);
  return {
    label,
    available: Boolean(state.permitted) && !wait,
    kind: wait ? 'wait' : approve ? 'approve' : record ? 'record' : review ? 'review' : 'act',
    reason: clean(state.message) || blockers[0],
  };
}

function projectEvidence(input: ProjectPresentationInput): EvidencePresentation | undefined {
  const required = Math.max(0, Number(input.requiredDocuments ?? 0));
  if (required === 0) return undefined;
  const complete = Math.max(0, Math.min(required, Number(input.completedDocuments ?? 0)));
  const blocking = Math.max(0, Number(input.evidenceBlockers?.length ?? Math.max(0, required - complete)));
  return { required, complete, blocking };
}

function projectBlockers(input: ProjectPresentationInput) {
  return [...new Set([...(input.readinessReasons ?? []), ...(input.evidenceBlockers ?? [])]
    .map(humaniseOperatingReason)
    .filter(Boolean))];
}

export function resolveProjectPresentation(input: ProjectPresentationInput): OperatingPresentation {
  const stage = clean(input.stage) || 'mobilisation';
  const partner = clean(input.partnerName) || 'Execution Partner';
  const cycle = Math.max(1, Number(input.executionCycle ?? 1));
  const openDelivery = Math.max(0, Number(input.deliveryWorkOpen ?? 0));
  const deliveryItems = Math.max(0, Number(input.deliveryItems ?? 0));
  const openExceptions = Math.max(0, Number(input.openPartnerExceptions ?? 0));
  const blockers = projectBlockers(input);
  const evidence = projectEvidence(input);
  const completed: string[] = [];
  if (input.commencementConfirmed) completed.push('Partner commencement confirmed');
  if (input.currentCycleDeliverySubmitted) completed.push(`Cycle ${String(cycle).padStart(2, '0')} delivery received`);
  if (evidence && evidence.blocking === 0) completed.push('Required controlled documents complete');
  if (input.financialAuthorised) completed.push('Commercial release authorised');

  const base = {
    blockers,
    warnings: [] as string[],
    completed,
    evidence,
    approval: undefined as ApprovalPresentation | undefined,
  };

  if (stage === 'mobilisation') {
    const ready = Boolean(input.ready) && blockers.length === 0;
    return {
      ...base,
      state: 'Mobilisation',
      headline: ready ? 'Project is ready for controlled release' : 'Prepare the project for controlled release',
      summary: ready ? 'Owner, programme, controlled scope and commercial authority are in place.' : 'Complete only the missing mobilisation controls before releasing work.',
      tone: ready ? 'active' : 'attention',
      waitingOn: { actor: 'internal', label: 'Overflow Partner' },
      nextAction: { label: ready ? 'Release to Execution Partner' : 'Complete mobilisation', available: ready, kind: ready ? 'act' : 'review', reason: blockers[0] },
      primaryActions: [
        ...(input.documentsHref ? [{ label: 'Open documents', href: input.documentsHref, available: true, kind: 'navigate' as const }] : []),
        ...(input.financeHref ? [{ label: 'Open commercial control', href: input.financeHref, available: true, kind: 'navigate' as const }] : []),
      ],
    };
  }

  if (stage === 'ready_for_execution') {
    if (!input.commencementConfirmed) {
      return {
        ...base,
        state: 'Ready to release',
        headline: `${partner} has the approved delivery basis`,
        summary: 'Release is configured. The next lifecycle event belongs to the Execution Partner.',
        tone: 'waiting',
        waitingOn: { actor: 'partner', label: partner },
        nextAction: { label: 'Await Partner commencement', available: false, kind: 'wait', reason: 'The Partner must confirm commencement from the secure execution workspace.' },
        primaryActions: input.executionHref ? [{ label: 'Open Partner workspace', href: input.executionHref, available: true, kind: 'navigate' }] : [],
      };
    }
    return {
      ...base,
      state: 'Ready to release',
      headline: 'Partner commencement is confirmed',
      summary: 'The commencement evidence is present and the project can enter controlled execution.',
      tone: input.ready ? 'active' : 'attention',
      waitingOn: { actor: 'internal', label: 'Overflow Partner' },
      nextAction: { label: 'Continue to Partner execution', available: Boolean(input.ready), kind: 'act', reason: blockers[0] },
      primaryActions: input.executionHref ? [{ label: 'Open Partner workspace', href: input.executionHref, available: true, kind: 'navigate' }] : [],
    };
  }

  if (stage === 'in_progress') {
    if (openExceptions > 0) {
      return {
        ...base,
        state: 'Partner execution',
        headline: `${partner} is executing Cycle ${String(cycle).padStart(2, '0')}`,
        summary: `${openExceptions} Partner exception${openExceptions === 1 ? '' : 's'} need resolution before this cycle can progress.`,
        tone: 'blocked',
        waitingOn: { actor: 'internal', label: 'Overflow Partner' },
        nextAction: { label: 'Resolve Partner exception', available: true, kind: 'review', href: input.executionHref, reason: blockers[0] },
        primaryActions: [
          ...(input.executionHref ? [{ label: 'Open Partner execution', href: input.executionHref, available: true, kind: 'navigate' as const }] : []),
          ...(input.deliveryHref ? [{ label: 'Open Delivery Control', href: input.deliveryHref, available: true, kind: 'navigate' as const }] : []),
        ],
      };
    }
    if (!input.currentCycleDeliverySubmitted) {
      const workDetail = openDelivery > 0 ? `${openDelivery} Delivery Control item${openDelivery === 1 ? '' : 's'} remain active.` : deliveryItems > 0 ? 'Delivery Control is active.' : 'No delivery package has been submitted yet.';
      return {
        ...base,
        state: 'Partner execution',
        headline: `${partner} is executing Cycle ${String(cycle).padStart(2, '0')}`,
        summary: `${workDetail} Internal Review begins only after the current-cycle Partner delivery is received.`,
        tone: 'waiting',
        waitingOn: { actor: 'partner', label: partner },
        nextAction: { label: 'Await Partner delivery', available: false, kind: 'wait', reason: 'No current-cycle Partner delivery package has been submitted.' },
        primaryActions: [
          ...(input.executionHref ? [{ label: 'Open Partner workspace', href: input.executionHref, available: true, kind: 'navigate' as const }] : []),
          ...(input.deliveryHref ? [{ label: 'Open Delivery Control', href: input.deliveryHref, available: true, kind: 'navigate' as const }] : []),
        ],
      };
    }
    if (openDelivery > 0) {
      return {
        ...base,
        state: 'Partner delivery received',
        headline: `Cycle ${String(cycle).padStart(2, '0')} delivery is received`,
        summary: `The Partner package is present, but ${openDelivery} Delivery Control item${openDelivery === 1 ? '' : 's'} must be cleared before Internal Review.`,
        tone: 'attention',
        waitingOn: { actor: 'internal', label: 'Overflow Partner' },
        nextAction: { label: 'Complete Delivery Control', available: true, kind: 'review', href: input.deliveryHref, reason: blockers[0] },
        primaryActions: input.deliveryHref ? [{ label: 'Open Delivery Control', href: input.deliveryHref, available: true, kind: 'navigate' }] : [],
      };
    }
    return {
      ...base,
      state: 'Partner delivery received',
      headline: `Cycle ${String(cycle).padStart(2, '0')} is ready for internal review`,
      summary: 'The current-cycle Partner delivery is present and Delivery Control is clear.',
      tone: input.ready ? 'active' : 'attention',
      waitingOn: { actor: 'internal', label: 'Overflow Partner' },
      nextAction: { label: 'Review Partner delivery', available: Boolean(input.ready), kind: 'review', reason: blockers[0] },
      primaryActions: [
        ...(input.executionHref ? [{ label: 'Open Partner delivery', href: input.executionHref, available: true, kind: 'navigate' as const }] : []),
        ...(input.deliveryHref ? [{ label: 'Open Delivery Control', href: input.deliveryHref, available: true, kind: 'navigate' as const }] : []),
      ],
    };
  }

  if (stage === 'internal_review') {
    const ready = Boolean(input.ready) && blockers.length === 0;
    return {
      ...base,
      state: 'Internal review',
      headline: ready ? 'Delivery is ready for client release approval' : 'Internal review is in progress',
      summary: ready ? 'Technical review and controlled evidence are complete.' : 'Resolve the remaining review evidence before approving client release.',
      tone: ready ? 'active' : 'attention',
      waitingOn: { actor: 'internal', label: 'Overflow Partner' },
      nextAction: { label: ready ? 'Approve for client release' : 'Complete internal review', available: ready, kind: 'approve', reason: blockers[0] },
      approval: { required: true, type: 'Client release approval', status: ready ? 'ready' : 'blocked', owner: 'Overflow Partner', evidence: blockers[0] },
      primaryActions: [
        ...(input.documentsHref ? [{ label: 'Open review evidence', href: input.documentsHref, available: true, kind: 'navigate' as const }] : []),
        ...(input.deliveryHref ? [{ label: 'Open Delivery Control', href: input.deliveryHref, available: true, kind: 'navigate' as const }] : []),
      ],
    };
  }

  if (stage === 'partner_correction') {
    return {
      ...base,
      state: 'Partner correction',
      headline: `${partner} is correcting Cycle ${String(cycle).padStart(2, '0')}`,
      summary: input.currentCycleDeliverySubmitted ? 'A revised delivery has been received and can be assessed.' : 'The correction cycle remains with the Execution Partner until a revised package is submitted.',
      tone: input.currentCycleDeliverySubmitted ? 'attention' : 'waiting',
      waitingOn: input.currentCycleDeliverySubmitted ? { actor: 'internal', label: 'Overflow Partner' } : { actor: 'partner', label: partner },
      nextAction: input.currentCycleDeliverySubmitted
        ? { label: 'Review revised Partner delivery', available: Boolean(input.ready), kind: 'review', reason: blockers[0] }
        : { label: 'Await revised Partner delivery', available: false, kind: 'wait', reason: 'The current correction cycle has not been resubmitted yet.' },
      primaryActions: [
        ...(input.executionHref ? [{ label: 'Open Partner workspace', href: input.executionHref, available: true, kind: 'navigate' as const }] : []),
        ...(input.deliveryHref ? [{ label: 'Open Delivery Control', href: input.deliveryHref, available: true, kind: 'navigate' as const }] : []),
      ],
    };
  }

  if (stage === 'ready_for_client_issue') {
    return {
      ...base,
      state: 'Ready to send',
      headline: 'Approved delivery is ready for controlled client issue',
      summary: 'Record who received the approved package and how it was sent.',
      tone: blockers.length ? 'attention' : 'active',
      waitingOn: { actor: 'internal', label: 'Overflow Partner' },
      nextAction: { label: 'Send approved delivery to client', available: blockers.length === 0, kind: 'record', reason: blockers[0] },
      primaryActions: input.documentsHref ? [{ label: 'Open approved evidence', href: input.documentsHref, available: true, kind: 'navigate' }] : [],
    };
  }

  if (stage === 'issued_to_client') {
    return {
      ...base,
      state: 'Sent to client',
      headline: 'Controlled delivery is with the client',
      summary: 'No internal progression is due until the client review begins or a response is received.',
      tone: 'waiting',
      waitingOn: { actor: 'client', label: 'Client' },
      nextAction: { label: 'Await client review', available: false, kind: 'wait' },
      primaryActions: [],
    };
  }

  if (stage === 'client_review') {
    const hasOutcome = Boolean(input.clientOutcome);
    return {
      ...base,
      state: 'Client review',
      headline: hasOutcome ? `Client outcome: ${clean(input.clientOutcome).replaceAll('_', ' ')}` : 'Waiting for the client outcome',
      summary: hasOutcome ? 'The evidenced client outcome now controls the next lifecycle route.' : 'Record the client response only when identifiable written evidence is available.',
      tone: hasOutcome ? (input.ready ? 'active' : 'attention') : 'waiting',
      waitingOn: hasOutcome ? { actor: 'internal', label: 'Overflow Partner' } : { actor: 'client', label: 'Client' },
      nextAction: hasOutcome
        ? { label: input.ready ? 'Continue from client outcome' : 'Resolve client review follow-up', available: Boolean(input.ready), kind: 'act', reason: blockers[0] }
        : { label: 'Record client outcome', available: true, kind: 'record', reason: 'Use written client evidence when it is received.' },
      primaryActions: [],
    };
  }

  if (stage === 'completion') {
    const ready = Boolean(input.ready) && blockers.length === 0;
    return {
      ...base,
      state: 'Delivery complete',
      headline: ready ? 'Project is ready to close' : 'Complete technical and commercial closeout',
      summary: ready ? 'Delivery evidence, billing and Partner liability are complete.' : 'Close only after the remaining technical and commercial obligations are evidenced.',
      tone: ready ? 'complete' : 'attention',
      waitingOn: { actor: 'internal', label: 'Overflow Partner' },
      nextAction: { label: ready ? 'Close project' : 'Complete closeout', available: ready, kind: ready ? 'approve' : 'review', reason: blockers[0] },
      approval: ready ? { required: true, type: 'Project closeout', status: 'ready', owner: 'Overflow Partner' } : undefined,
      primaryActions: [
        ...(input.documentsHref ? [{ label: 'Open closeout evidence', href: input.documentsHref, available: true, kind: 'navigate' as const }] : []),
        ...(input.financeHref ? [{ label: 'Open commercial closeout', href: input.financeHref, available: true, kind: 'navigate' as const }] : []),
      ],
    };
  }

  return {
    ...base,
    state: 'Closed',
    headline: 'Project is closed',
    summary: 'No further lifecycle action is required.',
    tone: 'complete',
    waitingOn: null,
    nextAction: { label: 'No further action', available: false, kind: 'wait' },
    primaryActions: [],
  };
}

export function resolveAcquisitionPresentation(input: AcquisitionPresentationInput): OperatingPresentation {
  const waiting = Boolean(input.waitingExternally || ['wait_customer', 'wait_partner', 'resolve_clarification'].includes(input.actionKey));
  const approval = input.actionKey === 'review_partner_response'
    ? { required: true, type: 'Go / No-Go', status: 'ready' as const, owner: 'Overflow Partner', evidence: 'Partner assessment and price received' }
    : undefined;
  const actor: OperatingActor = input.actionKey === 'wait_customer' ? 'client' : waiting ? 'partner' : 'internal';
  return {
    state: input.currentState,
    headline: input.currentState,
    summary: input.nextReason,
    tone: input.actionKey === 'closed' || input.actionKey === 'open_case' ? 'complete' : waiting ? 'waiting' : input.actionKey === 'integrity_block' ? 'blocked' : 'active',
    waitingOn: input.actionKey === 'closed' || input.actionKey === 'open_case' ? null : { actor, label: actor === 'client' ? 'Client' : actor === 'partner' ? 'Execution Partner' : 'Overflow Partner' },
    nextAction: { label: input.nextAction, available: !waiting && input.actionKey !== 'closed', kind: approval ? 'approve' : waiting ? 'wait' : 'act', reason: input.nextReason },
    blockers: [], warnings: [], completed: [], primaryActions: [], approval,
  };
}

export function resolveCasePresentation(input: CasePresentationInput): OperatingPresentation {
  const blockers = [input.blocker, ...(input.evidenceBlockers ?? [])].filter(Boolean).map(value => humaniseOperatingReason(String(value)));
  const historical = Boolean(input.historical);
  const approvalType = input.actionKey === 'approve_scope' ? 'Technical basis approval' : input.actionKey === 'generate_quote' ? 'Commercial approval' : null;
  const approval = approvalType ? { required: true, type: approvalType, status: blockers.length ? 'blocked' as const : 'ready' as const, owner: 'Overflow Partner', evidence: blockers[0] } : undefined;
  return {
    state: input.currentState,
    headline: historical ? 'Case handed off to Project 360' : input.currentState,
    summary: input.reason,
    tone: historical ? 'complete' : blockers.length ? 'blocked' : approval ? 'attention' : input.actionKey === 'accept_quote' ? 'waiting' : 'active',
    waitingOn: historical ? null : input.actionKey === 'accept_quote' ? { actor: 'client', label: 'Client' } : { actor: 'internal', label: 'Overflow Partner' },
    nextAction: { label: input.nextAction, available: !historical && blockers.length === 0 && input.actionKey !== 'integrity_block', kind: approval ? 'approve' : input.actionKey === 'accept_quote' ? 'record' : 'act', reason: input.reason },
    blockers,
    warnings: [], completed: [], primaryActions: [], approval,
  };
}

export function resolveDocumentPresentation(status: string, title = 'Controlled document'): OperatingPresentation {
  const current = clean(status).toLowerCase().replaceAll(' ', '_');
  const approvalReady = ['in_review', 'signed', 'review'].includes(current);
  const complete = ['approved', 'issued', 'published', 'archived'].includes(current);
  const changes = current === 'changes_requested';
  return {
    state: complete ? 'Controlled' : approvalReady ? 'Approval needed' : changes ? 'Changes needed' : 'Working',
    headline: title,
    summary: complete ? 'This revision has completed its current control step.' : approvalReady ? 'This revision is waiting for an authorised review decision.' : changes ? 'Requested changes must be completed before review can continue.' : 'This revision is still being prepared.',
    tone: complete ? 'complete' : changes ? 'attention' : approvalReady ? 'waiting' : 'active',
    waitingOn: complete ? null : { actor: 'internal', label: 'Overflow Partner' },
    nextAction: { label: approvalReady ? 'Review document' : changes ? 'Complete requested changes' : complete ? 'No approval needed' : 'Continue document', available: !complete, kind: approvalReady ? 'approve' : complete ? 'wait' : 'act' },
    blockers: [], warnings: [], completed: complete ? ['Current control step complete'] : [], primaryActions: [],
    approval: approvalReady ? { required: true, type: 'Document approval', status: 'ready', owner: 'Overflow Partner' } : undefined,
  };
}

export function resolvePayablePresentation(input: { status?: string | null; canApprove?: boolean; approvalBlockedReason?: string | null; settled?: boolean; balance?: number }): OperatingPresentation {
  const status = clean(input.status) || 'received';
  if (input.settled) return { state: 'Settled', headline: 'Partner payable settled', summary: 'No further payment decision is required.', tone: 'complete', waitingOn: null, nextAction: { label: 'No further action', available: false, kind: 'wait' }, blockers: [], warnings: [], completed: ['Partner liability settled'], primaryActions: [] };
  const eligible = ['received', 'matched'].includes(status);
  const blocked = eligible && Boolean(input.approvalBlockedReason);
  const ready = eligible && Boolean(input.canApprove);
  return {
    state: ready ? 'Approval needed' : blocked ? 'Evidence needed' : 'Partner payable',
    headline: ready ? 'Partner payable is ready for approval' : blocked ? 'Partner payable needs delivery evidence' : 'Partner payable is open',
    summary: blocked ? humaniseOperatingReason(String(input.approvalBlockedReason)) : ready ? 'Evidence is confirmed. An authorised payment decision is now due.' : 'Follow the recorded payable state before payment.',
    tone: blocked ? 'attention' : ready ? 'waiting' : 'active',
    waitingOn: { actor: 'internal', label: 'Overflow Partner' },
    nextAction: { label: ready ? 'Approve Partner payable' : blocked ? 'Confirm delivery evidence' : 'Review Partner payable', available: !blocked, kind: ready ? 'approve' : 'review' },
    blockers: blocked ? [humaniseOperatingReason(String(input.approvalBlockedReason))] : [], warnings: [], completed: [], primaryActions: [],
    approval: eligible ? { required: true, type: 'Partner payable', status: ready ? 'ready' : 'blocked', owner: 'Overflow Partner', evidence: input.approvalBlockedReason || undefined, value: input.balance } : undefined,
  };
}

export function resolveQuotePresentation(status: string): OperatingPresentation {
  const current = clean(status).toLowerCase();
  const config: Record<string, { state: string; summary: string; tone: OperatingTone; actor: OperatingActor; action: string; kind: OperatingActionKind }> = {
    draft: { state: 'Quote preparation', summary: 'Complete the controlled quotation before issue.', tone: 'active', actor: 'internal', action: 'Complete Client Quote', kind: 'act' },
    internal_review: { state: 'Quote approval', summary: 'The quotation is waiting for internal approval.', tone: 'waiting', actor: 'internal', action: 'Review Client Quote', kind: 'approve' },
    issued: { state: 'Awaiting client', summary: 'The controlled quotation has been sent and is waiting for the client decision.', tone: 'waiting', actor: 'client', action: 'Await client decision', kind: 'wait' },
    accepted: { state: 'Accepted', summary: 'The client has accepted the controlled quotation.', tone: 'complete', actor: 'none', action: 'Open Project 360', kind: 'navigate' },
    rejected: { state: 'Not proceeding', summary: 'The client did not accept this quotation.', tone: 'neutral', actor: 'none', action: 'Review outcome', kind: 'review' },
    declined: { state: 'Not proceeding', summary: 'The client did not accept this quotation.', tone: 'neutral', actor: 'none', action: 'Review outcome', kind: 'review' },
    expired: { state: 'Expired', summary: 'The quotation validity period has ended.', tone: 'attention', actor: 'internal', action: 'Review revision', kind: 'review' },
  };
  const item = config[current] || { state: current.replaceAll('_', ' ') || 'Quote', summary: 'Review the current quotation state.', tone: 'neutral' as OperatingTone, actor: 'internal' as OperatingActor, action: 'Open quote', kind: 'navigate' as OperatingActionKind };
  return { state: item.state, headline: item.state, summary: item.summary, tone: item.tone, waitingOn: item.actor === 'none' ? null : { actor: item.actor, label: item.actor === 'client' ? 'Client' : 'Overflow Partner' }, nextAction: { label: item.action, available: item.kind !== 'wait', kind: item.kind }, blockers: [], warnings: [], completed: [], primaryActions: [], approval: current === 'internal_review' ? { required: true, type: 'Client Quote approval', status: 'ready', owner: 'Overflow Partner' } : undefined };
}
