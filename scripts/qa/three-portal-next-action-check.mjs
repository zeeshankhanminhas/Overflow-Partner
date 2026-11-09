import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const logic=read('lib/presentation/threePortalNextAction.ts');
const operator=read('app/opos-next/projects/[id]/page.tsx');
const clientHome=read('app/portal/[kind]/page.tsx');
const accountDetail=read('app/portal/[kind]/projects/[projectId]/page.tsx');
const clientSecure=read('app/client-portal/page.tsx');
const partnerWork=read('components/execution/PartnerWorkSurface.tsx');
const workRecord=read('app/opos-next/WorkRecordV2.tsx');
const route=read('app/portal/[kind]/projects/[projectId]/open/route.ts');
const doc=read('app/portal/portal.module.css');
for(const name of ['portalProjectNextStep','operatorProjectNextStep'])
 assert.ok(logic.includes('function '+name),'Centralised next action missing: '+name);
for(const a of ['internal_review','partner_correction','ready_for_client_issue','completion','closed'])
 assert.ok(logic.includes(a),'Stage missing from action mapping: '+a);
assert.ok(logic.includes('engineeringAccepted')&&logic.includes('manifestVerified')&&logic.includes('releaseAuthorised'),
 'Operator decision must respect independent revision-specific QA gates');
assert.ok(logic.includes('canReviewEngineering')&&logic.includes('canAuthoriseRelease')&&logic.includes('canWrite'),
 'Owner/reviewer permissions must be considered before presenting actions');
assert.ok(logic.includes("situation.key==='secure_review_blocked'")&&logic.includes('Inspect watermarked QA review preview'),
 'Client issue must remain blocked while operator can inspect watermarked internal preparation');
assert.ok(operator.includes('operatorProjectNextStep({') &&
 operator.includes('awaitingClientReview&&!qaWritable') &&
 operator.includes('drawingsApproved') &&
 operator.includes('awaitingClientReview&&canManageClientAccess&&!qaRecipient?.ready') &&
 operator.includes("action:null,anchor:'#release-authorisation',waiting:true") &&
 operator.includes("action:'Set up client access'") &&
 operator.includes("anchor:'#release-authorisation'") &&
 operator.includes('waiting={nextWithHandover.waiting}') &&
 operator.includes('actionLabel={nextWithHandover.action') &&
 operator.includes('displayNext.anchor') && operator.includes('handoverReady'),
 'Project 360 must use canonical actions while refusing client issue from a read-only preview or unverified independent client account');
assert.ok(operator.includes('The drawings are approved, but have not been sent') &&
 workRecord.includes('<p className={css.decisionKicker}>NEXT STEP</p>') &&
 !workRecord.includes('No decision is assumed until the outstanding evidence arrives') &&
 !operator.includes('Your role or the isolated QA write gate'),
 'The Operator screen must describe the business situation, not database or authorisation machinery');
for(const anchor of ['engineering-review','manifest-verification','release-authorisation','stage-advance',
 'client-review-outcome','final-release','project-closure','work-order-issue'])
 assert.ok(operator.includes('id="'+anchor+'"'),'Operator link target missing: '+anchor);
assert.ok(clientHome.includes('portalProjectNextStep(kind,p)')&&clientHome.includes('YOUR NEXT STEP')&&
 clientHome.includes('/portal/client/quotes/'),'Account home must highlight exactly one current action');
assert.ok(accountDetail.includes('portalProjectNextStep(kind,p)')&&accountDetail.includes('NEXT STEP')&&
 accountDetail.includes('!next.waiting&&next.action')&&
 accountDetail.includes('<ClientDrawingReview')&&
 accountDetail.includes("const secureReview=review&&!finalBalanceReady?'#drawing-review':null")&&
 accountDetail.includes('href={settlementHref}')&&
 accountDetail.includes('Review your drawings'),
 'External project view must direct to a real governed action');
assert.ok(clientSecure.includes('clientNext')&&clientSecure.includes('YOUR NEXT STEP')&&
 clientSecure.includes('independently verified')&&clientSecure.includes('id="quote-acceptance"')&&
 clientSecure.includes('id="opening-payment"'),'Secure client flow must have one action and keep financial gates');
assert.ok(partnerWork.includes('primaryMode:Mode')&&partnerWork.includes('Other permitted actions')&&
 partnerWork.includes("onClick={()=>setMode(primaryMode)}"),'Partner work must use one primary action');
assert.ok(partnerWork.includes("send(e,'accept_work_order')")&&partnerWork.includes("send(e,'commencement')")&&
 partnerWork.includes("send(e,'delivery')"),'No original partner workflows may be removed');
assert.ok(route.includes("portal_my_projects")&&route.includes("project.account_id")&&
 route.includes('token_hash'),'Secure account handoff must remain entitlement scoped');
assert.ok(doc.includes('.nextAction')&&workRecord.includes('waiting?'),'Action-first portals must render waiting without a fake transaction');
assert.ok(logic.includes("if(p.stage==='closed')return make('Project closed'") &&
  !logic.includes("if(p.completed)return make('Project closed'") &&
  logic.includes("if(p.stage==='completion')") &&
  logic.includes("Collect and verify the final client balance") &&
  logic.includes("Await governed final handover availability") &&
  logic.includes("Complete Execution Partner settlement"),
  'Completed delivery must not falsely close a project before financial, owner release and partner settlement gates');
assert.ok(operator.includes("const completed=stage==='closed'||String(data.status||'').toLowerCase()==='cancelled'") &&
  operator.includes("const finalReleaseServiceAvailable=qaWritable&&process.env.OP_VOICE_FINAL_RELEASE_ENABLED==='true'") &&
  operator.includes("const {data:releaseStatus}=stage==='completion'&&qaWritable") &&
  operator.includes("finalReleaseServiceAvailable&&handoverReady&&finalStatus&&finalStatus.clientAccepted") &&
  operator.includes("Review client financial register"),
  'Project 360 must show read-only completion settlement, with disabled final-release writes still locked');
const finalSettlement=read('app/opos-next/projects/[id]/final-settlement/page.tsx');
const finalInvoiceAction=read('app/opos-next/projects/[id]/final-settlement/issue-invoice-action.ts');
const finalInvoiceMigration=read('supabase/migrations/20261107170000_qa_final_invoice_linkage.sql');
const clientProject=read('app/portal/[kind]/projects/[projectId]/page.tsx');
const clientWorkspace=read('app/portal/[kind]/page.tsx');
const portalHandoff=read('app/portal/[kind]/projects/[projectId]/open/route.ts');
const clientFinalRelease=read('lib/portals/clientFinalRelease.ts');
const releaseAction=read('app/workspace/projects/[id]/final-release-action.ts');
const checkout=read('app/project-final-payment/stripe-action.ts');
assert.ok(operator.includes("stage==='completion'&&!finalStatus?.finalPaid?'/opos-next/projects/'+id+'/final-settlement'"),
 'Final settlement CTA must navigate to a real route, not jump to a same-page anchor');
assert.ok(finalSettlement.includes("op_project_voice_final_release_status") &&
  finalSettlement.includes("quote_release_contracts") &&
  finalSettlement.includes("quote_payment_confirmations") &&
  finalSettlement.includes("project_client_reviews") &&
  finalSettlement.includes("Opening this page never creates an invoice or payment.") &&
  finalSettlement.includes("issueQaFinalInvoice") &&
  finalInvoiceAction.includes("assertIsolatedQaBackend()") &&
  finalInvoiceAction.includes("assertRole(profile.role,['owner','admin','commercial'])") &&
  finalInvoiceAction.includes("op_qa_issue_final_invoice") &&
  finalInvoiceMigration.includes("op_qa_guard_final_invoice_settlement") &&
  finalInvoiceMigration.includes("op_qa_reconcile_paid_final_invoice") &&
  !finalInvoiceAction.includes("op_record_verified_project_final_settlement"),
 'Final settlement remains read-only on GET; only the separately authorised invoice action creates a ledger entry, never payment');
assert.ok(clientProject.includes("finalFilesReady?<Link className={css.action} href={finalFilesHref}") &&
  clientProject.includes("finalBalanceReady?<Link className={css.action} href={settlementHref}") &&
  clientWorkspace.includes("'?flow=final-settlement'") &&
  portalHandoff.includes("request.nextUrl.searchParams.get('flow')==='final-settlement'") &&
  portalHandoff.includes("acceptedReview") &&
  portalHandoff.includes("project.organisation_id") &&
  portalHandoff.includes("new URL('/project-final-payment',request.url)") &&
  portalHandoff.includes("portal_my_projects"),
 'Signed-in and entitled client must have a secure final payment route after actual acceptance');
assert.ok(clientProject.includes("finalFilesReady=await clientFinalFilesReady(db,p.organisation_id,p.project_id)") &&
  portalHandoff.includes("request.nextUrl.searchParams.get('flow')==='final-files'") &&
  portalHandoff.includes("clientFinalFilesReady(db,project.organisation_id,projectId)") &&
  portalHandoff.includes("portal_my_projects") &&
  portalHandoff.includes("new URL('/client-final-files',request.url)") &&
  clientFinalRelease.includes("op_project_final_settlements") &&
  clientFinalRelease.includes("op_project_final_release_approvals") &&
  clientFinalRelease.includes("document_type','handover-pack'") &&
  clientFinalRelease.includes("submission.id!==release.data.submission_id") &&
  clientFinalRelease.includes("partner_delivery_submission_files") &&
  releaseAction.includes("QA email blocked by the isolated recipient allowlist") &&
  releaseAction.includes("if(outboxId)notice") &&
  !releaseAction.includes("if(!outboxId)throw new Error"),
  'Final files must be discoverable only by entitled clients with verified payment, issued handover and exact release revision; email failure must not reverse owner approval');
assert.ok(checkout.includes("if(mode==='qa')assertIsolatedQaBackend()") &&
  checkout.includes("quote.id==='c5b894db-ccdd-47e2-a58a-c38005bcaa99'") &&
  checkout.includes("op_qa_northfield_replay") &&
  checkout.includes("op_qa_northfield_addendum_acceptances") &&
  checkout.includes("op_sandbox_payment_authorisations") &&
  checkout.includes("if(paid)throw new Error('Final payment is already confirmed.") &&
  checkout.includes("metadata[payment_stage]"),
 'Sandbox Checkout must be isolated, exact QA case only, authorized, and duplicate-payment guarded');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(logic),'Read-only decision helper must not mutate data');
assert.ok(logic.includes('We’re preparing your drawings for review') &&
 !logic.includes('A genuinely issued protected review invitation is required.'),
 'Client account copy must explain the business situation without database terminology');

const qaHandoverPage=read('app/opos-next/projects/[id]/handover/page.tsx');
const qaHandoverActions=read('app/opos-next/projects/[id]/handover/actions.ts');
const qaHandoverDownload=read('app/opos-next/projects/[id]/handover/file/route.ts');
const qaHandoverGuard=read('supabase/migrations/20261107185000_qa_governed_handover_gate.sql');
const qaHandoverRepair=read('supabase/migrations/20261109113000_qa_handover_read_gates_repair.sql');
assert.ok(qaHandoverPage.includes('prepareQaHandoverPack') &&
 qaHandoverPage.includes("supabase.rpc('op_project_voice_final_release_status'") &&
 qaHandoverPage.includes("p_user_id:user.id,p_project_id:id") &&
 qaHandoverPage.includes("finalStatusError") &&
 !qaHandoverPage.includes("from('op_project_final_settlements')") &&
 qaHandoverPage.includes('advanceQaHandoverPack') &&
 qaHandoverPage.includes('value="reviewed"') &&
 qaHandoverActions.includes('assertIsolatedQaBackend()') &&
 qaHandoverActions.includes("assertRole(profile.role,['owner','admin'])") &&
 qaHandoverActions.includes('upsert:false') &&
 qaHandoverActions.includes("status:'in_review'") &&
 qaHandoverActions.includes("step==='sign'?'signed'") &&
 qaHandoverActions.includes("step==='approve'?'approved'") &&
 qaHandoverActions.includes("step==='issue'?'issued'") &&
 !qaHandoverActions.includes('op_approve_project_final_release') &&
 qaHandoverDownload.includes("assertRole(profile.role,['owner','admin'])") &&
 qaHandoverDownload.includes("'Cache-Control':'private, no-store, max-age=0'") &&
 qaHandoverGuard.includes('op_qa_guard_handover_pack') &&
 qaHandoverGuard.includes('opos-qa-controlled-handover') &&
 qaHandoverGuard.includes('op_project_final_settlements') &&
 qaHandoverRepair.includes('opos_qa_owner_handover_storage_read') &&
 qaHandoverRepair.includes("p.role::text IN ('owner','admin')") &&
 qaHandoverRepair.includes('op_project_voice_final_release_status') &&
 !qaHandoverRepair.includes('GRANT SELECT ON public.op_project_final_settlements') &&
 qaHandoverActions.includes("const candidates=(existing||[]).filter") &&
 qaHandoverActions.includes("getTitle()!=='QA Controlled Handover Pack - '") &&
 qaHandoverActions.includes("if(freshUpload)") &&
 qaHandoverActions.includes("Document transition rejected:"),
 'QA handover requires stored PDF evidence and explicit owner steps; it cannot auto-release native files');


const qaPartnerPage=read('app/opos-next/projects/[id]/partner-settlement/page.tsx');
const qaPartnerActions=read('app/opos-next/projects/[id]/partner-settlement/actions.ts');
const qaPartnerEvidence=read('lib/qa/northfieldPartnerSettlement.ts');
const qaPartnerGuard=read('scripts/qa/sql/20261109_northfield_partner_simulation_guard.sql');
const financePreview=read('app/opos-next/finance/page.tsx');
const legacyPayments=read('app/workspace/payments/page.tsx');
assert.ok(qaPartnerPage.includes('createQaPartnerPayable') &&
  qaPartnerPage.includes('approveQaPartnerPayable') &&
  qaPartnerPage.includes('simulateQaPartnerPayment') &&
  qaPartnerPage.includes('closeQaNorthfieldProject') &&
  qaPartnerPage.includes('SIMULATED BANK PAYMENT — NOT REAL FUNDS') &&
  qaPartnerPage.includes('closeout?.ready===true') &&
  qaPartnerPage.includes('closeout?.reasons') &&
  qaPartnerActions.includes('getQaScenario(id)') &&
  qaPartnerActions.includes("status:'received'") &&
  qaPartnerActions.includes("status:'approved',evidence_confirmed:true") &&
  qaPartnerActions.includes("payment_method:'qa_simulated_bank_transfer'") &&
  qaPartnerActions.includes("reference:TRANSFER") &&
  qaPartnerActions.includes("formData.get('confirm_simulation')!=='yes'") &&
  qaPartnerActions.includes("p_target_stage:'closed'") &&
  qaPartnerActions.includes("op_advance_project_stage") &&
  !qaPartnerActions.includes('STRIPE_SECRET_KEY') &&
  !qaPartnerActions.includes('queueLifecycleEmail') &&
  qaPartnerEvidence.includes('assertIsolatedQaBackend()') &&
  qaPartnerEvidence.includes("process.env.VERCEL_GIT_COMMIT_REF!=='qa/recovery-ui-client-gate-20261105'") &&
  qaPartnerEvidence.includes("p_project_id:projectId") &&
  qaPartnerEvidence.includes("status?.ownerApproved") &&
  qaPartnerGuard.includes('op_qa_one_simulated_transfer_per_payable') &&
  qaPartnerGuard.includes('Synthetic QA payables cannot be deleted') &&
  financePreview.includes('QA synthetic bank settlement is NOT an actual transfer') &&
  legacyPayments.includes('qa_simulated_bank_transfer') &&
  operator.includes("'/partner-settlement'"),
  'Northfield partner QA settlement must be isolated, approved, synthetic-only, safely reconciled and separately closed through the canonical engine');


const closeoutEvidence=read('lib/qa/northfieldCloseoutEvidence.ts');
const closeoutActions=read('app/opos-next/projects/[id]/closeout-evidence/actions.ts');
const closeoutPage=read('app/opos-next/projects/[id]/closeout-evidence/page.tsx');
const closeoutFile=read('app/opos-next/projects/[id]/closeout-evidence/file/route.ts');
const closeoutSql=read('scripts/qa/sql/20261109_northfield_closeout_reconciliation.sql');
assert.ok(
 closeoutEvidence.includes('getQaScenario(id)') &&
 closeoutEvidence.includes('quote_stripe_payment_events') &&
 closeoutEvidence.includes("stripe_payment_status!=='paid'") &&
 closeoutEvidence.includes("DEPOSIT_INVOICE") &&
 closeoutEvidence.includes("billingReady:!!deposit") &&
 closeoutActions.includes("invoice_number:DEPOSIT_INVOICE,invoice_type:'deposit',status:'paid'") &&
 closeoutActions.includes('external_reference:e.receipt.payment_reference') &&
 closeoutActions.includes("issued_at:new Date().toISOString()") &&
 closeoutActions.includes("confirm")===false &&
 closeoutActions.includes("status:'in_review'") &&
 closeoutActions.includes("step==='sign'?'signed'") &&
 closeoutActions.includes("step==='approve'?'approved'") &&
 closeoutActions.includes("step==='sign'?{status:next") &&
 closeoutActions.includes("if(uploaded)await e.db.storage") &&
 !closeoutActions.includes('queueLifecycleEmail') &&
 !closeoutActions.includes('stripe.checkout.sessions.create') &&
 closeoutPage.includes('Additional charge required') &&
 closeoutPage.includes('£0.00') &&
 closeoutPage.includes('reconcileNorthfieldOpeningInvoice') &&
 closeoutPage.includes('advanceNorthfieldCloseoutDocument') &&
 closeoutFile.includes('getCloseoutEvidence') &&
 closeoutFile.includes("'Cache-Control':'private, no-store, max-age=0'") &&
 closeoutSql.includes('QA-OPEN-NORTHFIELD-0002') &&
 closeoutSql.includes('quote_stripe_payment_events') &&
 closeoutSql.includes('op_qa_guard_closeout_document') &&
 operator.includes("'/closeout-evidence'"),
 'QA closeout requires already-paid Stripe receipt, audited deposit reconciliation, separately issued evidence and no further client charge'
);

console.log('Three-portal next-action contract: Operator, Client and Partner; all guarded original actions preserved. PASS (static).');
