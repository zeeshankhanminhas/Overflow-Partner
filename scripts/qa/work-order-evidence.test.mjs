import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';

const source=readFileSync(new URL('../../lib/presentation/canonicalProjectDecision.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
const {canonicalProjectDecision}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));

test('incomplete Work Order data never grants mobilisation or commencement action',()=>{
 for(const facts of [
  {stage:'mobilisation'},
  {stage:'mobilisation',workOrderIssued:true},
  {stage:'ready_for_execution'},
 ]) {
  const result=canonicalProjectDecision(facts);
  assert.equal(result.key,'evidence_unavailable');
  assert.equal(result.waiting,true);
 }
});

test('only explicit acceptance permits next stage instruction',()=>{
 assert.equal(canonicalProjectDecision({stage:'mobilisation',workOrderIssued:false}).key,'issue_work_order');
 assert.equal(canonicalProjectDecision({stage:'mobilisation',workOrderIssued:true,workOrderAccepted:false}).key,'accept_work_order');
 assert.equal(canonicalProjectDecision({stage:'mobilisation',workOrderIssued:true,workOrderAccepted:true}).key,'complete_mobilisation');
 assert.equal(canonicalProjectDecision({stage:'ready_for_execution',workOrderAccepted:false}).key,'accept_work_order');
 assert.equal(canonicalProjectDecision({stage:'ready_for_execution',workOrderAccepted:true}).key,'confirm_commencement');
});
