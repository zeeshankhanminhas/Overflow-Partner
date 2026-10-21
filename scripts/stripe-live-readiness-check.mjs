import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const require=createRequire(import.meta.url);
const Module=require('node:module');
const ts=require('typescript');
const root=process.cwd();
const previousLoad=Module._load;
const previousTs=Module._extensions['.ts'];
Module._load=function(name,parent,isMain){
  if(name.startsWith('@/'))return previousLoad.call(this,resolve(root,name.slice(2)),parent,isMain);
  return previousLoad.call(this,name,parent,isMain);
};
Module._extensions['.ts']=function(mod,file){
  const output=ts.transpileModule(readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
  });
  mod._compile(output.outputText,file);
};
const {stripeRuntimeMode,checkoutOrigin}=require(resolve(root,'lib/payments/stripeEnvironment.ts'));
const production='klricctsxiifuduxpmzd';
const prodEnv={
 VERCEL_ENV:'production',
 NEXT_PUBLIC_SUPABASE_URL:`https://${production}.supabase.co`,
 OP_PACKAGE01_PAYMENTS_ENABLED:'true',
 OP_PACKAGE01_AUTO_RELEASE_ENABLED:'true',
 OP_CONTRACTUAL_RELEASE_ENABLED:'true',
 OP_STRIPE_LIVE_ENABLED:'true',
 OP_VOICE_FINAL_RELEASE_ENABLED:'true',
 STRIPE_SECRET_KEY:'sk_live_FAKE_CI_NEVER_USE',
 STRIPE_WEBHOOK_SECRET:'whsec_FAKE_CI_NEVER_USE',
 OP_STRIPE_LIVE_RETURN_ORIGIN:'https://overflow-partner.vercel.app',
 NEXT_PUBLIC_SITE_URL:'https://overflow-partner.vercel.app',
};
const original={...process.env};
let tests=0;
function use(next){for(const k of Object.keys(prodEnv))delete process.env[k];
  Object.assign(process.env,next);}
const check=(condition,description)=>{assert.ok(condition,description);tests++;console.log('PASS '+description);};
try{
 use(prodEnv);
 check(stripeRuntimeMode()==='live','Live mode requires every validated production gate');
 check(checkoutOrigin('live')==='https://overflow-partner.vercel.app','Live Checkout returns to approved HTTPS origin');
 for(const [key,value] of Object.entries({
  VERCEL_ENV:'preview',OP_PACKAGE01_PAYMENTS_ENABLED:'false',
  OP_PACKAGE01_AUTO_RELEASE_ENABLED:'false',OP_CONTRACTUAL_RELEASE_ENABLED:'false',
  OP_STRIPE_LIVE_ENABLED:'false',OP_VOICE_FINAL_RELEASE_ENABLED:'false',
  STRIPE_SECRET_KEY:'sk_test_FAKE_CI_NEVER_USE',
  STRIPE_WEBHOOK_SECRET:'',NEXT_PUBLIC_SUPABASE_URL:'https://another-project.supabase.co'
 })){
  use({...prodEnv,[key]:value});
  check(stripeRuntimeMode()===null,`Live payment disabled on unsafe ${key}`);
 }
 for(const [key,value] of Object.entries({
  OP_STRIPE_LIVE_RETURN_ORIGIN:'https://unapproved.example.invalid',
  NEXT_PUBLIC_SITE_URL:'http://overflow-partner.vercel.app'
 })){
  use({...prodEnv,[key]:value});
  assert.throws(()=>checkoutOrigin('live'));
  check(true,`Disagreeing payment return origin rejected (${key})`);
 }
 use({...prodEnv,NEXT_PUBLIC_SITE_URL:'https://malicious.example.invalid',
    OP_STRIPE_LIVE_RETURN_ORIGIN:'https://malicious.example.invalid/path'});
 assert.throws(()=>checkoutOrigin('live'));
 check(true,'Payment redirects cannot include arbitrary paths');
 use({...prodEnv,VERCEL_ENV:'preview',STRIPE_SECRET_KEY:'sk_live_FAKE_CI_NEVER_USE'});
 check(stripeRuntimeMode()===null,'Preview cannot activate live Stripe even with live key');
 console.log('Stripe live-mode readiness: '+tests+' fail-closed offline assertions passed.');
}finally{
 for(const k of Object.keys(prodEnv))delete process.env[k];
 Object.assign(process.env,original);
 Module._load=previousLoad;
 Module._extensions['.ts']=previousTs;
}
