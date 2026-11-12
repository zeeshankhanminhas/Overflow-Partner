import assert from 'node:assert/strict';
import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {createHelixAcquisitionThroughWorkspace} from '../../scripts/qa/helix-acquisition-browser.mjs';
import {finishJourney} from './finish.mjs';

for(const tenant of ['00000000-0000-4000-8000-000000009932','00000000-0000-4000-8000-000000009942'])test('synthetic customer '+tenant.slice(-4)+' through nine governed project stages',async({browser},info)=>{
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const orgId=tenant;
 // Only tenant, release policy and identities are bootstrap configuration.
 // No leads, quotes, documents, projects, reviews or payments are seeded.
 const {error:orgError}=await db.from('organisations').insert({id:orgId,name:'OP QA TEST disposable browser tenant'});assert.equal(orgError,null);
 const {error:policyError}=await db.from('op_client_review_release_policy').insert({organisation_id:orgId,require_attested_portal:true});assert.equal(policyError,null);
 const email='write-browser-owner-'+orgId.slice(-4)+'@example.invalid',password='Disposable-only-'+crypto.randomUUID()+'!';
 const {data:identity,error:userError}=await db.auth.admin.createUser({email,password,email_confirm:true});assert.equal(userError,null);
 const {error:profileError}=await db.from('profiles').upsert({id:identity.user.id,organisation_id:orgId,role:'owner',full_name:'Disposable browser owner',is_active:true});assert.equal(profileError,null);
 const operatorDb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 const {error:loginError}=await operatorDb.auth.signInWithPassword({email,password});assert.equal(loginError,null);
 const context=await browser.newContext({baseURL:'http://127.0.0.1:3211',serviceWorkers:'block'});
 const control=await context.newPage();control.setDefaultTimeout(30000);
 try{
  await test.step('Acquisition, requirements, feasibility and commercial commitment → mobilisation → ready → execution → internal QA → ready for client',async()=>{
   await control.goto('/login');await control.getByLabel('Email',{exact:true}).fill(email);await control.getByLabel('Password',{exact:true}).fill(password);
   await Promise.all([control.waitForURL(u=>u.pathname==='/workspace'),control.getByRole('button',{name:'Enter Workspace'}).click()]);
   const initialStages=['mobilisation','ready_for_execution','in_progress','internal_review','ready_for_client_issue'];
   let gate=0;
   await createHelixAcquisitionThroughWorkspace(control,db,orgId,operatorDb,async(stage,projectId)=>{
    assert.equal(stage,initialStages[gate++]);
    await test.step('Gate '+gate+': '+stage,async()=>{
     const {data,error}=await db.from('projects').select('project_stage').eq('id',projectId).eq('organisation_id',orgId).single();assert.equal(error,null);assert.equal(data.project_stage,stage);
    });
   });
   assert.equal(gate,5);
  });
  const {data:projects,error}=await db.from('projects').select('id,quote_id,project_stage').eq('organisation_id',orgId);assert.equal(error,null);assert.equal(projects.length,1);
  await finishJourney({control,db,operatorDb,orgId,project:projects[0],step:test.step,expect});
 }catch(error){
  // Synthetic-only diagnostics: no HTML, signed URLs, cookies or credentials.
  const {data:projects}=await db.from('projects').select('id,project_stage').eq('organisation_id',orgId);
  const diagnostics=[];for(const p of projects||[]){const r=await operatorDb.rpc('op_project_stage_readiness',{p_project_id:p.id});diagnostics.push({stage:p.project_stage,readiness:r.data,error:r.error?.message});}
  await info.attach('gate-blocker.json',{body:JSON.stringify({path:new URL(control.url()).pathname,diagnostics,error:error.message},null,2),contentType:'application/json'});
  throw error;
 }finally{
  const {data:projects}=await db.from('projects').select('id,project_stage').eq('organisation_id',orgId);
  const ledger=[];
  for(const project of projects||[]){
   const {data:events,error}=await db.from('activity_events').select('event_type,new_value,created_at').eq('organisation_id',orgId).eq('entity_id',project.id).order('created_at');
   ledger.push({projectId:project.id,currentStage:project.project_stage,events,error:error?.message});
  }
  await info.attach('stage-ledger.json',{body:JSON.stringify(ledger,null,2),contentType:'application/json'});
  await context.close();
 }
});
