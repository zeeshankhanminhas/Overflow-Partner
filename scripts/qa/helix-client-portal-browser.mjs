// Actual Chromium against local Next + disposable PostgREST, never hosted QA.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {chromium} from '@playwright/test';

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
 await context.close();
} finally {
 await browser.close();
}
