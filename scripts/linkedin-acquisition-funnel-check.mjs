import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const funnelSource = readFileSync(new URL('lib/acquisition/linkedinFunnel.ts', root), 'utf8');
const compiled = ts.transpileModule(funnelSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const cjs = { exports: {} };
vm.runInNewContext(compiled, { module: cjs, exports: cjs.exports }, { filename: 'linkedinFunnel.js' });
const { linkedInFunnelStage, linkedinFunnelStages } = cjs.exports;
const record = (changes = {}) => ({ id: 'prospect-1', company_name: 'Test Engineering', status: 'identified', outreach_status: 'not_contacted', response_outcome: null, ...changes });

assert.equal(linkedinFunnelStages.length, 5);
assert.equal(linkedInFunnelStage(record()), 'identified');
assert.equal(linkedInFunnelStage(record({ outreach_status: 'message_sent' })), 'outreach');
assert.equal(linkedInFunnelStage(record({ outreach_status: 'follow_up_due' })), 'outreach');
assert.equal(linkedInFunnelStage(record({ outreach_status: 'replied', response_outcome: 'referred' })), 'conversation');
assert.equal(linkedInFunnelStage(record({ outreach_status: 'replied', response_outcome: 'interested' })), 'interested');
assert.equal(linkedInFunnelStage(record({ outreach_status: 'replied', response_outcome: 'later' })), 'nurture');
assert.equal(linkedInFunnelStage(record({ outreach_status: 'paused' })), 'nurture');
assert.equal(linkedInFunnelStage(record({ response_outcome: 'not_interested' })), 'closed');
assert.equal(linkedInFunnelStage(record({ status: 'not_a_fit' })), 'closed');
assert.equal(linkedInFunnelStage(record({ outreach_status: 'replied', response_outcome: 'interested' }), true), 'handoff');
assert.equal(linkedInFunnelStage(record({ status: 'converted', converted_lead_id: 'case-1' })), 'handoff');

const actions = readFileSync(new URL('app/workspace/acquisition/actions.ts', root), 'utf8');
assert.match(actions, /parsed\.data\.email && parsed\.data\.source !== 'linkedin'/, 'LinkedIn cold prospect must not trigger auto-enquiry email');
assert.match(actions, /prospect\.source === 'linkedin' && !\(prospect\.outreach_status === 'replied' && prospect\.response_outcome === 'interested'\)/, 'LinkedIn requirements handoff must require interested reply');
assert.match(actions, /\['qualified', 'converted'\]\.includes\(parsed\.data\.status\)/, 'Manual intake cannot bypass governed qualification');
console.log('LinkedIn acquisition funnel: stage transitions and pre-enquiry boundaries passed.');
