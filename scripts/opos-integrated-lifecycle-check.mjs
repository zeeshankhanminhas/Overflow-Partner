import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const checks=[];
function check(label,condition){checks.push({label,passed:Boolean(condition)});if(!condition)console.error('FAIL '+label);}
const contract=read('lib/lifecycle/commercialContract.ts');
const portal=read('app/client-portal/page.tsx');
const payment=read('app/quote-payment/page.tsx');
const checkout=read('app/quote-payment/stripe-action.ts');
const webhook=read('app/api/stripe/webhook/route.ts');
const response=read('app/quote-response/actions.ts');
const finalizer=read('supabase/migrations/20261019010000_enforce_sandbox_finalization_scope.sql');
const authorisations=read('supabase/migrations/20261017031000_op_sandbox_payment_allowlist.sql');
const actions=read('app/workspace/orchestration/actions.ts');
const invariants=read('lib/business/invariants/index.ts');
const caseDocs=read('lib/cases/documentRequirements.ts');
const stages=read('lib/projects/stages.ts');
const notifications=read('lib/notifications/scenarios.ts');
check('Nine authoritative commercial stages', (contract.match(/key: '/g)||[]).length===9);
check('Governance uses delivery risk, safety and complexity', ['technicalComplexity','deliveryRisk','regulatedOrSafetyCritical'].every(s=>contract.includes(s)));
check('Formal partner evidence is required before Commercial Review',invariants.includes('partner_review_request_id') && invariants.includes('formalReview.status'));
check('Preliminary consultation cannot authorise quotation',contract.includes("purpose === 'formal_assessment' && approved"));
check('Quotation revision and expiration guarded for manual release',actions.includes("quote_revision") && actions.includes("currentQuote.valid_until"));
check('Portal remains persistent and can return to payment',portal.includes('createClientPortalToken')&&portal.includes('Continue to payment'));
check('Payment portal shows contractual opening amount instead of quote total',payment.includes('openingAmount = Number(contract.opening_amount)')&&payment.includes('formatAmount(openingAmount)'));
check('Staged deposit cannot show a full-amount Stripe Checkout action',payment.includes('hasStagedPayment')&&payment.includes('stripeAvailable ?'));

check('Acceptance bound to current portal token revision',response.includes('verifyClientResponseToken')&&response.includes('p_quote_revision'));
check('Checkout separates test keys from gated live Stripe environment',checkout.includes('stripeRuntimeMode()')&&checkout.includes("mode==='live'?'sk_live_':'sk_test_'")&&checkout.includes('checkoutOrigin(mode)'));
check('Checkout requires explicit quote allowlist',checkout.includes("from('op_sandbox_payment_authorisations')")&&checkout.includes("quote_revision"));
check('Webhook signature and matching signed live/test mode validated',webhook.includes('validStripeSignature(body,signature,webhookSecret)')&&webhook.includes("session.livemode !== (mode==='live')")&&read('lib/payments/stripeSignature.ts').includes('timingSafeEqual'));
check('Webhook validates amount, currency, revision',webhook.includes('amount!==expectedAmount')&&webhook.includes("currency!==String(quote.currency)")&&webhook.includes(".eq('revision',revision)"));
check('Webhook requires QA allowlist',webhook.includes("from('op_sandbox_payment_authorisations')"));
check('Database finalizer independently enforces QA allowlist',finalizer.includes('op_sandbox_payment_authorisations')&&finalizer.includes("OP QA TEST%")&&finalizer.includes('a.expires_at>now()'));
check('DB finalizer checks acceptance and amount',finalizer.includes("client_response='accepted'")&&finalizer.includes('v_event.amount_total'));
check('DB finalizer checks project already exists before insertion',finalizer.indexOf('select * into v_project')<finalizer.indexOf('insert into public.quote_payment_confirmations'));
check('DB finalizer limits execute to service role',finalizer.includes('from public, anon, authenticated')&&finalizer.includes('to service_role'));
check('Allowlist empty by default and restricted by RLS',authorisations.includes('enable row level security')&&authorisations.includes('revoke all'));
check('No direct manual Stripe confirmation',actions.includes('manual confirmation is not allowed'));
check('Client quote document is governed',caseDocs.includes("slug: 'client-quote'"));
check('Partner quality correction loop exists',stages.includes('partner_correction')&&stages.includes('internal_review'));
check('Payment, partner, delivery and completion notification scenarios exist',['payment.received','partner_work.released','client_delivery.issued','project.completed'].every(x=>notifications.includes(x)));

const contractual=read('supabase/migrations/20261019023000_quote_contractual_release_gates.sql');
const depositFinalizer=read('supabase/migrations/20261021054100_verified_deposit_stripe_release.sql');
check('Verified opening Stripe payment creates project for deposit only',depositFinalizer.includes("v_contract.release_basis not in ('payment','deposit')")&&depositFinalizer.includes('v_contract.opening_amount')&&depositFinalizer.includes('op_accept_quote_create_project_with_acceptance_core'));

const acceptancePage=read('app/quote-response/page.tsx');
const issueFields=read('app/workspace/leads/[id]/QuoteIssueContractFields.tsx');
check('Current quote revision has an immutable contractual release identity', contractual.includes('primary key (quote_id,quote_revision)'));
check('Quote issue transition requires approved release terms',contractual.includes('op_quote_contract_issue_gate'));
check('Commercial project insertion requires matching release evidence',contractual.includes('op_project_contractual_release_gate')&&contractual.includes('op_guard_project_contractual_release'));
check('Project guard rejects mismatched named signatory',contractual.includes('quote_acceptance_records')&&contractual.includes('authorised_contact_email'));
check('Portal acceptance records named authority claim atomically',contractual.includes('op_record_authorised_public_quote_response')&&response.includes('p_authority_attested'));
check('Portal asks for explicit business signatory declaration',acceptancePage.includes('authority_attested')&&acceptancePage.includes('signatory_name'));
check('Issue form captures supported release basis',issueFields.includes('contract_release_basis'));
check('Issue action records terms before generating email',actions.indexOf("op_record_quote_release_contract")<actions.indexOf("sendClientQuoteEmail({supabase,organisationId,quoteId,leadId,recipientEmail,recipientName,companyName:recipient?.company_name||null})"));
check('Issue email PDF uses authorised terms rather than partner payment terms',actions.includes('paymentTerms:releaseText'));
check('Manual project release compares chosen basis to accepted terms',actions.includes('releaseBasis!==releaseContract.release_basis'));
check('Checkout requires frozen deposit or full-payment terms',checkout.includes("['payment','deposit'].includes")&&checkout.includes('openingPayment(quotedTotal)'));
check('Opening Stripe checkout uses the contract amount, never total by assumption',checkout.includes('Math.round(openingAmount*100)')&&checkout.includes("metadata[payment_stage]"));
check('Stripe webhook validates opening deposit and signatory',webhook.includes('quote_client_signatory_attestations')&&webhook.includes('openingPayment(Number(quote.total))')&&webhook.includes("metadata?.payment_stage"));
check('Payment never redirects QA Stripe Sandbox to production fallback',
  checkout.includes('checkoutOrigin(mode)') &&
  read('lib/payments/stripeEnvironment.ts').includes("const host=process.env.VERCEL_URL") &&
  read('lib/payments/stripeEnvironment.ts').includes("return 'https://'+host;") &&
  !checkout.includes("NEXT_PUBLIC_APP_URL || 'https://overflow-partner.vercel.app'"));
check('Quote expiry remains valid until end of date',actions.includes('T23:59:59.999Z')&&checkout.includes('T23:59:59.999Z'));

// Execute policy behavior independently from static source scans.
const transpiled=ts.transpileModule(contract,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exportsObject={};
vm.runInNewContext(transpiled,{exports:exportsObject,module:{exports:exportsObject}});
const policy=exportsObject;
check('Policy always lists nine stages',policy.OP_LIFECYCLE.length===9);
check('Routine low-value work is proportionate',policy.classifyGovernance({contractValueGbp:350,technicalComplexity:'routine',deliveryRisk:'low',regulatedOrSafetyCritical:false})==='standard');
check('Low-price safety critical work is enhanced',policy.classifyGovernance({contractValueGbp:350,technicalComplexity:'routine',deliveryRisk:'low',regulatedOrSafetyCritical:true})==='enhanced');
check('High value job is enhanced at threshold',policy.classifyGovernance({contractValueGbp:5000,technicalComplexity:'routine',deliveryRisk:'low',regulatedOrSafetyCritical:false})==='enhanced');
check('Preliminary consultation never authorises price',policy.canUsePartnerReviewForCommercialOffer('preliminary_consultation',true)===false);
check('Approved formal assessment authorises commercial evidence',policy.canUsePartnerReviewForCommercialOffer('formal_assessment',true)===true);
check('Expired accepted quote cannot release',policy.evaluateCommercialRelease({acceptanceVerified:true,quotationCurrent:false,conditionInAcceptedQuote:'full_advance',evidence:{paymentVerified:true}}).permitted===false);
check('Unaccepted quote cannot release',policy.evaluateCommercialRelease({acceptanceVerified:false,quotationCurrent:true,conditionInAcceptedQuote:'full_advance',evidence:{paymentVerified:true}}).permitted===false);
check('Full advance without verified settlement cannot release',policy.evaluateCommercialRelease({acceptanceVerified:true,quotationCurrent:true,conditionInAcceptedQuote:'full_advance',evidence:{}}).permitted===false);
for(const [condition,evidence] of [
 ['full_advance',{paymentVerified:true}],['deposit',{depositVerified:true}],
 ['approved_purchase_order',{purchaseOrderApproved:true}],['approved_credit',{creditApproved:true}],
 ['no_advance_due',{noAdvanceApproved:true}]
])check('Verified contractual condition permits '+condition,
 policy.evaluateCommercialRelease({acceptanceVerified:true,quotationCurrent:true,conditionInAcceptedQuote:condition,evidence}).permitted===true);


check('Mobilisation contract-to-finance handoff exists',read('supabase/migrations/20261019030000_project_financial_release_handoff.sql').includes('op_inherit_quote_release_after_project_creation'));
check('Opening quote payments count toward mobilisation without double-counting',read('supabase/migrations/20261019030000_project_financial_release_handoff.sql').includes('greatest(v_received,coalesce(sum(qpc.amount),0))'));
function modulePolicy(file){
 const output=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const obj={};vm.runInNewContext(output,{exports:obj,module:{exports:obj}});
 return obj;
}
const casePolicy=modulePolicy('lib/cases/documentRequirements.ts');
const standard=casePolicy.getCaseDocumentRequirements({hasIntake:true,scopeApproved:true,hasReview:true,partnerResponseReady:true,commercialApproved:false,governanceTier:'standard'});
const enhanced=casePolicy.getCaseDocumentRequirements({hasIntake:true,scopeApproved:true,hasReview:true,partnerResponseReady:true,commercialApproved:false,governanceTier:'enhanced'});
check('Standard-risk formal assessment does not demand redundant detailed report',standard.items.find(x=>x.slug==='partner-technical-assessment-report')?.requiredNow===false);
check('Enhanced-risk requires formal detailed assessment report',enhanced.items.find(x=>x.slug==='partner-technical-assessment-report')?.requiredNow===true);
const projectDocs=modulePolicy('lib/projects/documentRequirements.ts');
check('Mobilisation requires approved statement of work',projectDocs.getProjectDocumentRequirements('mobilisation',true).some(x=>x.slug==='statement-of-work'&&x.requiredNow&&x.minimumStatus==='approved'));
check('OP quality control requires technical review',projectDocs.getProjectDocumentRequirements('internal_review',true).some(x=>x.slug==='technical-review'&&x.requiredNow));
check('Client release requires issued handover pack',projectDocs.getProjectDocumentRequirements('ready_for_client_issue',true).some(x=>x.slug==='handover-pack'&&x.requiredNow&&x.minimumStatus==='issued'));
check('Closure requires completion report',projectDocs.getProjectDocumentRequirements('completion',true).some(x=>x.slug==='completion-report'&&x.requiredNow));
const finance=modulePolicy('lib/finance/state.ts');
check('Unauthorised mobilisation is blocked',finance.resolveFinancialGate({authorised:false,required:500,received:0}).authorised===false);
check('Eligible settled mobilisation may proceed',finance.resolveFinancialGate({authorised:true,required:500,received:500}).authorised===true);
check('Final invoice is blocked before completion',finance.resolveBillingEligibility({invoiceType:'final',projectStage:'in_progress'}).permitted===false);
check('Final invoice is eligible at completion',finance.resolveBillingEligibility({invoiceType:'final',projectStage:'completion'}).permitted===true);
check('Credit note requires an existing invoice',finance.resolveBillingEligibility({invoiceType:'credit_note',projectStage:'closed',hasEligibleSourceInvoice:false}).permitted===false);

check('Staged contractual migration has no malformed SQL terminators',!contractual.includes('end;'+String.fromCharCode(36)+';'));
check('Bank-transfer release fails closed until independent reconciliation',contractual.includes("bank_transfer' and false"));
check('Staged project mobilisation handoff migration exists',read('supabase/migrations/20261019030000_project_financial_release_handoff.sql').includes('op_inherit_quote_release_after_project_creation'));
check('Contract approval actor must be authenticated caller',contractual.includes("auth.uid() is distinct from p_user_id"));
check('Contract table has quote revision uniqueness',contractual.includes('primary key (quote_id,quote_revision)'));
check('Project finance handoff has atomic after insert trigger',read('supabase/migrations/20261019030000_project_financial_release_handoff.sql').includes('after insert on public.projects'));
const voice=modulePolicy('lib/lifecycle/voiceAgreedContract.ts');
check('Standard gross margin is 33%',voice.OPOS_POLICY.defaultGrossMarginPct===33);
check('33% gross margin translates to 49.25% markup',Math.abs(voice.grossMarginToMarkup(33)-49.253731343)<0.0001);
check('Opening payment is thirty percent',voice.openingPayment(1000)===300);
check('Final balance is seventy percent',voice.finalBalance(1000)===700);
check('Quotation validity is fourteen days',voice.OPOS_POLICY.quotationValidityDays===14);
check('Review window is seven weekdays',voice.clientReviewDeadline(new Date('2026-10-23T12:00:00Z')).toISOString().startsWith('2026-11-03'));
check('Included client correction limited to one consolidated round',voice.classifyClientFeedback({category:'in_scope_correction',correctionRoundsUsed:1,defectAgainstApprovedScope:false})==='correction_round_exhausted');
check('Partner defect rework is never counted as a client round',voice.classifyClientFeedback({category:'in_scope_correction',correctionRoundsUsed:2,defectAgainstApprovedScope:true})==='partner_defect_rework');
check('New scope needs separately approved variation',voice.classifyClientFeedback({category:'out_of_scope_change',correctionRoundsUsed:0,defectAgainstApprovedScope:false})==='new_paid_variation');
check('Senior QC alone cannot release client review without OP authority',!voice.canReleaseClientReview({partnerSeniorQcApproved:true,documentsCurrent:true,ownerApproved:false}));
check('Final editable files require both full client payment and manual approval',!voice.canReleaseFinalFiles({clientReviewResolved:true,finalPaymentVerified:false,ownerApproved:true,approvedRevisionCurrent:true})&&!voice.canReleaseFinalFiles({clientReviewResolved:true,finalPaymentVerified:true,ownerApproved:false,approvedRevisionCurrent:true}));
check('Partner payment needs bank reference and human approval',!voice.canRecordPartnerPaid({clientFullyPaid:true,finalPackageReleased:true,partnerInvoicePresent:true,ownerApproved:true,bankPaymentReference:''}));
check('Project closure is manual',!voice.canCloseProject({clientPaid:true,partnerPaid:true,deliveryRecorded:true,controlledDocsComplete:true,ownerApproved:false}));
const clientActions=read('app/workspace/projects/[id]/client-actions.ts');
check('Client variations do not trigger free partner correction',clientActions.includes("project_change_requests")&&clientActions.includes('variationRecorded'));
check('Client review cannot expose partner uploaded editable files',!clientActions.includes('createSignedUrl(')&&clientActions.includes('review-only')||!clientActions.includes('createSignedUrl(')&&clientActions.includes('Review-Handover-Pack.pdf'));

check('Commercial issue uses approved deposit',read('app/workspace/orchestration/actions.ts').includes("contract.release_basis==='deposit'"));
check('Client quote defaults to 30% advance',read('app/workspace/leads/[id]/QuoteIssueContractFields.tsx').includes("('deposit')"));
const finalContracts=read('supabase/migrations/20261021060000_final_payment_and_owner_release.sql');
const stagedDepositFinalizer=read('supabase/migrations/20261021054100_verified_deposit_stripe_release.sql');
const finalPage=read('app/client-final-files/page.tsx');
const finalCheckout=read('app/project-final-payment/stripe-action.ts');
const finalOwnerAction=read('app/workspace/projects/[id]/final-release-action.ts');
const projectPage=read('app/workspace/projects/[id]/page.tsx');
const modeCode=read('lib/payments/stripeEnvironment.ts');
check('No live Stripe use without production flags, matching backend and checked return origin',
  checkout.includes('stripeRuntimeMode()')&&webhook.includes('stripeRuntimeMode()')&&
  finalCheckout.includes('stripeRuntimeMode()')&&
  modeCode.includes("VERCEL_ENV!=='production'")&&
  modeCode.includes("OP_STRIPE_LIVE_ENABLED!=='true'")&&
  modeCode.includes("OP_PACKAGE01_AUTO_RELEASE_ENABLED!=='true'")&&
  modeCode.includes("sk_live_")&&
  modeCode.includes('OP_STRIPE_LIVE_RETURN_ORIGIN')&&
  read('lib/qa/isolation.ts').includes("url.hostname==='127.0.0.1'"));
check('Deposit finalizer records only frozen opening amount',stagedDepositFinalizer.includes('v_contract.opening_amount')
  &&stagedDepositFinalizer.includes('op_accept_quote_create_project_with_acceptance_core'));
check('Client final payment requires current accepted review and existing project',finalCheckout.includes("project_client_reviews")
  &&finalCheckout.includes('accepted_with_comments')&&finalCheckout.includes("from('projects')"));
check('Signed webhook discriminates opening and final events',webhook.includes("paymentStage==='final'")
  &&webhook.includes('op_record_verified_project_final_settlement')&&webhook.includes("metadata?.payment_stage"));
check('Final settlement RPC requires independently paid Stripe event and amount',finalContracts.includes('op_record_verified_project_final_settlement')
  &&finalContracts.includes("stripe_payment_status='paid'")&&finalContracts.includes('v_event.amount_total is distinct from round(v_required*100)::bigint'));
check('Owner release requires authenticated owner and settled final balance',finalContracts.includes('op_approve_project_final_release')
  &&finalContracts.includes('auth.uid() is distinct from p_user_id')&&finalContracts.includes("array['owner','admin']")
  &&finalContracts.includes('op_project_final_settlements'));
check('Final approval also requires current accepted partner QC submission',finalContracts.includes("s.review_status='accepted'")
  &&finalContracts.includes('partner_delivery_submission_files'));
check('No signed file download before final manual release',finalPage.includes("op_project_final_settlements")
  &&finalPage.includes("op_project_final_release_approvals")&&finalPage.indexOf('op_project_final_release_approvals')<finalPage.indexOf('createSignedUrl('));
check('Only current accepted engineering submission can be downloaded',finalPage.includes("review_status','accepted'")
  &&finalPage.includes("submission_id',reviewed.id"));
check('Owner release action is separate from signed Stripe webhook',finalOwnerAction.includes("assertRole(profile.role,['owner','admin'])")
  &&finalOwnerAction.includes('op_approve_project_final_release'));
check('Partner payment and closure locked behind final release',finalContracts.includes('op_guard_partner_payment_after_final_release')
  &&finalContracts.includes('op_guard_manual_voice_project_closure'));
check('Project 360 explicitly shows manual owner release before closure',projectPage.includes('Approve final engineering file release')
  &&projectPage.includes('readyForManualClosure'));
check('New contractual lifecycle blocks manual quote-to-project bypass',actions.includes("Manual project creation is disabled."));
check('Client portal exposes final balance and approved files separately',portal.includes('finalReviewAccepted&&!finalSettlementVerified')
  &&portal.includes('finalReleaseApproved'));
const correctionMigration=read('supabase/migrations/20261021080000_atomic_client_correction_gate.sql');
const businessCalendarMigration=read('supabase/migrations/20261021081000_seven_workday_client_review.sql');
const clientReviewUi=read('app/workspace/projects/[id]/ProjectClientDecisionActions.tsx');
check('Exactly one included correction is locked by project primary key',correctionMigration.includes('project_id uuid primary key')
  &&correctionMigration.includes('op_client_correction_entitlements'));
check('Correction entitlement and governed stage transition share one transaction',correctionMigration.includes('op_record_client_review_outcome_core')
  &&correctionMigration.indexOf('insert into public.op_client_correction_entitlements')<correctionMigration.indexOf('v_result:=public.op_record_client_review_outcome_core'));
check('Partner defect never consumes included correction',correctionMigration.includes('if not p_partner_defect then'));
check('Out of scope and revision are excluded from free correction flow',correctionMigration.includes("p_feedback_category<>'in_scope_correction'"));
check('Active scope variation uniquely keyed by description',correctionMigration.includes('ux_op_active_variation_per_description'));
check('Feature flag uses database-atomic classified review',clientActions.includes("OP_VOICE_CORRECTION_POLICY_ENABLED==='true'")
  &&clientActions.includes('op_record_classified_client_review'));
check('Seven-workday deadline accounts for England/Wales bank holidays',businessCalendarMigration.includes('op_ew_bank_holidays')
  &&businessCalendarMigration.includes("Europe/London")&&businessCalendarMigration.includes('extract(isodow from v_date)'));
check('England/Wales bank holiday calendar seeded through 2028',businessCalendarMigration.includes("'2026-12-28'")
  &&businessCalendarMigration.includes("'2027-01-01'")&&businessCalendarMigration.includes("'2028-12-26'"));
check('Review deadline persists on the client transmittal',businessCalendarMigration.includes('add column if not exists review_due_at')
  &&businessCalendarMigration.includes('op_seven_workday_client_review'));
check('Project 360 displays seven working day due date',projectPage.includes("OP_VOICE_REVIEW_WINDOW_ENABLED==='true'")
  &&clientReviewUi.includes('Client review deadline:'));
const autoWorkOrder=read('lib/execution/autoWorkOrder.ts');
const documentReviewActions=read('app/workspace/documents/review-actions.ts');
const projectStageActions=read('app/workspace/projects/[id]/actions.ts');
const uniqueWorkOrderSessions=read('supabase/migrations/20261021082000_unique_partner_execution_session.sql');
check('Work order partner is inherited from accepted quote commercial assessment',
  autoWorkOrder.includes("from('commercial_reviews')")&&autoWorkOrder.includes("from('partner_quotes')"));
check('Automatic execution partner assignment requires existing current approved SOW',
  autoWorkOrder.includes("document_type!=='statement-of-work'")&&autoWorkOrder.includes("is_current_revision"));
check('Approved SOW creates controlled partner assignment only when release flag enabled',
  documentReviewActions.includes("OP_AUTO_PARTNER_RELEASE_ENABLED==='true'")&&documentReviewActions.includes('ensureApprovedPartnerAssignment'));
check('Work order only queued after governed ready-for-execution stage and confirmed funds',
  autoWorkOrder.includes("project_stage!=='ready_for_execution'")&&autoWorkOrder.includes("finance?.authorised!==true"));
check('Project stage advancement triggers partner work-order issuance',
  projectStageActions.includes('releaseApprovedPartnerWorkOrder(supabase'));
check('Work order email never includes client company or quote margin',
  !autoWorkOrder.includes("project:project.title")&&autoWorkOrder.includes("project:'Controlled engineering work order'"));
check('Concurrent partner execution sessions are unique by active assignment',
  uniqueWorkOrderSessions.includes('ux_op_one_live_partner_execution_session'));
check('No partner work-order email in non-isolated Preview',
  autoWorkOrder.includes('isKnownIsolatedQaBackend'));
const financeHandoffSql=read('supabase/migrations/20261019030000_project_financial_release_handoff.sql');
check('Project finance handoff SQL function has complete delimiter',financeHandoffSql.trimEnd().endsWith('$function$;'));
check('Project finance inherits exactly the accepted quotation revision',financeHandoffSql.includes('quote_revision=(select revision from public.quotes where id=new.quote_id)'));
const liveSql=read('supabase/migrations/20261021090000_live_stripe_payment_reconciliation.sql');
check('Live paid events are distinguished and live-only finalizers reject QA evidence',
  liveSql.includes('add column if not exists livemode boolean not null default false')&&
  liveSql.includes('op_finalize_live_stripe_quote_payment')&&
  liveSql.includes('op_record_live_stripe_final_settlement')&&
  liveSql.includes("v_event.livemode is distinct from true")&&
  webhook.includes("livemode:mode==='live'"));
check('Offline release-mode regression exists',
  read('scripts/stripe-live-readiness-check.mjs').includes('Live payment disabled on unsafe'));
const failed=checks.filter(c=>!c.passed);
console.log('OPOS lifecycle integration checks: '+(checks.length-failed.length)+'/'+checks.length+' passed');
for(const f of failed)console.error(' - '+f.label);
assert.equal(failed.length,0,'Lifecycle integration regression checks failed');
// These checks assert code wiring and deny-list invariants; live database transactions,
// actor identity and email delivery still require dedicated integration testing.
