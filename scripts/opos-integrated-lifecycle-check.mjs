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
check('Checkout strictly Preview and test Stripe keys',checkout.includes("VERCEL_ENV !== 'preview'")&&checkout.includes("startsWith('sk_test_')"));
check('Checkout requires explicit quote allowlist',checkout.includes("from('op_sandbox_payment_authorisations')")&&checkout.includes("quote_revision"));
check('Webhook signature and mode validated',webhook.includes('validSignature(')&&webhook.includes('session.livemode !== false'));
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
check('Checkout requires matching full-upfront release terms',checkout.includes("contract.release_basis!=='payment'"));
check('Stripe webhook requires matching terms and named signatory',webhook.includes('quote_client_signatory_attestations')&&webhook.includes("contract.release_basis!=='payment'"));
check('Payment never redirects Stripe Sandbox to production fallback',checkout.includes('const previewHost = process.env.VERCEL_URL')&&!checkout.includes("const site = process.env.NEXT_PUBLIC_APP_URL || 'https://overflow-partner.vercel.app'"));
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
const failed=checks.filter(c=>!c.passed);
console.log('OPOS lifecycle integration checks: '+(checks.length-failed.length)+'/'+checks.length+' passed');
for(const f of failed)console.error(' - '+f.label);
assert.equal(failed.length,0,'Lifecycle integration regression checks failed');
// These checks assert code wiring and deny-list invariants; live database transactions,
// actor identity and email delivery still require dedicated integration testing.
