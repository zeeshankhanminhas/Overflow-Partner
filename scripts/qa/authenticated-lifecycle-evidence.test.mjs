import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const load=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const adapter=load('lib/lifecycle/authenticatedProjectEvidence.ts');
const component=load('components/workspace/ProjectLifecycleEvidence.tsx');
const operator=load('app/workspace/projects/[id]/page.tsx');
const external=load('app/portal/[kind]/projects/[projectId]/page.tsx');
const engine=load('lib/lifecycle/currentAction.ts');
test('all 28 gates share the original fail-closed reducer',()=>{
 assert.match(adapter,/Object\.fromEntries\(lifecycleGates\.map/);
 assert.match(adapter,/resolveCurrentAction\(\{actor,phase,evidence,capabilities,openingBasis\}\)/);
 assert.match(engine,/const gate = gates\.find\(item => input\.evidence\[item\.key\]\?\.state !== 'verified'\)/);
 assert.match(adapter,/state:'unknown'/);
});
test('authenticated roles require exact membership before privileged QA evidence reads',()=>{
 assert.match(adapter,/await db\.auth\.getUser\(\)/);
 assert.match(adapter,/\.eq\('id',identity\.data\.user\.id\)/);
 assert.match(adapter,/portal_my_projects/);
 assert.match(adapter,/p\.project_id===projectId&&p\.portal_kind===actor/);
 assert.match(adapter,/isKnownIsolatedQaBackend\(\)/);
 assert.match(adapter,/\.eq\('organisation_id',organisationId\)\.eq\('id',projectId\)/);
});
test('revision and scope boundaries prevent stale work-order and submission acceptance',()=>{
 assert.match(adapter,/r\.scope_revision_code===order\.row\.scope_revision_code/);
 assert.match(adapter,/execution_cycle:cycle/);
 assert.match(adapter,/submission_id:submissionId/);
 assert.match(adapter,/is_current_revision:true/);
});
test('all project pages display one common owner/reason diagnostic',()=>{
 assert.match(operator,/<ProjectLifecycleEvidence actor="operator" projectId=\{id\}/);
 assert.match(external,/<ProjectLifecycleEvidence actor=\{kind\} projectId=\{projectId\}/);
 assert.match(component,/Responsible role:/);
 assert.match(component,/action\.reason/);
 assert.match(component,/action\.canExecute&&destination\?<Link/);
 assert.match(adapter,/const capabilities:Partial<Record<GateKey,ActionCapability>>=\{\}/);
});

test('partner capabilities require assigned identity and recorded current-stage prerequisite',()=>{
 assert.match(adapter,/assignment\.row\?\.partner_id===entitledExternalAccountId/);
 assert.match(adapter,/actor==='partner'&&Boolean\(entitledExternalAccountId\)/);
 assert.match(adapter,/assignment\.row\?\.execution_state==='awaiting_acknowledgement'/);
 assert.match(adapter,/evidence\.work_order_accepted\.state==='verified'/);
 assert.match(adapter,/evidence\.commencement_confirmed\.state==='verified'/);
 assert.match(adapter,/partner_execution\.delivery_submitted/);
});
test('client review capability comes only from member-scoped protected review service',()=>{
 assert.match(adapter,/db\.rpc\('op_qa_client_review_position'/);
 assert.match(adapter,/review\?\.projectId===projectId&&review\.canRespond/);
 assert.match(adapter,/evidence\.client_review_issued\.state==='verified'/);
 assert.match(adapter,/completionEvent:'client_review\.client_attested'/);
});

test('operator capabilities match authenticated role and exact current technical submission',()=>{
 assert.match(adapter,/select\('organisation_id,is_active,role'\)/);
 assert.match(adapter,/db\.rpc\('op_qa_delivery_gate',\{p_project_id:projectId\}\)/);
 assert.match(adapter,/gate\.submission_id===currentSubmissionId&&gate\.storage_complete/);
 assert.match(adapter,/allowedEngineering&&/);
 assert.match(adapter,/allowedManifest&&/);
 assert.match(adapter,/allowedIssue&&/);
 assert.match(adapter,/completionEvent:'engineering\.qa_decided'/);
 assert.match(adapter,/completionEvent:'delivery\.manifest_verified'/);
 assert.match(adapter,/completionEvent:'client_review\.protected_issued'/);
});

test('confidentiality only passes real governed lineage, never QA simulation',()=>{
 assert.match(adapter,/trusted\.rpc\('op_preproject_lineage_readiness'/);
 assert.match(adapter,/lineageState\.reason==='approved_prequotation_lineage'/);
 assert.match(adapter,/lineageState\.simulation!==true/);
 assert.match(adapter,/lineageState\?\.simulation===true/);
 assert.match(adapter,/verified\('confidentiality_confirmed',true\)/);
});

test('QA simulated or manually cleared partner transfer never passes verified bank settlement',()=>{
 assert.match(adapter,/qa_simulated_bank_transfer/);
 assert.match(adapter,/evidence\.partner_payment_verified=\{state:'unknown'/);
 assert.match(adapter,/A real partner bank transfer requires independently reconciled settlement evidence/);
 assert.doesNotMatch(adapter,/check\('partner_payment_verified',payment/);
});

test('one authoritative next-action headline controls all three project pages',()=>{
 const shell=load('app/opos-next/WorkRecordV2.tsx');
 const partner=load('components/execution/PartnerWorkSurface.tsx');
 assert.match(component,/aria-label="Authoritative project next action"/);
 assert.match(operator,/showDecision=\{false\}/);
 assert.match(shell,/showDecision=true/);
 assert.match(shell,/\{showDecision\?<section className=\{css\.decision\}/);
 assert.doesNotMatch(external,/aria-label="Current next step"/);
 assert.match(external,/<PartnerWorkSurface embeddedDecision/);
 assert.match(external,/Secure review, settlement and handover services/);
 assert.match(partner,/embeddedDecision=false/);
 assert.match(partner,/\{!embeddedDecision\?<><h2/);
 assert.match(partner,/id="partner-work-controls"/);
});
test('capability links land on actual guarded work surfaces, not the top of the same record',()=>{
 assert.match(component,/actor==='operator'\?'#project-controls'/);
 assert.match(component,/actor==='partner'\?'#partner-work-controls'/);
 assert.match(component,/action\.key==='client_review_accepted'\?'#drawing-review'/);
 assert.match(component,/action\.canExecute&&destination\?<Link/);
});
