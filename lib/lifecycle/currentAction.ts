/**
 * Read-only lifecycle projection. Server adapters supply current, revision-bound
 * evidence and transaction permissions; this module never grants access.
 * Do not pass client input or a stage-derived boolean as verified evidence.
 */
export const unifiedLifecycle = [
  'opportunity', 'requirements', 'feasibility', 'commercial_offer',
  'contractual_commitment', 'mobilisation', 'execution', 'quality_assurance',
  'delivery', 'payment_settlement', 'closure',
] as const;
export type LifecyclePhase = typeof unifiedLifecycle[number];
export type WorkspaceActor = 'operator' | 'client' | 'partner';
export type EvidenceState = 'verified' | 'missing' | 'pending' | 'failed' | 'unknown';
export type GateKey =
  'opportunity_qualified' | 'confidentiality_confirmed' | 'requirements_approved'
  | 'feasibility_approved' | 'partner_terms_approved' | 'commercial_approved'
  | 'offer_issued' | 'contract_accepted' | 'opening_invoice_issued'
  | 'opening_payment_verified' | 'project_created' | 'mobilisation_approved'
  | 'work_order_issued' | 'work_order_accepted' | 'commencement_confirmed'
  | 'delivery_submitted' | 'engineering_approved' | 'manifest_verified'
  | 'controlled_documents_approved' | 'client_review_issued' | 'client_review_accepted'
  | 'final_invoice_issued' | 'final_payment_verified' | 'owner_release_approved'
  | 'handover_issued' | 'partner_invoice_verified' | 'partner_payment_verified'
  | 'closure_approved';
export type GateEvidence = {
  state: EvidenceState;
  /** Safe public reference only; no private prices, bank details or notes. */
  reference?: string;
};
type Gate = { key: GateKey; phase: LifecyclePhase; owner: WorkspaceActor; title: string };
export const lifecycleGates: readonly Gate[] = [
  {key:'opportunity_qualified',phase:'opportunity',owner:'operator',title:'Qualify opportunity'},
  {key:'confidentiality_confirmed',phase:'requirements',owner:'operator',title:'Confirm confidentiality'},
  {key:'requirements_approved',phase:'requirements',owner:'operator',title:'Approve requirements'},
  {key:'feasibility_approved',phase:'feasibility',owner:'operator',title:'Approve technical feasibility'},
  {key:'partner_terms_approved',phase:'feasibility',owner:'operator',title:'Approve partner scope and terms'},
  {key:'commercial_approved',phase:'commercial_offer',owner:'operator',title:'Approve commercial offer'},
  {key:'offer_issued',phase:'commercial_offer',owner:'operator',title:'Issue controlled offer'},
  {key:'contract_accepted',phase:'contractual_commitment',owner:'client',title:'Accept contractual commitment'},
  {key:'opening_invoice_issued',phase:'contractual_commitment',owner:'operator',title:'Issue opening invoice'},
  {key:'opening_payment_verified',phase:'contractual_commitment',owner:'client',title:'Complete opening payment'},
  {key:'project_created',phase:'mobilisation',owner:'operator',title:'Create governed project'},
  {key:'mobilisation_approved',phase:'mobilisation',owner:'operator',title:'Approve mobilisation'},
  {key:'work_order_issued',phase:'mobilisation',owner:'operator',title:'Issue Work Order'},
  {key:'work_order_accepted',phase:'mobilisation',owner:'partner',title:'Accept Work Order'},
  {key:'commencement_confirmed',phase:'execution',owner:'partner',title:'Confirm commencement'},
  {key:'delivery_submitted',phase:'execution',owner:'partner',title:'Submit engineering delivery'},
  {key:'engineering_approved',phase:'quality_assurance',owner:'operator',title:'Review engineering delivery'},
  {key:'manifest_verified',phase:'quality_assurance',owner:'operator',title:'Verify delivery manifest'},
  {key:'controlled_documents_approved',phase:'quality_assurance',owner:'operator',title:'Approve controlled documents'},
  {key:'client_review_issued',phase:'delivery',owner:'operator',title:'Issue protected client review'},
  {key:'client_review_accepted',phase:'delivery',owner:'client',title:'Review engineering delivery'},
  {key:'final_invoice_issued',phase:'payment_settlement',owner:'operator',title:'Issue final invoice'},
  {key:'final_payment_verified',phase:'payment_settlement',owner:'client',title:'Complete final payment'},
  {key:'owner_release_approved',phase:'payment_settlement',owner:'operator',title:'Approve final file release'},
  {key:'handover_issued',phase:'payment_settlement',owner:'operator',title:'Issue final handover'},
  {key:'partner_invoice_verified',phase:'payment_settlement',owner:'operator',title:'Verify partner invoice'},
  {key:'partner_payment_verified',phase:'payment_settlement',owner:'operator',title:'Verify partner settlement'},
  {key:'closure_approved',phase:'closure',owner:'operator',title:'Approve governed closure'},
];
export type ActionCapability = {
  /** Actual server permission AND target service readiness, not just a URL. */
  permitted: boolean;
  target: string;
  completionEvent: string;
};
export type CurrentActionInput = {
  actor: WorkspaceActor;
  phase: string;
  evidence: Partial<Record<GateKey, GateEvidence>>;
  capabilities: Partial<Record<GateKey, ActionCapability>>;
  /** Verified contractual release basis; absence must not waive advance. */
  openingBasis?: 'advance' | 'approved_no_advance';
};
export type CurrentAction = {
  key: GateKey | 'completed' | 'evidence_unavailable';
  phase: LifecyclePhase | null;
  title: string;
  owner: WorkspaceActor | 'none';
  state: 'actionable' | 'waiting' | 'blocked' | 'failed' | 'done' | 'unknown';
  reason: string;
  evidence: {key: GateKey; state: EvidenceState}[];
  target: string | null;
  canExecute: boolean;
  completionEvent: string | null;
};

function safeTarget(target: string): boolean {
  // No arbitrary redirects, token-bearing URLs, control characters or fragments.
  return /^\/(?!\/)[A-Za-z0-9/_-]+$/.test(target);
}

export function resolveCurrentAction(input: CurrentActionInput): CurrentAction {
  const phase = unifiedLifecycle.find(value => value === input.phase) ?? null;
  const base = {phase, target:null, canExecute:false, completionEvent:null, evidence:[]} as const;
  if (!phase) return {...base, evidence:[], key:'evidence_unavailable', owner:'none',
    title:'Cannot verify lifecycle status',state:'unknown',reason:'A recognised lifecycle phase is required.'};
  const gates = lifecycleGates.filter(gate => !(input.openingBasis === 'approved_no_advance'
    && ['opening_invoice_issued','opening_payment_verified'].includes(gate.key)));
  const gate = gates.find(item => input.evidence[item.key]?.state !== 'verified');
  if (!gate) return {...base,evidence:[],key:phase === 'closure' ? 'completed' : 'evidence_unavailable',owner:'none',
    title:phase === 'closure' ? 'Project closed' : 'Lifecycle evidence conflicts with current phase',
    state:phase === 'closure' ? 'done' : 'unknown',reason:'Every required lifecycle gate has verified evidence; closure must also be the recorded phase.'};
  const evidence = [{key:gate.key,state:input.evidence[gate.key]?.state ?? 'unknown'}];
  const result = {...base,phase:gate.phase,key:gate.key,owner:gate.owner,title:gate.title,evidence};
  if (unifiedLifecycle.indexOf(gate.phase) > unifiedLifecycle.indexOf(phase)) {
    return {...result,state:'unknown',reason:'Recorded phase and verified evidence disagree. Refresh the owning record before proceeding.'};
  }
  // The earliest unresolved prerequisite wins even if the stored stage is ahead.
  const state = evidence[0].state;
  if (state === 'unknown') return {...result,state:'unknown',reason:'Required evidence could not be verified.'};
  if (state === 'pending') return {...result,state:'waiting',reason:`Waiting for verified completion from ${gate.owner}.`};
  if (input.actor !== gate.owner) return {...result,state:'waiting',reason:`Waiting for ${gate.owner}.`};
  const capability = input.capabilities[gate.key];
  if (!capability?.permitted || !safeTarget(capability.target) || !capability.completionEvent.trim()) {
    return {...result,state:state === 'failed' ? 'failed' : 'blocked',
      reason:'The authorised task service is not available. Resolve its permission or evidence requirements.'};
  }
  return {...result,state:state === 'failed' ? 'failed' : 'actionable',
    reason:state === 'failed' ? 'The task failed. Open the authorised task to review and retry safely.' : 'The prerequisite evidence and task permissions have been verified.',
    target:capability.target,canExecute:true,completionEvent:capability.completionEvent};
}
