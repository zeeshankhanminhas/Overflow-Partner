import { readFileSync } from 'node:fs';

const checks=[];
const expect=(condition,label)=>checks.push({pass:Boolean(condition),label});
const read=(path)=>readFileSync(path,'utf8');

const case360=read('app/workspace/leads/[id]/page.tsx');
const caseDocs=read('lib/cases/documentRequirements.ts');
const projectDocs=read('lib/projects/documentRequirements.ts');
const registry=read('components/workspace/documents/documentRegistry.ts');
const generate=read('app/workspace/documents/generate-actions.ts');
const execution=read('app/workspace/projects/[id]/execution/actions.ts');
const executionPage=read('app/workspace/projects/[id]/execution/page.tsx');
const approvals=read('lib/presentation/approvals.ts');
const reviewActions=read('app/workspace/documents/review-actions.ts');
const controlActions=read('app/workspace/documents/control-actions.ts');
const migration=read('supabase/migrations/20261013090000_streamline_case_and_handover_documents.sql');
const quotePreview=read('app/workspace/documents/templates/[document]/page.tsx');
const quoteValidityAction=read('app/workspace/orchestration/quote-validity-actions.ts');
const quoteValidityMigration=read('supabase/migrations/20261013222800_record_draft_quote_validity.sql');
const orchestrationActions=read('app/workspace/orchestration/actions.ts');
const lifecycleTemplates=read('lib/notifications/templates.ts');

const projectBranch=case360.indexOf('if(workflow.project)');
const missingIntakeBranch=case360.indexOf('else if(!workflow.technicalIntake)',projectBranch);
const technicalApprovalBranch=case360.indexOf('else if(workflow.technicalIntake&&!technicalApproved)',missingIntakeBranch);
const commercialBranch=case360.indexOf('else if(partnerApproved&&workflow.partnerQuote&&!workflow.commercialReview)',technicalApprovalBranch);
expect(projectBranch>=0&&projectBranch<missingIntakeBranch&&missingIntakeBranch<technicalApprovalBranch&&technicalApprovalBranch<commercialBranch,
  'Case actions preserve technical scope approval before commercial position');
expect(!case360.slice(case360.indexOf('\n',projectBranch),case360.indexOf('const documentConfig',projectBranch)).split('\n').some(line=>/^\s*if\(/.test(line)),
  'Case action decisions use one exclusive progression chain');
expect(caseDocs.includes("slug: 'client-requirements'")&&caseDocs.includes("slug: 'partner-technical-assessment-report'")&&caseDocs.includes("slug: 'client-quote'"),
  'Case retains requirements, Partner assessment and Client Quote records');
expect(!caseDocs.includes("slug: 'scope-of-work'")&&!caseDocs.includes("slug: 'vendor-safe-package'")&&!caseDocs.includes("slug: 'commercial-approval'")&&!caseDocs.includes("slug: 'statement-of-work'"),
  'Case requirements omit duplicate or later-stage documents');
expect(["slug: 'scope-of-work'","slug: 'commercial-approval'","slug: 'vendor-safe-package'"].every((slug)=>new RegExp(`${slug}[^\\n]*lifecycle: 'dormant'`).test(registry)),
  'Duplicate Scope of Work, commercial approval and partner package templates are dormant');
expect(generate.includes('isDormantWorkspaceDocument(slug)')&&!generate.includes("'scope-of-work','statement-of-work','handover-pack'"),
  'Server-side document generation blocks dormant documents and Case-only legacy scope generation');
expect(approvals.includes('if (isDormantWorkspaceDocument(document.document_type)) continue;')&&reviewActions.includes('assertDocumentActive(document)')&&controlActions.includes('isDormantWorkspaceDocument(document.document_type)'),
  'Dormant records stay out of approvals and cannot be revised, approved or issued');
expect(projectDocs.includes("slug: 'statement-of-work'")&&!projectDocs.includes("slug: 'scope-of-work'"),
  'Project mobilisation requires one Statement of Work');
expect(execution.includes("scope.document_type!=='statement-of-work'")&&executionPage.includes(".eq('document_type','statement-of-work')"),
  'Partner release accepts only the approved Statement of Work');
expect(migration.includes("document_type='partner-technical-assessment-report'")&&!migration.includes("'scope-of-work',v_ref,'Scope of Work','draft'"),
  'Technical approval creates assessment evidence without auto-creating duplicate Scope of Work');
expect(migration.includes("Approved Partner Technical Assessment is required before Commercial Review.")&&!migration.includes("Approved Scope of Work is required before Commercial Review."),
  'Commercial Review retains technical and Partner gates without Scope of Work gate');
expect(migration.includes('op_project_stage_readiness_with_duplicate_scope_gate')&&migration.includes("'Approved execution scope is required.'")&&!migration.includes("'Approved Statement of Work is required.',"),
  'Project readiness removes only duplicate Scope gate and retains Statement of Work');
expect(quotePreview.includes('quoteForValidity.status === \'draft\'')&&quotePreview.includes('name="valid_until"')&&quotePreview.includes('recordDraftQuoteValidityAction'),
  'A draft Client Quote exposes an action to record its missing expiry');
expect(quoteValidityAction.includes("assertRole(profile.role, ['owner','admin','commercial'])")&&quoteValidityAction.includes("'op_set_draft_quote_validity'")&&quoteValidityAction.includes('revalidatePath(`/workspace/leads/${leadId}`)'),
  'Quote expiry changes use an authorised, audited workflow action');
expect(quoteValidityMigration.includes("v_quote.status::text <> 'draft'")&&quoteValidityMigration.includes("d.status::text in ('draft','changes_requested')")&&quoteValidityMigration.includes('quote_validity_recorded'),
  'Quote expiry can change only on a working draft and is recorded in activity history');
const quoteSendStart=orchestrationActions.indexOf('export async function issueQuoteAction');
const quoteSendEnd=orchestrationActions.indexOf('export async function acceptQuoteAction',quoteSendStart);
const quoteSendAction=orchestrationActions.slice(quoteSendStart,quoteSendEnd);
expect(quoteSendAction.indexOf('sendClientQuoteEmail(')>=0&&quoteSendAction.indexOf('sendClientQuoteEmail(')<quoteSendAction.indexOf("rpc('op_issue_quote_with_evidence'"),
  'Client Quote delivery is accepted by the email provider before the quote is recorded as issued');
expect(quoteSendAction.includes('Resend message ${delivery.providerMessageId}')&&quoteSendAction.includes('recipientEmail'),
  'Client Quote issue evidence records the provider message and actual recipient');
const quoteResendStart=orchestrationActions.indexOf('export async function resendClientQuoteAction');
const quoteResendEnd=orchestrationActions.indexOf('export async function acceptQuoteAction',quoteResendStart);
const quoteResendAction=orchestrationActions.slice(quoteResendStart,quoteResendEnd);
expect(quoteResendStart>=0&&quoteResendAction.includes("deliveryKind:'resend'")&&quoteResendAction.includes("p_event_type:'client_quote_resent'")&&!quoteResendAction.includes("rpc('op_issue_quote_with_evidence'"),
  'Resending an issued quote sends a distinct delivery and audit event without issuing a duplicate revision');
expect(quoteResendAction.includes("issue.client_response")&&quoteResendAction.includes('issue.recipient_email'),
  'Quote resend is limited to the original recipient before a client response');
expect(case360.includes('Send Client Quote by email')&&case360.includes('The approved scope, deliverables, price, VAT and expiry will be emailed now'),
  'Case action makes immediate email delivery explicit to the operator');
expect(case360.includes('Resend the issued Client Quote')&&case360.includes('name="request_id"')&&case360.includes('resendClientQuoteAction'),
  'An issued Client Quote can be safely resent from its active Case stage');
expect(case360.includes('Revise the Client Quote')&&case360.includes('The current issue will be archived and the new revision must be approved and sent'),
  'An issued Client Quote can be revised when the client requests a change');
expect(lifecycleTemplates.includes('payload.clientQuoteFacts'),
  'The quotation email includes client-facing scope and commercial facts');

let failed=0;
for(const check of checks){
  console.log(`${check.pass?'PASS':'FAIL'} ${check.label}`);
  if(!check.pass)failed+=1;
}
console.log(`Case and handover workflow checks: ${checks.length-failed}/${checks.length} passed`);
if(failed)process.exit(1);
