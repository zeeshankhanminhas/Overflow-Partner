import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('authenticated browser QA runs only by approved manual dispatch from main',()=>{
 const workflow=read('.github/workflows/opos-authenticated-browser-qa.yml');
 const config=read('qa/browser/authenticated.config.mjs');
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/\npull_request:|\npush:/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/environment: opos-qa-auth/);
 assert.match(config,/OPOS_AUTH_QA_APPROVED/);
 assert.match(config,/GITHUB_REF/);
 assert.match(config,/GITHUB_EVENT_NAME/);
 assert.match(config,/screenshot:'off'/);
 assert.match(config,/video:'off'/);
 assert.match(config,/trace:'off'/);
});
test('three credential-backed identities have independent browser contexts',()=>{
 const source=read('qa/browser/tests/authenticated.spec.mjs');
 assert.match(source,/await browser\.newContext\(/);
 assert.match(source,/await context\.close\(\)/);
 assert.match(source,/CONTROLLER/);
 assert.match(source,/CLIENT/);
 assert.match(source,/PARTNER/);
 assert.doesNotMatch(source,/storageState\s*:/);
 assert.doesNotMatch(source,/writeFileSync|console\.log\(.*PASSWORD/);
});
