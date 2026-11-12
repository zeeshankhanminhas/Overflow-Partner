import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('Helix payment smoke test never fabricates a client review',()=>{
 const scenario=read('scripts/qa/stripe-http-second-org-e2e.mjs');
 assert.doesNotMatch(scenario,/recordSyntheticAcceptance|disable trigger|insert\s+into\s+public\.project_client_reviews/i);
 assert.doesNotMatch(scenario,/execFileSync\s*\(\s*['"]docker['"]/);
 assert.match(scenario,/replayed final event stays blocked without client acceptance/);
});

test('client portal binds a review submission to an explicit authorised recipient',()=>{
 const page=read('app/client-portal/page.tsx');
 const action=read('app/client-portal/review-action.ts');
 assert.match(page,/Submit project review/);
 assert.match(page,/action=\{submitClientProjectReview\}/);
 assert.match(page,/authority_attested/);
 assert.match(action,/verifyClientPortalToken\(token\)/);
 assert.match(action,/op_record_attested_client_portal_review/);
 assert.match(action,/p_quote_id:access.quoteId/);
 assert.match(action,/p_transmittal_id:transmittalId/);
});

test('DB enforces current-cycle transmittal, recipient, quote and project gates',()=>{
 const sql=read('supabase/migrations/20261111143500_attested_client_portal_review.sql');
 assert.match(sql,/security definer/);
 assert.match(sql,/service_role/);
 assert.match(sql,/grant execute.*op_record_attested_client_portal_review/s);
 assert.match(sql,/v_project\.project_stage<>'client_review'/);
 assert.match(sql,/execution_cycle=v_cycle/);
 assert.match(sql,/v_tx\.recipient_email/);
 assert.match(sql,/p_quote_revision/);
 assert.match(sql,/document_type='handover-pack'/);
 assert.match(sql,/client_submitted_by_email/);
 assert.match(sql,/already recorded for this cycle/);
});

test('operator evidence does not count as proof of client interaction',()=>{
 const operator=read('app/workspace/projects/[id]/client-actions.ts');
 assert.match(operator,/recordClientReviewOutcomeAction/);
 const scenario=read('scripts/qa/stripe-http-second-org-e2e.mjs');
 assert.doesNotMatch(scenario,/recordClientReviewOutcomeAction|client-actions\.ts/);
});

test('client transmittal and reminder send a signed review portal route instead of a homepage',()=>{
 const delivery=read('app/workspace/projects/[id]/client-actions.ts');
 assert.match(delivery,/createClientPortalToken\(quote\.id,Number\(quote\.revision\)\)/);
 assert.match(delivery,/actionUrl:reviewUrl/);
 assert.doesNotMatch(delivery,/scenario:'client_delivery\.issued'[^\n]*actionUrl:appUrl\(\)/);
 assert.doesNotMatch(delivery,/scenario:'client_delivery\.review_reminder'[^\n]*actionUrl:appUrl\(\)/);
});

test('partner setup is available before partner execution, but only during governed setup stages',()=>{
 const page=read('app/workspace/projects/[id]/execution/page.tsx');
 assert.match(page,/const canConfigureAssignment=\['mobilisation','ready_for_execution'\]/);
 assert.match(page,/disabled=\{noCommercialPartner\|\|partnerMismatch\|\|documents\.length===0\|\|!canConfigureAssignment\}/);
 assert.doesNotMatch(page,/disabled=\{noCommercialPartner\|\|partnerMismatch\|\|documents\.length===0\|\|!executionActive\}/);
});

test('accepted client intake becomes the canonical prospect requirement without SQL fixture shortcuts',()=>{
 const handler=read('app/api/intake/[token]/route.ts');
 assert.match(handler,/requirement_summary: payload\.description, project_type: payload\.project_type/);
 assert.match(handler,/\.eq\('organisation_id', session\.organisation_id\)\.eq\('id', session\.prospect_id\)/);
 assert.match(handler,/if \(summaryError\) throw summaryError/);
});

test('Project 360 exposes governed document generation rather than dead preview-only evidence links',()=>{
 const source=read('app/workspace/projects/[id]/page.tsx');
 assert.match(source,/DocumentGenerationPanel context="project" recordId=\{id\}/);
 assert.match(source,/items=\{documentRequirements\}/);
 assert.doesNotMatch(source,/href=\{\`\/workspace\/documents\/templates\/\$\{item\.key\}\?project=\$\{id\}\`\}/);
});

test('internal Technical Review is an active Project QA record and not a Partner Assessment alias',()=>{
 const registry=read('components/workspace/documents/documentRegistry.ts');
 const actions=read('app/workspace/documents/generate-actions.ts');
 const contracts=read('components/workspace/documents/documentDataContracts.ts');
 const adapter=read('components/workspace/documents/documentAdapter.ts');
 assert.match(registry,/slug: 'technical-review', title: 'Internal Technical Review', dataStatus: 'live-backed', lifecycle: active/);
 assert.doesNotMatch(registry,/'technical-review': 'partner-technical-assessment-report'/);
 assert.match(actions,/const projectDocuments:[\s\S]*?'technical-review'/);
 assert.doesNotMatch(actions,/const caseDocuments:[^\n]*'technical-review'/);
 assert.match(contracts,/'technical-review': contract\('internal', \['project', 'documentControl', 'deliveryEvidence'\]\)/);
 assert.match(adapter,/partner_delivery_submission_files/);
 assert.match(adapter,/completedPartnerSubmission/);
});
