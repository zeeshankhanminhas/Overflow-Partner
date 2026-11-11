// Actual Chromium against local Next + disposable PostgREST, never hosted QA.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';

assert.equal(process.env.CI,'true');
assert.equal(process.env.VERCEL_ENV,'local-qa');
assert.equal(process.env.OP_QA_SUPABASE_PROJECT_REF,'opos_ephemeral_ci');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,'http://127.0.0.1:54321');
assert.ok(process.env.QUOTE_RESPONSE_SECRET?.startsWith('qa_'));
function token(quoteId){
 const payload={purpose:'client_quote_portal',quoteId,revision:1,exp:Date.now()+600000};
 const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');
 return encoded+'.'+createHmac('sha256',process.env.QUOTE_RESPONSE_SECRET).update(encoded).digest('base64url');
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:3211',serviceWorkers:'block',
  viewport:{width:1280,height:900},acceptDownloads:false,recordVideo:undefined});
 const page=await context.newPage();
 page.setDefaultTimeout(20000);
 await page.goto('/client-portal?token='+encodeURIComponent(token('00000000-0000-4000-8000-000000009934')),{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'Your quotation and project'}).waitFor();
 assert.match(await page.locator('body').innerText(),/OP-QA-HTTP-2/);
 assert.match(await page.locator('body').innerText(),/Project reference:/);
 assert.equal(await page.getByRole('button',{name:'Submit project review'}).count(),0,
  'No deliverable acceptance before controlled client-review stage');
 assert.equal(await page.getByText(/Download approved final engineering files/).count(),0,
  'No native engineering file release before owner approval');
 console.log('PASS browser: Helix quote and Project 360 present, premature client approval and file access blocked.');
 await page.goto('/client-portal?token=tampered',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'Portal access unavailable'}).waitFor();
 console.log('PASS browser: unsigned/tampered Helix portal links rejected.');
 // Disposable Operator identity is provisioned through Supabase Auth API, never
 // by editing a project, review, payment or lifecycle table.
 const operatorId='00000000-0000-4000-8000-000000009931';
 const admin=createClient('http://127.0.0.1:54321',process.env.SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false}});
 const password='qa-only-Helix-operator-2026!'+Math.random().toString(36).slice(2);
 const {error:identityError}=await admin.auth.admin.updateUserById(operatorId,{
  password,email_confirm:true
 });
 assert.equal(identityError,null,'Disposable Helix operator must be configured through the Auth API');
 const {data:projects,error:projectsError}=await admin.from('projects')
  .select('id,project_stage').eq('organisation_id','00000000-0000-4000-8000-000000009932')
  .eq('quote_id','00000000-0000-4000-8000-000000009934');
 assert.equal(projectsError,null);
 assert.equal(projects?.length,1,'Exactly one Helix project from verified advance');
 assert.equal(projects[0].project_stage,'mobilisation','Opening payment does not skip mobilisation');
 const operator=await browser.newContext({baseURL:'http://127.0.0.1:3211',serviceWorkers:'block'});
 try{
  const control=await operator.newPage();
  control.setDefaultTimeout(25000);
  await control.goto('/login');
  await control.getByLabel('Email',{exact:true}).fill('helix-ci-qa@example.invalid');
  await control.getByLabel('Password',{exact:true}).fill(password);
  await Promise.all([
   control.waitForURL(u=>u.pathname==='/workspace',{timeout:25000}),
   control.getByRole('button',{name:'Enter Workspace'}).click()
  ]);
  await control.goto('/workspace/projects/'+projects[0].id);
  await control.locator('section[aria-label="Authoritative project next action"]').waitFor();
  const projectCopy=await control.locator('body').innerText();
  assert.match(projectCopy,/Mobilisation/i,'Helix opens in actual operator mobilisation workspace');
  assert.doesNotMatch(projectCopy,/Project closed.*Delivery is complete/s,
   'Helix cannot be shown as closed after just an opening payment');
  console.log('PASS browser: real Helix operator login and stage-scoped Project 360, no shortcut.');
 }finally{await operator.close();}
 await context.close();
} finally {
 await browser.close();
}
