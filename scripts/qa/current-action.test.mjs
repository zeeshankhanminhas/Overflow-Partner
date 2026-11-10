import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';

// Transpile the actual pure production module without adding a runtime loader.
const source = readFileSync(new URL('../../lib/lifecycle/currentAction.ts',import.meta.url),'utf8');
const {outputText} = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
const {resolveCurrentAction,lifecycleGates} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const verified = Object.fromEntries(lifecycleGates.map(g=>[g.key,{state:'verified'}]));
const capability = {permitted:true,target:'/workspace/task',completionEvent:'task.committed'};

test('each handoff exposes one task to its owner; other roles wait',()=>{
  for (const [index,gate] of lifecycleGates.entries()) {
    const evidence=Object.fromEntries(lifecycleGates.map((g,i)=>[g.key,{state:i<index?'verified':'missing'}]));
    for (const actor of ['operator','client','partner']) {
      const result=resolveCurrentAction({actor,phase:gate.phase,evidence,capabilities:{[gate.key]:capability}});
      assert.equal(result.key,gate.key);
      assert.equal(result.canExecute,actor===gate.owner);
      assert.equal(result.target,actor===gate.owner?capability.target:null);
      assert.equal(result.state,actor===gate.owner?'actionable':'waiting');
    }
  }
});
test('each missing prerequisite defeats a later stored stage and later approvals',()=>{
  for (const gate of lifecycleGates) {
    const result=resolveCurrentAction({actor:gate.owner,phase:'closure',evidence:{...verified,[gate.key]:{state:'missing'}},capabilities:{}});
    assert.equal(result.key,gate.key);
    assert.equal(result.canExecute,false);
  }
});
test('unknown evidence, unavailable task, bad redirect and stale phase fail closed',()=>{
  for(const target of ['https://example.com','//example.com','/\\example.com','/task?token=secret','/task\n','/task#approve']){
    const result=resolveCurrentAction({actor:'operator',phase:'opportunity',evidence:{opportunity_qualified:{state:'missing'}},capabilities:{opportunity_qualified:{...capability,target}}});
    assert.equal(result.canExecute,false,target);
  }
  assert.equal(resolveCurrentAction({actor:'operator',phase:'unknown',evidence:verified,capabilities:{}}).state,'unknown');
  assert.equal(resolveCurrentAction({actor:'operator',phase:'closure',evidence:{},capabilities:{}}).state,'unknown');
  const ahead={...verified,closure_approved:{state:'missing'}};
  assert.equal(resolveCurrentAction({actor:'operator',phase:'execution',evidence:ahead,capabilities:{closure_approved:capability}}).canExecute,false);
});
test('pending payment never offers repeat checkout; owner release and payout remain separate',()=>{
  for(const key of ['opening_payment_verified','final_payment_verified']){
    const result=resolveCurrentAction({actor:'client',phase:'closure',evidence:{...verified,[key]:{state:'pending'}},capabilities:{[key]:capability}});
    assert.equal(result.state,'waiting');assert.equal(result.canExecute,false);
  }
  for(const key of ['owner_release_approved','partner_payment_verified']){
    const result=resolveCurrentAction({actor:'operator',phase:'closure',evidence:{...verified,[key]:{state:'missing'}},capabilities:{}});
    assert.equal(result.key,key);assert.equal(result.canExecute,false);
  }
});
test('no advance needs explicit approved contractual basis',()=>{
  const evidence={...verified,opening_invoice_issued:{state:'missing'},opening_payment_verified:{state:'missing'}};
  assert.equal(resolveCurrentAction({actor:'operator',phase:'closure',evidence,capabilities:{}}).key,'opening_invoice_issued');
  assert.equal(resolveCurrentAction({actor:'operator',phase:'closure',evidence,capabilities:{},openingBasis:'approved_no_advance'}).state,'done');
});
test('failed retry requires capability; closed has no repeated CTA',()=>{
  const evidence={...verified,closure_approved:{state:'failed'}};
  assert.equal(resolveCurrentAction({actor:'operator',phase:'closure',evidence,capabilities:{}}).canExecute,false);
  assert.equal(resolveCurrentAction({actor:'operator',phase:'closure',evidence,capabilities:{closure_approved:capability}}).state,'failed');
  const closed=resolveCurrentAction({actor:'operator',phase:'closure',evidence:verified,capabilities:{closure_approved:capability}});
  assert.equal(closed.state,'done');assert.equal(closed.target,null);assert.equal(closed.canExecute,false);
});

test('unverified confidentiality blocks release even when all later evidence is present',()=>{
 const evidence={...verified,confidentiality_confirmed:{
  state:'unknown',reason:'Confidentiality approval evidence missing.'
 }};
 for(const actor of ['operator','client','partner']){
  const result=resolveCurrentAction({actor,phase:'closure',evidence,
   capabilities:{confidentiality_confirmed:capability}});
  assert.equal(result.key,'confidentiality_confirmed');
  assert.equal(result.state,'unknown');
  assert.equal(result.canExecute,false);
  assert.equal(result.target,null);
  assert.match(result.reason,/Confidentiality approval evidence missing/);
 }
});
test('no task capability is derived from a verified stage or missing record alone',()=>{
 const evidence={...verified,owner_release_approved:{state:'missing',reason:'Owner approval not recorded.'}};
 const result=resolveCurrentAction({actor:'operator',phase:'payment_settlement',evidence,capabilities:{}});
 assert.equal(result.key,'owner_release_approved');
 assert.equal(result.state,'blocked');
 assert.equal(result.canExecute,false);
 assert.equal(result.reason,'Owner approval not recorded.');
});
