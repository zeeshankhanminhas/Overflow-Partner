import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync('app/opos-next/projects/[id]/page.tsx','utf8');
const actions=readFileSync('app/opos-next/projects/[id]/qa-actions.ts','utf8');
const migration=readFileSync('supabase/migrations/20261104094500_qa_engineering_manifest_release_separation.sql','utf8');
for(const token of ['op_qa_delivery_gate','recordEngineeringDecisionAction','verifyDeliveryManifestAction','authoriseClientReviewReleaseAction'])assert.ok(page.includes(token),token);
assert.ok(!page.includes('Two controlled review documents'),'No legacy doc-approval path');
assert.ok(!page.includes('name="target_stage" value="partner_correction"'),'No bypass around engineering decision');
for(const token of ['assertIsolatedQaBackend','op_qa_engineering_decision','op_qa_verify_manifest','op_qa_authorise_review_release'])assert.ok(actions.includes(token),token);
for(const token of ["'submission_id'","'manifest_hash'","'engineering_accepted'","'manifest_verified'","'release_authorised'","Secure watermarked view-only Client Review Package"])assert.ok(migration.includes(token),token);
assert.ok(migration.includes("v_review is not null")&&migration.includes("v_verified is not null"),'Distinct evidence required');
const historicActions=readFileSync('app/workspace/documents/review-actions.ts','utf8');
const historicRoute=readFileSync('app/opos-next/documents/[id]/page.tsx','utf8');
const oldCreation=readFileSync('supabase/migrations/20261104095000_qa_stop_duplicate_internal_review_document_autocreation.sql','utf8');
assert.ok(historicActions.includes("['technical-review','document-register'].includes(document.document_type)"),'Old project-document approval path must be disabled');
assert.ok(historicRoute.includes('historicOperationalRecord'),'Historical document must route to Project 360');
assert.ok(oldCreation.includes("v_begin:=strpos"),'Do not auto-create duplicate documents for future submissions');
const globalFields=readFileSync('app/globals.css','utf8');
const qaStyles=readFileSync('app/opos-next/opos.module.css','utf8');
assert.ok(globalFields.includes('input:not([type="checkbox"]):not([type="radio"]), select, textarea { width: 100%; }'),
 'Shared full-width field sizing must exempt checkbox and radio controls');
assert.ok(page.includes('<fieldset className={css.qaChecklist}>')&&
 page.includes('className={css.qaChecklistRow}')&&page.includes('<span>{label}</span>'),
 'Engineering QA checklist must keep each checkbox adjacent to readable label text');
assert.ok(page.includes('<input type="checkbox" required name="confirmed" value="true"/><span>'),
 'Manifest checkbox and its attestation must stay within one aligned label');
assert.ok(qaStyles.includes('grid-template-columns: 18px minmax(0, 1fr)')&&
 qaStyles.includes('.qaChecklistRow input[type="checkbox"]')&&qaStyles.includes('width: 18px;'),
 'QA checkbox control width must remain intrinsic at desktop and mobile sizes');
console.log('Engineering acceptance, manifest, release and legacy-route QA contracts: PASS (static). Authenticated browser review remains to be tested.');
