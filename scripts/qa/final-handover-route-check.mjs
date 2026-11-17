// Behavior-level testing of the REAL final-files server component.
// Mock only the DB/storage boundary. No client data, secrets, remote DB or HTTP.
// Regressions here must not be mistaken for authenticated live E2E evidence.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('app/client-final-files/page.tsx','utf8');
const output=ts.transpileModule(source,{fileName:'page.tsx',compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true
}}).outputText;
const base={
 quote_issue_records:{organisation_id:'qa-org',client_response:'accepted'},
 quotes:{id:'qa-quote',revision:1,quote_number:'QA-1'},
 projects:{id:'qa-project',project_number:'QA-PROJECT-1'},
 project_client_reviews:{outcome:'accepted'},
 op_project_final_settlements:{project_id:'qa-project',verified_at:'2026-11-17T00:00:00Z'},
 op_project_final_release_approvals:{project_id:'qa-project',approved_at:'2026-11-17T00:00:00Z',submission_id:'qa-submission'},
 project_execution_assignments:{id:'qa-assignment',execution_cycle:1},
 partner_delivery_submissions:{id:'qa-submission'},
 partner_delivery_submission_files:[{id:'qa-file',original_filename:'final.stp',
  storage_bucket:'qa-private',storage_path:'approved/final.stp'}]
};

function readable(node){
 if(node===null||node===undefined)return '';
 if(Array.isArray(node))return node.map(readable).join(' ');
 if(typeof node!=='object')return String(node);
 if(node.props)return readable(node.props.children);
 return '';
}

async function exercise({changes={},validToken=true,enabled=true,preview=false,
 isolated=true,storageFails=false}={}){
 const fixtures={...structuredClone(base),...changes};
 const signed=[];
 const db={
  from(table){
   if(!(table in fixtures))throw Error('Unexpected database table: '+table);
   const chain={
    select(){return chain},eq(){return chain},order(){return chain},
    limit(){return chain},
    async maybeSingle(){return {data:fixtures[table],error:null}},
    then(onSuccess,onFailure){
      return Promise.resolve({data:fixtures[table],error:null}).then(onSuccess,onFailure);
    }
   };
   return chain;
  },
  storage:{from(bucket){return {async createSignedUrl(path,seconds){
   signed.push({bucket,path,seconds});
   return storageFails?{data:null,error:{message:'Synthetic storage failure'}}:
     {data:{signedUrl:'https://qa.invalid/signed-file'},error:null};
  }};}}
 };
 const jsx=(type,props)=>({type,props:props||{}});
 const cjsModule={exports:{}};
 const requireMock=id=>{
  if(id==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
  if(id==='@/lib/qa/isolation')return {isKnownIsolatedQaBackend:()=>isolated};
  if(id==='@supabase/supabase-js')return {createClient:()=>db};
  if(id==='@/lib/quotes/clientPortalToken')return {
   verifyClientPortalToken:()=>validToken?{quoteId:'qa-quote',revision:1}:null
  };
  throw Error('Unexpected server import '+id);
 };
 const env={OP_VOICE_FINAL_RELEASE_ENABLED:enabled?'true':'false',
  VERCEL_ENV:preview?'preview':'local-qa',
  NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY:'disposable-placeholder'};
 vm.runInNewContext(output,{module:cjsModule,exports:cjsModule.exports,require:requireMock,
  process:{env},console}, {filename:'app/client-final-files/page.tsx',timeout:1000});
 const page=await cjsModule.exports.default({searchParams:Promise.resolve({token:'synthetic'})});
 return {display:readable(page),signed};
}

const denied=(name,opts,reason,expectedSignerCalls=0)=>test(name,async()=>{
 const result=await exercise(opts);
 assert.match(result.display,/Final files not available/);
 assert.match(result.display,reason);
 assert.equal(result.signed.length,expectedSignerCalls,'Unexpected storage signing attempts for this denial');
 assert.doesNotMatch(result.display,/https:\/\/qa\.invalid\/signed-file/,'Denied result must contain no signed-file URL');
});

test('Accepted review + final cleared payment + owner-approved current submission produces 5-minute file URL',async()=>{
 const result=await exercise();
 assert.match(result.display,/Final engineering package/);
 assert.match(result.display,/Final settlement verified/);
 assert.equal(result.signed.length,1);
 assert.equal(result.signed[0].seconds,300);
});
denied('Latest client correction request cancels download even after older acceptance',
 {changes:{project_client_reviews:{outcome:'changes_requested'}}},
 /latest client engineering review must be accepted/);
denied('Latest client rejection cancels download',
 {changes:{project_client_reviews:{outcome:'rejected'}}},
 /latest client engineering review must be accepted/);
denied('Missing recorded client acceptance cancels download',
 {changes:{project_client_reviews:null}},
 /latest client engineering review must be accepted/);
denied('No verified final settlement cancels download',
 {changes:{op_project_final_settlements:null}},
 /Final cleared payment/);
denied('No distinct OPOS owner approval cancels download',
 {changes:{op_project_final_release_approvals:null}},
 /owner release approval/);
denied('Owner approval of an older submission cannot release revised engineering files',
 {changes:{op_project_final_release_approvals:{project_id:'qa-project',approved_at:'2026-11-17T00:00:00Z',submission_id:'old-submission'}}},
 /current engineering revision differs/);
denied('Missing approved partner submission cancels download',
 {changes:{partner_delivery_submissions:null}},
 /current engineering revision differs/);
denied('Missing controlled file package cancels download',
 {changes:{partner_delivery_submission_files:[]}},
 /approved final package is temporarily unavailable/);
denied('A failed storage signature does not expose a signed link',
 {storageFails:true},
 /secure file link could not be created/,1);
denied('Withdrawn quotation acceptance cancels download',
 {changes:{quote_issue_records:{organisation_id:'qa-org',client_response:'declined'}}},
 /quotation acceptance is missing/);
denied('Expired or invalid private token cancels download',
 {validToken:false},
 /private client portal link has expired/);
denied('Feature disabled blocks every final-file link',
 {enabled:false},
 /controlled final handover service has not been enabled/);
denied('Unisolated preview cannot access final-file service',
 {preview:true,isolated:false},
 /Preview is not configured with an isolated QA database/);
