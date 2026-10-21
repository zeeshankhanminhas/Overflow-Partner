import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../lib/payments/stripeSignature.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
vm.runInNewContext(compiled,{module,exports:module.exports,require,Buffer});
const {validStripeSignature}=module.exports;

const secret='whsec_QA_ONLY_NEVER_A_REAL_SECRET';
const now=Date.parse('2026-10-21T14:00:00.000Z');
const timestamp=Math.floor(now/1000);
const body=JSON.stringify({id:'evt_qa',type:'checkout.session.completed',livemode:false});
const sign=(raw,at=timestamp)=>createHmac('sha256',secret).update(at+'.'+raw).digest('hex');
const header=(raw=body,at=timestamp)=>'t='+at+',v1='+sign(raw,at);

assert.equal(validStripeSignature(body,header(),secret,now),true,'Signed Stripe test event accepted');
assert.equal(validStripeSignature(body+' ',header(),secret,now),false,'Tampered body rejected');
assert.equal(validStripeSignature(body,header(),'wrong-webhook-secret',now),false,'Wrong secret rejected');
assert.equal(validStripeSignature(body,'t='+timestamp+',v1='+('0'.repeat(64)),secret,now),false,'Forged signature rejected');
assert.equal(validStripeSignature(body,header(body,timestamp-301),secret,now),false,'Replay older than 5 minutes rejected');
assert.equal(validStripeSignature(body,header(body,timestamp+301),secret,now),false,'Future-dated event rejected');
assert.equal(validStripeSignature(body,header(body,timestamp-300),secret,now),true,'Signed event at tolerance boundary accepted');
assert.equal(validStripeSignature(body,'t=not-a-number,v1='+sign(body),secret,now),false,'Malformed timestamp rejected');
assert.equal(validStripeSignature(body,'t='+timestamp+',v0='+sign(body),secret,now),false,'Unsupported signature version rejected');
assert.equal(validStripeSignature(body,'',secret,now),false,'Missing header rejected');
assert.equal(validStripeSignature(body,header(),'',now),false,'Missing shared secret rejected');
assert.equal(validStripeSignature(body,'t='+timestamp+',v1='+('0'.repeat(64))+',v1='+sign(body),secret,now),true,'Rotated multiple valid signatures supported');

console.log('Stripe webhook signature: 12 cryptographic positive/negative checks passed (local, no network).');
