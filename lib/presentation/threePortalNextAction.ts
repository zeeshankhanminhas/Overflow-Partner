import {canonicalProjectDecision} from './canonicalProjectDecision';

/**
 * Read-only presentation contract shared by OPOS Project 360 and account portals.
 * These decisions NEVER authorise work, payment, sign-off or file access.
 * Existing RLS, authenticated server actions and SQL gates remain authoritative.
 */
export type PortalActor='client'|'partner';
export type PortalProjectPosition={
 project_stage:string;work_order_accepted?:boolean;
 partner_execution_state?:string|null;reference?:string|null;
};
export type NextStep={title:string;description:string;action:string|null;waiting:boolean};

export function portalProjectNextStep(actor:PortalActor, project:PortalProjectPosition):NextStep {
 const stage=String(project.project_stage||'');
 // One shared evidence projection decides who owns the handoff. The account RPC
 // deliberately contains limited data; missing evidence never grants approval.
 const situation=canonicalProjectDecision({
  stage,
  workOrderIssued:Boolean(project.reference),
  workOrderAccepted:project.work_order_accepted,
  executionState:project.partner_execution_state,
 });
 const view=(title:string,description:string,action:string|null,waiting:boolean):NextStep=>
  ({title,description,action,waiting});
 if(actor==='client'){
  switch(stage){
   case 'closed':return view('Your project is complete','Your controlled project history and any authorised final files remain available through secure access.','View project status',true);
   case 'completion':return view('Final settlement and handover','Open the secure record to see verified final balances and release status. The project stage alone is not proof of payment.','Open secure final status',true);
   case 'internal_review':return view('We’re checking your drawings','Overflow Partner is reviewing the engineering work. You do not need to do anything yet.','View project status',true);
   case 'partner_correction':return view('We’re making the requested changes','The drawings are being updated. We’ll share the revised version once it has been checked.','View project status',true);
   case 'in_progress':return view('Your drawings are in progress','Our engineering team is working on your project. We’ll contact you when your review is ready.','View project status',true);
   case 'ready_for_client_issue':return view('We’re preparing your drawings for review','The drawings are being checked before they are shared with you. No action is needed yet.','View project status',true);
   case 'issued_to_client':
   case 'client_review':return view('We’re checking your review access',
    'If your drawings have been shared, they will appear in your secure account. We’ll let you know if anything needs your attention.','View review status',true);
   default:return view('Overflow Partner is preparing your project','Your accepted quotation and project status remain in the secure account.','View project status',true);
  }
 }
 switch(situation.key){
  case 'accept_work_order':
   return project.reference&&project.partner_execution_state==='awaiting_acknowledgement'?
    view('Review and accept your Work Order','Check scope, price and delivery obligations. Acceptance is separate from commencement.','Open Work Order acceptance',false):
    view('Await authorised Work Order access','The secure invitation or accepted Work Order evidence must be available before acting.','View Work Order status',true);
  case 'confirm_commencement':
   return view('Confirm you are ready to start','Confirm scope, inputs, capacity and planned start using your secure Partner Work session.','Confirm commencement',false);
  case 'perform_execution':
   return view('Continue your engineering work','Report progress and issues, and submit completed deliverables when ready.','Open engineering work',false);
  case 'correct_execution':
   return view('Submit the requested correction','Review OP findings, prepare a fresh revision and submit new file evidence.','Open revised delivery',false);
  case 'await_partner_submission':
   return view('Await Overflow Partner quality review','Your submitted work is under OP review. No further submission is due unless corrections are requested.','View submitted work',true);
  case 'complete_mobilisation':
   return view('Await OP mobilisation authority','Even an accepted Work Order does not permit the partner to start before formal commencement.','View Work Order status',true);
  default:
   return view(stage==='closed'?'This Work Order is closed':'Await the next authorised decision',
    'Overflow Partner controls technical acceptance, client review, settlement and closeout.','View Work Order status',true);
 }
}

/**
 * The quote is independently controlled; a project never proves that cash was
 * received. This wrapper gives the token-based secure client portal the same
 * project-language contract as the permanent Client Workspace.
 */
export type SecureClientPosition={
 projectStage:string|null;canDecide:boolean;accepted:boolean;canPay:boolean;
 paymentVerificationPending:boolean;finalReviewAccepted:boolean;
 finalSettlementVerified:boolean;finalReleaseApproved:boolean;
 finalFilesHref:string;finalBalanceHref:string;
};
export function secureClientNextStep(p:SecureClientPosition):NextStep & {href:string|null}{
 const result=(title:string,description:string,href:string|null,action:string|null,waiting:boolean)=>
  ({title,description,href,action,waiting});
 if(p.finalReleaseApproved)return result('Your approved engineering files are available',
  'Final payment and separate owner release approval have been verified.',p.finalFilesHref,'Open final engineering handover',false);
 if(p.finalReviewAccepted&&!p.finalSettlementVerified)return result('Settle your final engineering balance',
  'An accepted client review precedes final payment. Native engineering files remain locked.',p.finalBalanceHref,'Review final balance',false);
 if(p.projectStage){
  const basic=portalProjectNextStep('client',{project_stage:p.projectStage});
  return result(basic.title,basic.description,null,null,true);
 }
 if(p.paymentVerificationPending)return result('Your opening payment is being verified',
  'Please do not pay again. Project creation requires independent settlement evidence.',null,null,true);
 if(p.canDecide)return result('Review and respond to your quotation',
  'Read the controlled terms, scope and validity. Respond as an authorised signatory.','#quote-acceptance','Review quotation',false);
 if(p.accepted&&p.canPay)return result('Complete your authorised opening payment',
  'Project creation remains blocked until cleared opening payment is independently verified.','#opening-payment','Go to secure payment',false);
 if(p.accepted)return result('Awaiting verified commercial release',
  'Overflow Partner is checking the authorised release conditions. No repeat payment is requested here.',null,null,true);
 return result('Awaiting an authorised quotation decision',
  'Request additional time or contact Overflow Partner if the original offer has expired.',null,null,true);
}

export type OperatorPosition={
 stage:string;completed:boolean;canWrite:boolean;canReviewEngineering:boolean;canVerifyManifest:boolean;canAuthoriseRelease:boolean;
 needsWorkOrder:boolean;workOrderCanIssue:boolean;workOrderAccepted:boolean;waitingForEngineering:boolean;
 qaAvailable:boolean;hasSubmission:boolean;storageComplete:boolean;engineeringAccepted:boolean;manifestVerified:boolean;releaseAuthorised:boolean;
 mayAdvance:boolean;canApproveFinalRelease:boolean;canClose:boolean;canRecordClientOutcome:boolean;
 partnerSubmitted?:boolean;protectedReviewIssued?:boolean;
 clientAccepted?:boolean;finalPaid?:boolean;finalReleaseApproved?:boolean;partnerPaid?:boolean;
 externalClientDecision?:string|null;externalFeedbackClassification?:string|null;
 clientReviewReconciled?:boolean;clientReviewEvidenceAvailable?:boolean;
 canClassifyClientFeedback?:boolean;
};
export type OperatorNextStep=NextStep & {anchor:string};
export function operatorProjectNextStep(p:OperatorPosition):OperatorNextStep{
 const make=(title:string,description:string,action:string|null,anchor:string,waiting=false):OperatorNextStep=>({title,description,action,anchor,waiting});
 const situation=canonicalProjectDecision({
   stage:p.stage,workOrderIssued:!p.needsWorkOrder,
   workOrderAccepted:p.workOrderAccepted,partnerSubmitted:p.partnerSubmitted,
   qaAvailable:p.qaAvailable,hasSubmission:p.hasSubmission,storageComplete:p.storageComplete,
   engineeringAccepted:p.engineeringAccepted,manifestVerified:p.manifestVerified,
   releaseAuthorised:p.releaseAuthorised,protectedReviewIssued:p.protectedReviewIssued,
   clientAccepted:p.clientAccepted,finalPaid:p.finalPaid,
   finalReleaseApproved:p.finalReleaseApproved,partnerPaid:p.partnerPaid,
 });
 if(p.completed)return make('Project closed','There is no outstanding project decision. The controlled history remains available.',null,'#project-controls',true);
 if(!p.canWrite)return make('View the current project','Changes are not available from this view. The project history is available below.',null,'#project-controls',true);
 if(p.stage==='mobilisation'){
  if(p.needsWorkOrder)return p.workOrderCanIssue?
   make('Issue the approved Partner Work Order','The existing action checks the verified opening payment and approved scope. It will not start execution.','Review and issue Work Order','#work-order-issue'):
   make('Work Order issue is blocked','Review the recorded financial, contractual and partner-governance prerequisites; no Work Order can be created without them.',null,'#work-order-issue',true);
  if(p.mayAdvance)return make('Complete mobilisation','The governed stage check confirms mobilisation evidence is ready. Confirm this distinct step before partner commencement.','Review mobilisation decision','#stage-advance');
  return make('Complete mobilisation evidence','Project owner, programme and required approved scope/partner evidence must be ready before release.','Review mobilisation requirements','#mobilisation-controls');
 }
 if(p.stage==='ready_for_execution')return make('Await Partner commencement',p.workOrderAccepted?'The accepted Work Order is not a start declaration. The partner must confirm inputs, capacity and planned start.':'Formal Work Order acceptance is still missing.',null,'#project-controls',true);
 if(p.stage==='in_progress')return make('Await Partner engineering submission','The partner must report progress and submit genuine drawings before OP can inspect them.',null,'#partner-delivery-evidence',true);
 if(p.stage==='partner_correction')return make('Await revised Partner submission','Partner correction requires new files and a fresh engineering review of the new revision.',null,'#partner-delivery-evidence',true);
 if(p.stage==='internal_review'){
  if(situation.key==='evidence_unavailable')return make('Partner delivery evidence is incomplete','No technical decision can be signed without a complete current submission and real files in secure storage.',null,'#engineering-review',true);
  if(situation.key==='engineering_review')return p.canReviewEngineering?
    make('Inspect drawings and decide technical acceptance','Open the current engineering files and record an evidenced acceptance, correction or rejection against this exact revision.','Inspect files and record decision','#engineering-review'):
    make('Await engineering reviewer','An authorised engineering reviewer or owner must inspect the files and record a technical decision.',null,'#engineering-review',true);
  if(situation.key==='verify_manifest')return p.canVerifyManifest?
    make('Verify the accepted file manifest','Compare the accepted drawings, revision, filenames and storage identities. This is separate from engineering approval.','Verify delivery manifest','#manifest-verification'):
    make('Await document-control verification','An authorised OP reviewer must confirm the accepted file manifest.',null,'#manifest-verification',true);
  return p.mayAdvance?
    make('Prepare the approved package for client review','Technical QA and document-control verification are recorded. Advance the stage without issuing any client files.','Advance to package preparation','#stage-advance'):
    make('Internal QA complete; stage gate pending','Resolve any remaining governed readiness reasons before advancing.',null,'#project-controls',true);
 }
 if(p.stage==='ready_for_client_issue'){
  if(situation.key==='evidence_unavailable')return make('Release evidence is not ready','Release requires current-cycle engineering acceptance and verified document manifest.',null,'#release-authorisation',true);
  if(situation.key==='secure_review_blocked')return make('Inspect watermarked QA review preview',
   'Preparation is authorised. Inspect the watermarked R01 PDF in the private operator-only preview. External client issue stays blocked until recipient-scoped review access is implemented and verified.',
   'Open watermarked QA preview','/review-preview');
  return p.canAuthoriseRelease?
   make('Authorise preparation of client review','Approve this exact revision for package preparation. This action must NOT issue or unlock client files.','Review release authority','#release-authorisation'):
   make('Await authorised release owner','Only an OP owner or administrator can authorise client-review preparation.',null,'#release-authorisation',true);
 }
 if(p.stage==='issued_to_client')return make('Await protected review evidence',
  'External issue or review access cannot be presumed from the stage. A real protected, attributable client review invitation must exist.',
  null,'#project-controls',true);
 if(p.stage==='client_review'){
   if(!p.clientReviewEvidenceAvailable)return make('Client review evidence unavailable',
     'Do not infer acceptance, correction or release when authenticated client records cannot be verified.',null,'#client-review-outcome',true);
   if(p.clientReviewReconciled)return p.mayAdvance?
     make('Advance accepted review to completion',
       'A current-cycle client acceptance is recorded. Advance through the independently verified completion gate; final payment and native handover remain separate.',
       'Review completion transition','#client-review-outcome'):
     make('Resolve final review readiness blockers',
       'An authenticated client acceptance is recorded, but delivery controls still prevent transition to completion.',
       null,'#client-review-outcome',true);
   if(['changes_requested','rejected'].includes(String(p.externalClientDecision||''))){
     if(p.externalFeedbackClassification==='variation')return make('Await commercial variation approval',
       'Client feedback was classified as additional scope. An unpriced change proposal exists; do not issue partner work or alter the agreed date.',
       null,'#client-review-outcome',true);
     return p.canClassifyClientFeedback?
       make('Classify the client correction against the approved scope',
         'Choose one included correction, partner defect, or proposed variation. Only approved in-scope corrective instructions may reopen partner execution.',
         'Classify client feedback','#client-review-outcome'):
       make('Await owner scope classification',
         'An OP owner must classify the actual client feedback before any partner instruction.',
         null,'#client-review-outcome',true);
   }
   if(['accepted','accepted_with_comments'].includes(String(p.externalClientDecision||'')))
     return make('Reconcile authenticated client acceptance',
       'The actual client has responded. Record that exact outcome in the governed project review before progressing.',
       'Reconcile verified client decision','#client-review-outcome');
   return make('Await an actual client review decision',
     'The protected review has been issued, but no attributable client acceptance or correction is recorded yet.',
     null,'#client-review-outcome',true);
 }
 if(p.stage==='completion'){
  if(p.canApproveFinalRelease)return make('Approve controlled final handover','A verified final payment and accepted client review permit the owner to inspect and authorise the exact final submission.','Review final release','#final-release');
  if(p.canClose)return make('Close the governed project','Final settlement, partner payable and completion checks are satisfied.','Review closure decision','#project-closure');
  return make('Complete final settlement and handover','Verify client settlement, owner release and partner payable evidence before closure.','Review final settlement','#final-release');
 }
 return make('Review current project evidence','Follow the authorised OP stage controls and required evidence.',null,'#project-controls',true);
}
