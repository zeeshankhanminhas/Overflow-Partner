import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const sql=read('scripts/qa/client-review-outcome-matrix.sql');
const page=read('app/portal/client/projects/[projectId]/review/ClientDrawingReview.tsx');
const action=read('app/portal/client/projects/[projectId]/review/review-actions.ts');
const operator=read('app/opos-next/projects/[id]/qa-actions.ts');

// This static guard runs during every build. The separate SQL integration matrix
// is run against the QA Supabase project, never against production or at build time.
// Do not pretend source assertions substitute for authenticated browser testing.
assert.ok(sql.includes('ukcamenuxhdznxaxpyis') &&
  sql.includes('b447f586-bf79-4839-be5e-1af607d9ca43') &&
  sql.includes('QA R01 baseline') &&
  sql.includes('already decided'),
  'Integration matrix must fail closed to exact undecided QA fixture');
assert.ok(sql.includes('EXPECTED_ROLLBACK_CLIENT_SCENARIO') &&
  sql.includes('EXPECTED_ROLLBACK_OPERATOR_SCENARIO') &&
  (sql.match(/WHEN SQLSTATE 'QA001' THEN NULL/g)||[]).length===2,
  'Client and Operator decision writes must be rolled back independently');
assert.ok(!/\b(?:COMMIT|TRUNCATE|DROP|DELETE)\b\s+(?:TABLE|FROM)?\s+(?:public\.|auth\.)/i.test(sql),
  'Integration suite must never destructively reset shared QA records');
for(const outcome of ['accepted','accepted_with_comments','changes_requested','rejected']){
 assert.ok(sql.includes("'"+outcome+"'") &&
   page.includes('<option value="'+outcome+'">') &&
   action.includes("'"+outcome+"'"),
   'Client Portal and SQL test must include '+outcome);
}
assert.ok(sql.includes('d.decided_by=v_client')&&
  sql.includes('d.comments=v_comments')&&
  sql.includes("v_position->>'canRespond'")&&
  sql.includes('Duplicate client submission was accepted'),
  'Test attribution, feedback, display state and one-decision constraint');
assert.ok(sql.includes('op_qa_reconcile_client_review_decision') &&
  sql.includes('op_qa_classify_and_resolve_client_feedback') &&
  sql.includes("'included_correction'") &&
  sql.includes("'variation'") &&
  sql.includes("v_response->>'partnerInstructed'") &&
  sql.includes('OP staff was able to impersonate client') &&
  sql.includes('Missing required comments was allowed') &&
  sql.includes('Invalid outcome was allowed'),
  'Test Operator reconciliation, classification and negative authorization paths');
assert.ok(action.includes("supabase.auth.getUser()") &&
  action.includes("supabase.rpc('op_qa_record_client_review_decision'") &&
  action.includes("form.get('confirmed')") &&
  operator.includes('reconcileProtectedClientReviewAction') &&
  operator.includes('classifyClientFeedbackAction'),
  'UI actions must retain authenticated server-side review and Operator reconciliation');
assert.ok(!/\.(?:from\(['"](?:invoices|project_payments|partner_payables)['"]\))\.(?:update|insert|upsert)/.test(action),
  'Client decision action cannot manipulate final settlement');
console.log('PASS: Client Review matrix contract — 4 choices, separate rollback cases, 3 negative guards and OP follow-up controls.');
