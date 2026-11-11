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
