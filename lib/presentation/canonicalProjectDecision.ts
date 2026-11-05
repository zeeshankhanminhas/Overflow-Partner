/**
 * Canonical read-only OPOS business-decision projection.
 *
 * Database stage + independently recorded evidence are the source of truth.
 * Every portal may present different private information, but the underlying
 * decision owner and lifecycle step MUST agree. This reducer does not grant
 * access, issue documents, move stages, validate payments or accept work.
 *
 * Missing optional evidence is unknown, NEVER proof of approval. Callers with
 * less evidence (external summary RPC) must not offer a gated transaction.
 */
export type DecisionOwner='operator'|'partner'|'client'|'none';
export type DecisionKey=
 'issue_work_order'|'accept_work_order'|'complete_mobilisation'|'confirm_commencement'
 |'perform_execution'|'correct_execution'|'await_partner_submission'|'engineering_review'
 |'verify_manifest'|'advance_internal_review'|'authorise_client_review'
 |'secure_review_blocked'|'await_client_review'|'client_review_decision'
 |'await_client_acceptance'|'final_payment'|'final_release'|'partner_settlement'
 |'close_project'|'completed'|'evidence_unavailable'|'unknown_stage';

export type ProjectDecisionFacts={
 stage:string;
 workOrderIssued?:boolean;
 workOrderAccepted?:boolean;
 executionState?:string|null;
 commencementConfirmed?:boolean;
 partnerSubmitted?:boolean;
 qaAvailable?:boolean;
 hasSubmission?:boolean;
 storageComplete?:boolean;
 engineeringAccepted?:boolean;
 manifestVerified?:boolean;
 releaseAuthorised?:boolean;
 /** Recorded current-cycle client transmittal AND deployed protected review flow. */
 protectedReviewIssued?:boolean;
 clientAccepted?:boolean;
 finalPaid?:boolean;
 finalReleaseApproved?:boolean;
 partnerPaid?:boolean;
};
export type CanonicalDecision={
 key:DecisionKey; owner:DecisionOwner; stage:string; waiting:boolean;
 /** True only if evidence proves a protected external-client review is currently possible. */
 clientReviewAccessible:boolean;
};

export function canonicalProjectDecision(facts:ProjectDecisionFacts):CanonicalDecision{
 const stage=String(facts.stage||'');
 const decision=(key:DecisionKey,owner:DecisionOwner,waiting=false):CanonicalDecision=>({
  key,owner,stage,waiting,clientReviewAccessible:facts.protectedReviewIssued===true
 });
 switch(stage){
  case 'mobilisation':
   if(facts.workOrderIssued===false)return decision('issue_work_order','operator');
   if(facts.workOrderIssued===true&&facts.workOrderAccepted===false)return decision('accept_work_order','partner');
   return decision('complete_mobilisation','operator');
  case 'ready_for_execution':
   if(facts.workOrderAccepted===false)return decision('accept_work_order','partner');
   return decision('confirm_commencement','partner');
  case 'in_progress':
   if(facts.executionState==='delivery_submitted'||facts.partnerSubmitted===true)
    return decision('await_partner_submission','operator',true);
   return decision('perform_execution','partner');
  case 'partner_correction':
   if(facts.executionState==='delivery_submitted'||facts.partnerSubmitted===true)
    return decision('await_partner_submission','operator',true);
   return decision('correct_execution','partner');
  case 'internal_review':
   if(facts.qaAvailable===false || facts.hasSubmission===false || facts.storageComplete===false)
    return decision('evidence_unavailable','operator',true);
   if(facts.engineeringAccepted!==true)return decision('engineering_review','operator');
   if(facts.manifestVerified!==true)return decision('verify_manifest','operator');
   return decision('advance_internal_review','operator');
  case 'ready_for_client_issue':
   if(facts.qaAvailable===false||facts.engineeringAccepted===false||facts.manifestVerified===false)
    return decision('evidence_unavailable','operator',true);
   if(facts.releaseAuthorised!==true)return decision('authorise_client_review','operator');
   // Never infer secure client access from release authority or stage.
   return decision('secure_review_blocked','operator',true);
  case 'issued_to_client':
  case 'client_review':
   if(facts.protectedReviewIssued!==true)
    return decision('secure_review_blocked','operator',true);
   return decision('client_review_decision','client');
  case 'completion':
   if(facts.clientAccepted!==true)return decision('await_client_acceptance','operator',true);
   if(facts.finalPaid!==true)return decision('final_payment','client');
   if(facts.finalReleaseApproved!==true)return decision('final_release','operator');
   if(facts.partnerPaid!==true)return decision('partner_settlement','operator');
   return decision('close_project','operator');
  case 'closed':
   return decision('completed','none',true);
  default:
   return decision('unknown_stage','none',true);
 }
}

/**
 * A single owner is visible for each handoff. External portals use this to
 * explain waiting; they must not infer the ability to approve from this value.
 */
export function awaitingOwner(facts:ProjectDecisionFacts):DecisionOwner{
 return canonicalProjectDecision(facts).owner;
}
