// Zero-network work-order regression against the real TypeScript handoff module.
// This tests the agreed NO work before approved scope + verified opening deposit.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const require=createRequire(import.meta.url);
const Module=require('node:module');
const ts=require('typescript');
const originalLoad=Module._load;
const originalTs=Module._extensions['.ts'];
const emails=[];
let checks=0;
const check=(predicate,description)=>{
  assert.ok(predicate,description);
  checks++;
  console.log('PASS '+description);
};
const ids={
  org:'10000000-0000-4000-8000-000000000001',
  actor:'10000000-0000-4000-8000-000000000002',
  project:'10000000-0000-4000-8000-000000000003',
  quote:'10000000-0000-4000-8000-000000000004',
  commercial:'10000000-0000-4000-8000-000000000005',
  partnerQuote:'10000000-0000-4000-8000-000000000006',
  partner:'10000000-0000-4000-8000-000000000007',
  sow:'10000000-0000-4000-8000-000000000008',
  assignment:'10000000-0000-4000-8000-000000000009',
  session:'10000000-0000-4000-8000-000000000010',
};
const tables={
  projects:[{id:ids.project,organisation_id:ids.org,quote_id:ids.quote,project_number:'OP-QA-WO-1',
    project_stage:'mobilisation',start_date:'2026-10-24',due_date:'2026-11-07'}],
  quotes:[{id:ids.quote,organisation_id:ids.org,commercial_review_id:ids.commercial}],
  commercial_reviews:[{id:ids.commercial,organisation_id:ids.org,partner_quote_id:ids.partnerQuote}],
  partner_quotes:[{id:ids.partnerQuote,organisation_id:ids.org,partner_id:ids.partner}],
  partners:[{id:ids.partner,organisation_id:ids.org,company_name:'OP QA Technical Partner',
    contact_name:'QA Engineer',email:'partner@example.invalid',status:'approved',nda_signed:true}],
  documents:[{id:ids.sow,organisation_id:ids.org,project_id:ids.project,
    document_type:'statement-of-work',status:'draft',is_current_revision:true}],
  project_execution_assignments:[],
  partner_execution_sessions:[],
};
let gate={authorised:true,basis:'deposit',required:300,received:300};
const uuidFor=(table)=>table==='partner_execution_sessions'?ids.session:ids.assignment;
class Builder {
  constructor(table,op='read',value=null){
    this.table=table;this.op=op;this.value=value;this.conditions=[];this.sorted=false;this.first=Infinity;
  }
  select(){return this;}
  eq(k,v){this.conditions.push(r=>r[k]===v);return this;}
  in(k,list){this.conditions.push(r=>list.includes(r[k]));return this;}
  lt(k,v){this.conditions.push(r=>String(r[k])<String(v));return this;}
  gt(k,v){this.conditions.push(r=>String(r[k])>String(v));return this;}
  order(k,{ascending=false}={}){this.sortKey=k;this.ascending=ascending;return this;}
  limit(n){this.first=n;return this;}
  match(){let found=tables[this.table].filter(r=>this.conditions.every(c=>c(r)));
    if(this.sortKey)found.sort((a,b)=>((String(a[this.sortKey]).localeCompare(String(b[this.sortKey])))*(this.ascending?1:-1)));
    return found.slice(0,this.first);
  }
  perform(){
    if(this.op==='read')return this.match();
    if(this.op==='insert'){
      const input=Array.isArray(this.value)?this.value:[this.value];
      const added=input.map((row,i)=>({...row,id:row.id||uuidFor(this.table),created_at:new Date().toISOString(),
        execution_cycle:row.execution_cycle||1}));
      tables[this.table].push(...added);
      return added;
    }
    if(this.op==='update'){
      const found=this.match();
      for(const row of found)Object.assign(row,this.value);
      return found;
    }
    throw Error('Unrecognised fake database write');
  }
  single(){const rows=this.perform();return Promise.resolve(rows[0]?{data:rows[0],error:null}:{data:null,error:{message:'no matching QA row'}});}
  maybeSingle(){return Promise.resolve({data:this.perform()[0]||null,error:null});}
  then(resolve,reject){return Promise.resolve({data:this.perform(),error:null}).then(resolve,reject);}
}
const db={
  from(table){if(!Object.hasOwn(tables,table))throw new Error('Undeclared QA table '+table);
    return {select:()=>new Builder(table),insert:value=>new Builder(table,'insert',value),
      update:value=>new Builder(table,'update',value)};},
  rpc:async(name)=>{
    assert.equal(name,'op_project_financial_gate','Only governed finance gate may authorise work');
    return {data:gate,error:null};
  }
};
Module._load=function(request,parent,isMain){
  if(request==='@/lib/notifications/scenarios'){
    return {queueLifecycleEmail:async(_db,input)=>{emails.push(input);return 'fake-outbox-001';}};
  }
  if(request.startsWith('@/'))return originalLoad.call(this,resolve(root,request.slice(2)),parent,isMain);
  return originalLoad.call(this,request,parent,isMain);
};
Module._extensions['.ts']=function(mod,filename){
  const compiled=ts.transpileModule(readFileSync(filename,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
    fileName:filename
  });
  mod._compile(compiled.outputText,filename);
};
process.env.EXECUTION_LINK_SIGNING_KEY='qa-only-no-production-signing-key';
process.env.VERCEL_ENV='local-qa';
process.env.NEXT_PUBLIC_SITE_URL='https://qa.example.invalid';
try {
  const {ensureApprovedPartnerAssignment,releaseApprovedPartnerWorkOrder}=
    require(resolve(root,'lib/execution/autoWorkOrder.ts'));
  async function blocked(action,substring,description){
    await assert.rejects(action(),error=>error instanceof Error && error.message.includes(substring),description);
    check(true,description);
  }
  await blocked(()=>ensureApprovedPartnerAssignment(db,ids.org,ids.actor,ids.project,ids.sow),
    'approved Statement of Work','Unapproved SOW cannot create assignment');
  check(tables.project_execution_assignments.length===0,'No assignment before SOW approval');
  tables.documents[0].status='approved';
  const assigned=await ensureApprovedPartnerAssignment(db,ids.org,ids.actor,ids.project,ids.sow);
  check(assigned.partner_id===ids.partner,'Approved scope inherits commercially selected partner');
  check(assigned.scope_document_id===ids.sow,'Assignment inherits the exact approved SOW');
  await ensureApprovedPartnerAssignment(db,ids.org,ids.actor,ids.project,ids.sow);
  check(tables.project_execution_assignments.length===1,'Assignment is idempotent');
  await blocked(()=>releaseApprovedPartnerWorkOrder(db,ids.org,ids.actor,ids.project),
    'Mobilisation must complete','No work order before governed mobilisation');
  tables.projects[0].project_stage='ready_for_execution';
  for(const basis of ['po','credit','manual','none']){
    gate={authorised:true,basis,required:300,received:300};
    await blocked(()=>releaseApprovedPartnerWorkOrder(db,ids.org,ids.actor,ids.project),
      'cleared opening deposit','Legacy '+basis+' financial override cannot release work');
  }
  gate={authorised:true,basis:'deposit',required:300,received:299};
  await blocked(()=>releaseApprovedPartnerWorkOrder(db,ids.org,ids.actor,ids.project),
    'cleared opening deposit','Underpaid £299 deposit cannot release work');
  gate={authorised:true,basis:'deposit',required:300,received:300};
  tables.documents[0].is_current_revision=false;
  await blocked(()=>releaseApprovedPartnerWorkOrder(db,ids.org,ids.actor,ids.project),
    'Current controlled SOW','Outdated SOW cannot release work');
  tables.documents[0].is_current_revision=true;
  tables.partners[0].nda_signed=false;
  await blocked(()=>releaseApprovedPartnerWorkOrder(db,ids.org,ids.actor,ids.project),
    'NDA-signed','No NDA means no partner work order');
  tables.partners[0].nda_signed=true;
  const released=await releaseApprovedPartnerWorkOrder(db,ids.org,ids.actor,ids.project);
  check(released.assignmentId===ids.assignment,'Correct commercial assignment is released');
  check(tables.partner_execution_sessions.length===1,'One secure execution session created');
  check(emails.length===1,'Exactly one queued fake partner work-order notification');
  check(emails[0].recipientEmail==='partner@example.invalid','Only governed partner receives invitation');
  check(emails[0].scenario==='partner_work.released','Partner work-order email scenario selected');
  check(emails[0].actionUrl.includes('/execution/v2.'),'Partner receives secure execution link');
  check(!JSON.stringify(emails[0]).includes('real-client@example.invalid') &&
    !JSON.stringify(emails[0]).includes('£1000'),'No client identity or sale price disclosed');
  const repeated=await releaseApprovedPartnerWorkOrder(db,ids.org,ids.actor,ids.project);
  check(repeated.sessionId===released.sessionId,'Retry reuses same execution token session');
  check(tables.partner_execution_sessions.length===1,'Retry creates no second execution portal');
  check(emails[1].idempotencyKey===emails[0].idempotencyKey,'Retry uses stable outbox idempotency key');
  console.log('OPOS partner-workorder QA passed: '+checks+' checks, fake email only, no network.');
}finally {
  Module._load=originalLoad;
  Module._extensions['.ts']=originalTs;
}
