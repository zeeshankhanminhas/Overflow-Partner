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
 assert.match(adapter,/resolveCurrentAction\(\{actor,phase,evidence,capabilities:\{\},openingBasis\}\)/);
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
 assert.doesNotMatch(component,/<Link|<button/);
});
