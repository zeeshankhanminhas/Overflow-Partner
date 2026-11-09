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
 operator.includes('waiting={displayNext.waiting}') &&
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
assert.ok(clientProject.includes("finalBalanceReady?<Link className={css.action} href={settlementHref}") &&
  clientWorkspace.includes("'?flow=final-settlement'") &&
  portalHandoff.includes("request.nextUrl.searchParams.get('flow')==='final-settlement'") &&
  portalHandoff.includes("acceptedReview") &&
  portalHandoff.includes("project.organisation_id") &&
  portalHandoff.includes("new URL('/project-final-payment',request.url)") &&
  portalHandoff.includes("portal_my_projects"),
 'Signed-in and entitled client must have a secure final payment route after actual acceptance');
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
assert.ok(qaHandoverPage.includes('prepareQaHandoverPack') &&
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
 qaHandoverGuard.includes('op_project_final_settlements'),
 'QA handover requires stored PDF evidence and explicit owner steps; it cannot auto-release native files');

console.log('Three-portal next-action contract: Operator, Client and Partner; all guarded original actions preserved. PASS (static).');
