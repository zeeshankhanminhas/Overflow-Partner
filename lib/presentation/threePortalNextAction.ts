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
 if(actor==='client'){
  if(stage==='closed')return{title:'Your project is complete',description:'Your controlled project history and any authorised final files remain available through secure access.',action:'View project status',waiting:true};
  if(stage==='completion')return{title:'Final settlement and handover',description:'Open your secure project status to see the verified final balance and whether approved files have been released.',action:'Open secure final status',waiting:false};
  if(stage==='client_review')return{title:'Controlled engineering review',description:'Overflow Partner will make an approved, secure review issue available only after the view-only package is authorised. Do not use draft or native files.',action:'View review status',waiting:true};
  if(['ready_for_client_issue','issued_to_client'].includes(stage))return{title:'Overflow Partner is preparing your review',description:'Your engineering files cannot be issued until internal quality checks, release authority and secure review access are complete.',action:'View project status',waiting:true};
  if(stage==='internal_review')return{title:'Your engineering work is with OP quality control',description:'Overflow Partner is inspecting the submitted engineering evidence. No response or payment is required from you at this point.',action:'View project status',waiting:true};
  if(stage==='partner_correction')return{title:'Technical corrections are underway',description:'The Execution Partner is preparing revised work. OP must inspect and approve that revision before you can review it.',action:'View project status',waiting:true};
  if(stage==='in_progress')return{title:'Engineering work is in progress',description:'The Execution Partner is working under OP supervision. OP will contact you when a genuine decision is required.',action:'View project status',waiting:true};
  return{title:'Overflow Partner is preparing your project',description:'The approved commercial commitment is being mobilised. Your accepted quotation remains accessible in the secure project status.',action:'View project status',waiting:true};
 }
 if(stage==='closed')return{title:'This Work Order is closed',description:'Your approved work and payment history remain recorded. There is no execution action now.',action:'View Work Order status',waiting:true};
 if(stage==='completion')return{title:'Awaiting final settlement',description:'Overflow Partner will complete client settlement and the separate partner payable checks under your agreement.',action:'View Work Order status',waiting:true};
 if(stage==='mobilisation' && !project.work_order_accepted && project.partner_execution_state==='awaiting_acknowledgement'&&project.reference)
  return{title:'Review and accept your Work Order',description:'Check the controlled scope, price, delivery commitment and obligations. Acceptance does not start engineering work.',action:'Open Work Order acceptance',waiting:false};
 if(stage==='mobilisation')return{title:project.work_order_accepted?'Awaiting OP mobilisation approval':'Awaiting an authorised Work Order',description:'Do not start engineering work until the Work Order is formally accepted and OP has authorised commencement.',action:'View Work Order status',waiting:true};
 if(stage==='ready_for_execution' && !project.work_order_accepted)
  return{title:'Work Order acceptance is required',description:'Open your secure work area and accept the current issued order if the authorised acceptance is available.',action:'Open Work Order status',waiting:true};
 if(stage==='ready_for_execution')return{title:'Confirm you are ready to start',description:'Confirm the controlled scope, required inputs, delivery capacity and planned start in your secure Partner Work screen.',action:'Confirm commencement',waiting:false};
 if(stage==='partner_correction')return{title:'Submit the requested correction',description:'Review the OP findings, prepare a new engineering revision and submit fresh file evidence.',action:'Open revised delivery',waiting:false};
 if(stage==='in_progress')return{title:'Continue engineering delivery',description:'Report progress and issues, then submit your final work and technical files when genuinely complete.',action:'Open engineering work',waiting:false};
 if(['internal_review','ready_for_client_issue'].includes(stage))return{title:'Await OP engineering review',description:'Your submitted package is with OP for technical QA, document control and release approval. Do not resubmit unless asked.',action:'View submitted work',waiting:true};
 return{title:'Await the controlled client decision',description:'Overflow Partner manages client review, corrections and final settlement. Your approved Work Order remains accessible.',action:'View Work Order status',waiting:true};
}

export type OperatorPosition={
 stage:string;completed:boolean;canWrite:boolean;canReviewEngineering:boolean;canVerifyManifest:boolean;canAuthoriseRelease:boolean;
 needsWorkOrder:boolean;workOrderCanIssue:boolean;workOrderAccepted:boolean;waitingForEngineering:boolean;
 qaAvailable:boolean;hasSubmission:boolean;storageComplete:boolean;engineeringAccepted:boolean;manifestVerified:boolean;releaseAuthorised:boolean;
 mayAdvance:boolean;canApproveFinalRelease:boolean;canClose:boolean;canRecordClientOutcome:boolean;
};
export type OperatorNextStep=NextStep & {anchor:string};
export function operatorProjectNextStep(p:OperatorPosition):OperatorNextStep{
 const make=(title:string,description:string,action:string|null,anchor:string,waiting=false):OperatorNextStep=>({title,description,action,anchor,waiting});
 if(p.completed)return make('Project closed','There is no outstanding project decision. The controlled history remains available.',null,'#project-controls',true);
 if(!p.canWrite)return make('Await an authorised OP operator','Your role or the isolated QA write gate does not permit the next transaction.',null,'#project-controls',true);
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
  if(!p.qaAvailable||!p.hasSubmission||!p.storageComplete)return make('Partner delivery evidence is incomplete','No technical decision can be signed without a complete current submission and real files in secure storage.',null,'#engineering-review',true);
  if(!p.engineeringAccepted)return p.canReviewEngineering?
    make('Inspect drawings and decide technical acceptance','Open the current engineering files and record an evidenced acceptance, correction or rejection against this exact revision.','Inspect files and record decision','#engineering-review'):
    make('Await engineering reviewer','An authorised engineering reviewer or owner must inspect the files and record a technical decision.',null,'#engineering-review',true);
  if(!p.manifestVerified)return p.canVerifyManifest?
    make('Verify the accepted file manifest','Compare the accepted drawings, revision, filenames and storage identities. This is separate from engineering approval.','Verify delivery manifest','#manifest-verification'):
    make('Await document-control verification','An authorised OP reviewer must confirm the accepted file manifest.',null,'#manifest-verification',true);
  return p.mayAdvance?
    make('Prepare the approved package for client review','Technical QA and document-control verification are recorded. Advance the stage without issuing any client files.','Advance to package preparation','#stage-advance'):
    make('Internal QA complete; stage gate pending','Resolve any remaining governed readiness reasons before advancing.',null,'#project-controls',true);
 }
 if(p.stage==='ready_for_client_issue'){
  if(!p.qaAvailable||!p.engineeringAccepted||!p.manifestVerified)return make('Release evidence is not ready','Release requires current-cycle engineering acceptance and verified document manifest.',null,'#release-authorisation',true);
  if(p.releaseAuthorised)return make('Await secure client review package','Preparation was authorised, but external issue is blocked until the watermarked view-only client reviewer is implemented and tested.',null,'#release-authorisation',true);
  return p.canAuthoriseRelease?
   make('Authorise preparation of client review','Approve this exact revision for package preparation. This action must NOT issue or unlock client files.','Review release authority','#release-authorisation'):
   make('Await authorised release owner','Only an OP owner or administrator can authorise client-review preparation.',null,'#release-authorisation',true);
 }
 if(p.stage==='issued_to_client')return make('Await client review start','Only an authorised, secured client-review issue can begin client review. Check the evidence before proceeding.',null,'#project-controls',true);
 if(p.stage==='client_review')return p.canRecordClientOutcome?
    make('Record an evidenced client outcome','Record the actual authorised review result and reference to its written evidence; never infer acceptance from silence.','Review client decision','#client-review-outcome'):
    make('Await client review evidence','The client has not supplied an attributable technical decision, or one is already recorded.',null,'#client-review-outcome',true);
 if(p.stage==='completion'){
  if(p.canApproveFinalRelease)return make('Approve controlled final handover','A verified final payment and accepted client review permit the owner to inspect and authorise the exact final submission.','Review final release','#final-release');
  if(p.canClose)return make('Close the governed project','Final settlement, partner payable and completion checks are satisfied.','Review closure decision','#project-closure');
  return make('Complete final settlement and handover','Verify client settlement, owner release and partner payable evidence before closure.','Review final settlement','#final-release');
 }
 return make('Review current project evidence','Follow the authorised OP stage controls and required evidence.',null,'#project-controls',true);
}
