/**
 * Read-only three-role QA browser acceptance.
 * Requires owner-authorised synthetic accounts, branch preview and a real
 * Playwright Chromium runtime. Never sends payment, changes records or uploads.
 */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const origin=String(process.env.OPOS_QA_BROWSER_ORIGIN||'').replace(/\/+$/,'');
const url=new URL(origin);
if(url.protocol!=='https:' ||
   !url.hostname.endsWith('.vercel.app') ||
   !url.hostname.includes('overflow-partner') ||
   !process.env.OPOS_QA_BROWSER_ORIGIN)
 throw Error('Browser tests require an explicit Overflow Partner Vercel QA preview URL, never production.');
const identities=[
 {key:'controller',destination:'/opos-next',email:'OPOS_QA_CONTROLLER_EMAIL',password:'OPOS_QA_CONTROLLER_PASSWORD',heading:'Mission Control'},
 {key:'client',destination:'/portal/client',email:'OPOS_QA_CLIENT_EMAIL',password:'OPOS_QA_CLIENT_PASSWORD',heading:'Your engineering projects'},
 {key:'partner',destination:'/portal/partner',email:'OPOS_QA_PARTNER_EMAIL',password:'OPOS_QA_PARTNER_PASSWORD',heading:'Your engineering work'},
];
for(const identity of identities){
 if(!process.env[identity.email]||!process.env[identity.password])
  throw Error('Synthetic QA account missing for '+identity.key+'; no browser pass is claimed.');
}
await mkdir('artifacts/three-role-browser',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const identity of identities){
  for(const width of [390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1});
   const page=await context.newPage();
   const failures=[];
   page.on('pageerror',error=>failures.push(error.message));
   await page.goto(origin+'/login?next='+encodeURIComponent(identity.destination),{waitUntil:'domcontentloaded'});
   await page.getByRole('textbox',{name:'Email'}).fill(process.env[identity.email]);
   await page.getByLabel('Password').fill(process.env[identity.password]);
   await Promise.all([
    page.waitForURL(address=>address.pathname===identity.destination,{timeout:30000}),
    page.getByRole('button',{name:'Enter Workspace'}).click(),
   ]);
   await page.getByRole('heading',{name:identity.heading,exact:true}).first().waitFor({timeout:25000});
   const main=page.locator('main');
   assert.ok(await main.count(),'Missing main landmark for '+identity.key);
   const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+3);
   assert.equal(horizontalOverflow,false,'Horizontal overflow '+identity.key+' '+width);
   assert.deepEqual(failures,[],'Uncaught browser errors '+identity.key+' '+width);
   if(identity.key==='controller'){
    await page.getByRole('navigation',{name:'Primary workspace navigation'}).first().waitFor({timeout:10000}).catch(async()=>{
     await page.getByRole('button',{name:'Open workspace navigation'}).click();
     await page.getByRole('navigation',{name:'Mobile workspace navigation'}).waitFor();
    });
    await page.getByRole('region',{name:'Controller workspace overview'}).waitFor();
   }else{
    await page.getByRole('region',{name:'Workspace overview'}).waitFor();
    await page.getByRole('region',{name:'Your one next action'}).waitFor();
    const body=await main.innerText();
    if(identity.key==='client'){
     assert.doesNotMatch(body,/internal gross margin|partner bank details/i);
    }else{
     assert.doesNotMatch(body,/gross margin|client selling price|client bank details/i);
    }
   }
   await page.screenshot({path:'artifacts/three-role-browser/'+identity.key+'-'+width+'.png',fullPage:true});
   // Exercise a real authenticated record surface, without submitting a task.
   if(identity.key==='controller'){
    await page.goto(origin+'/opos-next/projects',{waitUntil:'domcontentloaded'});
    assert.ok(await page.locator('main').count(),'Controller projects register missing');
   }else{
    const record=page.locator('a[href^="/portal/'+identity.key+'/projects/"]').first();
    if(!await record.count())throw Error('No synthetic '+identity.key+' project/assignment fixture; E2E cannot pass.');
    await record.click();
    await page.waitForURL(address=>address.pathname.startsWith('/portal/'+identity.key+'/projects/'));
    await page.getByRole('heading',{level:1}).first().waitFor();
    assert.ok(await page.getByRole('main').count(),'Scoped project page missing');
    await page.screenshot({path:'artifacts/three-role-browser/'+identity.key+'-record-'+width+'.png',fullPage:true});
    // An authenticated account of one external role must not obtain the
    // other portal's private project dashboard by changing the URL.
    await page.goto(origin+'/portal/'+(identity.key==='client'?'partner':'client'),{waitUntil:'domcontentloaded'});
    assert.ok(new URL(page.url()).pathname.startsWith('/login') ||
      await page.getByText(/does not have access to a|different workspace/i).count()>0,
      'Cross-role portal exposure: '+identity.key);
   }
   console.log('PASS',identity.key,width,page.url());
   await context.close();
  }
 }
}finally{await browser.close();}
