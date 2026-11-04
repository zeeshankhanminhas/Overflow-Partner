import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file)=>readFileSync(file,'utf8');
const data=read('app/opos-next/qa/walkthrough/journey.ts');
const page=read('app/opos-next/qa/walkthrough/page.tsx');
const client=read('app/opos-next/qa/walkthrough/WalkthroughClient.tsx');
const css=read('app/opos-next/qa/walkthrough/walkthrough.module.css');
const nav=read('app/opos-next/navigation.ts');
const steps=[...data.matchAll(/\bid:'([a-z][a-z0-9-]+)'/g)].map(m=>m[1]);
assert.ok(steps.length>=32,'Complete end-to-end journey must have 32+ detailed steps');
assert.equal(new Set(steps).size,steps.length,'Each step ID must be unique');
for(const stage of [
 'Opportunity','Requirements','Feasibility','Commercial Offer','Contractual Commitment',
 'Mobilisation','Execution','Quality Assurance','Delivery','Payment Settlement','Closure',
])assert.ok(data.includes("'"+stage+"'"),'Missing lifecycle stage '+stage);
for(const role of ["client","operator","partner"])
 assert.ok(client.includes("actorLinks")&&data.includes(role+':'),'Missing '+role+' portal');
for(const id of ['client-intake','partner-feasibility','commercial-model','client-quote-decision',
 'opening-payment','project-creation','work-order','partner-commencement','partner-delivery',
 'internal-technical-qa','technical-correction','manifest-verify','client-review-authority',
 'secure-review','client-correction','variation-control','final-payment',
 'final-release','native-handover','partner-payable','project-closure'])
 assert.ok(steps.includes(id),'Missing mandatory governed business event '+id);
for(const scenario of ['standard','technical_correction','client_correction','variation'])
 assert.ok(data.includes(scenario+':'),'Missing scenario '+scenario);
assert.ok(data.includes("id:'secure-review'")&&data.includes("status:'blocked'"),
 'Unimplemented view-only client review must be disclosed and blocked');
assert.ok(data.includes('no project')||data.includes('No project'),'Advance payment gating must be clear');
assert.ok(data.includes('one included')||data.includes('One included'),'Correction entitlement missing');
assert.ok(data.includes('current-cycle')||data.includes('current cycle'),'Version-specific QA required');
assert.ok(page.includes("isKnownIsolatedQaBackend()")&&page.includes("notFound()"),'Tour must be QA-only');
assert.ok(page.includes('requireUserContext()')&&page.includes("eq('organisation_id',organisationId)"),'Tour must be organisation-scoped');
assert.ok(!/\.(?:insert|update|delete|upsert)\s*\(/.test(page),'Tour server must never write');
assert.ok(!/fetch\(\s*['"]\/api\//.test(client),'Tour client must not use mutation APIs');
for(const phrase of ['Three portals','navigator.clipboard.writeText','read-only','Actual'])
 assert.ok(client.toLowerCase().includes(phrase.toLowerCase())||data.toLowerCase().includes(phrase.toLowerCase()),
  'Guide must explain boundary '+phrase);
assert.ok(client.includes('scenarioSteps(scenario)')&&client.includes('setVerdicts'), 'Interactive scenario and observation controls required');
assert.ok(nav.includes("href:'/opos-next/qa/walkthrough'"),'Operator navigation must link the guide');
assert.ok(css.includes('@media')&&css.includes('.personas'),'Responsive three-portal experience required');
console.log('Three-portal E2E walkthrough: '+steps.length+' unique steps, 11 stages, 4 scenario paths, 3 role views, secure QA-only read access. Static contract PASS.');
