import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';

// Run the actual presentation source, replacing only the unrelated canonical
// project-stage dependency. This test never requires live credentials or data.
const source=readFileSync(new URL('../../lib/presentation/threePortalNextAction.ts',import.meta.url),'utf8')
 .replace("import {canonicalProjectDecision} from './canonicalProjectDecision';",
  "const canonicalProjectDecision=()=>({key:'unknown'});");
const {outputText}=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,
}});
const {secureClientNextStep}=await import('data:text/javascript;base64,'+
 Buffer.from(outputText).toString('base64'));

const base={
 projectStage:'completion',canDecide:false,accepted:true,canPay:false,
 paymentVerificationPending:false,finalReviewAccepted:true,
 finalSettlementVerified:false,finalReleaseApproved:false,
 finalFilesHref:'/client-final-files',finalBalanceHref:'/project-final-payment',
};

test('pending final receipt never invites duplicate checkout',()=>{
 const step=secureClientNextStep({...base,paymentVerificationPending:true});
 assert.equal(step.href,null);assert.equal(step.waiting,true);
 assert.match(step.title,/being verified/i);
});

test('unverified settlement or client acceptance cannot advertise final handover',()=>{
 for(const changes of [
  {finalReleaseApproved:true},
  {finalReleaseApproved:true,finalSettlementVerified:true,finalReviewAccepted:false},
 ]){
  const step=secureClientNextStep({...base,...changes});
  assert.equal(step.href,null);assert.equal(step.waiting,true);
 }
});

test('verified funds without owner release are waiting, not downloadable',()=>{
 const step=secureClientNextStep({...base,finalSettlementVerified:true});
 assert.equal(step.href,null);assert.equal(step.waiting,true);
 assert.match(step.title,/owner approval/i);
});

test('controlled handover link appears only with review, funds and owner release',()=>{
 const step=secureClientNextStep({...base,finalSettlementVerified:true,finalReleaseApproved:true});
 assert.equal(step.href,base.finalFilesHref);
 assert.equal(step.waiting,false);
});

test('unpaid and not pending final review offers only the settlement task',()=>{
 const step=secureClientNextStep(base);
 assert.equal(step.href,base.finalBalanceHref);
 assert.equal(step.waiting,false);
});
