// Anonymous, read-only Playwright visual acceptance preflight for OPOS dark preview.
// No QA credentials, no real tokens, no writes, no authenticated screenshots.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';

const base=process.env.OPOS_MARKETING_BASE_URL||'http://127.0.0.1:3100';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw new Error('Visual preflight must target isolated local HTTP only.');
const evidence=process.env.OPOS_VISUAL_EVIDENCE_DIR||'';
const cases=[
 {name:'login',path:'/login',heading:/Sign In/i},
 {name:'login-error',path:'/login?error=QA%20synthetic%20validation%20error',heading:/Sign In/i,alert:/QA synthetic validation error/},
 {name:'client-portal-invalid',path:'/client-portal',heading:/Portal access unavailable/i},
 {name:'quote-response-invalid',path:'/quote-response',heading:/Quotation response unavailable/i},
 {name:'quote-response-expired',path:'/quote-response?result=invalid',heading:/Response link expired/i},
 {name:'quote-response-error',path:'/quote-response?result=unavailable',heading:/Response could not be recorded/i},
 {name:'opening-payment-denied',path:'/quote-payment',heading:/Payment (page not yet available|link unavailable)/i},
 {name:'final-payment-denied',path:'/project-final-payment',heading:/Secure link unavailable/i},
 {name:'final-files-denied',path:'/client-final-files',heading:/Final files not available/i},
 {name:'technical-intake-invalid',path:'/intake/qa-invalid-visual-token',heading:/Technical intake unavailable/i},
 {name:'partner-review-invalid',path:'/partner-review/qa-invalid-visual-token',heading:/Partner review unavailable/i},
];
function rgb(raw){
 const match=raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
 return match?{r:+match[1],g:+match[2],b:+match[3],a:match[4]===undefined?1:+match[4]}:null;
}
function luminance({r,g,b}){
 const part=v=>{const s=v/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;};
 return 0.2126*part(r)+0.7152*part(g)+0.0722*part(b);
}
const browser=await chromium.launch({headless:true});
let checks=0;
try{
 if(evidence)await mkdir(evidence,{recursive:true});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390,colorScheme:'light',serviceWorkers:'block'});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  // Deliberately invalid synthetic tokens: never read or write real QA records.
  await page.route('**/api/intake/qa-invalid-visual-token',route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({message:'QA synthetic intake unavailable'})}));
  await page.route('**/api/partner-review/qa-invalid-visual-token',route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({message:'QA synthetic partner review unavailable'})}));
  for(const item of cases){
   pageErrors.length=0;
   const response=await page.goto(new URL(item.path,base).toString(),{waitUntil:'domcontentloaded',timeout:20000});
   assert.equal(response?.status(),200,item.name+' must render successfully at '+width+'px');
   const heading=page.getByRole('heading',{level:1,name:item.heading}).first();
   await heading.waitFor({state:'visible',timeout:12000});
   if(item.alert)await page.getByRole('alert').getByText(item.alert).waitFor({state:'visible'});
   if(item.name==='login'){
     // OPOS orange CTA must have AA-readable label in both rest and hover states.
     const action=page.getByRole('button',{name:/Enter Secure Workspace/i});
     const contrastOf=async()=>{
       const pair=await action.evaluate(el=>{const s=getComputedStyle(el);return [s.color,s.backgroundColor];});
       const fg=rgb(pair[0]),bg=rgb(pair[1]);
       return fg&&bg?(Math.max(luminance(fg),luminance(bg))+0.05)/(Math.min(luminance(fg),luminance(bg))+0.05):0;
     };
     assert.ok((await contrastOf())>=4.5,'Login orange CTA resting text contrast below 4.5:1');
     await action.hover();
     await page.waitForTimeout(220);
     assert.ok((await contrastOf())>=4.5,'Login orange CTA hover text contrast below 4.5:1');
   }

   const result=await page.evaluate(()=>{
    const main=document.querySelector('main');
    if(!main)return {missingMain:true};
    const nearestOpaque=(element)=>{
     for(let el=element;el;el=el.parentElement){
      const color=getComputedStyle(el).backgroundColor;
      if(color!=='transparent'&&color!=='rgba(0, 0, 0, 0)')return color;
     }
     return getComputedStyle(document.body).backgroundColor;
    };
    return {mainBackground:nearestOpaque(main),headingColor:getComputedStyle(document.querySelector('h1')).color,
      overflow:document.documentElement.scrollWidth-innerWidth,
      headingBackground:nearestOpaque(document.querySelector('h1'))};
   });
   assert.ok(!result.missingMain,item.name+' has visible application main');
   const canvas=rgb(result.mainBackground);
   assert.ok(canvas&&canvas.a>0.95&&luminance(canvas)<0.08,item.name+' canvas must be truly dark: '+result.mainBackground);
   const ink=rgb(result.headingColor);
   const behind=rgb(result.headingBackground);
   assert.ok(ink&&behind&&(Math.max(luminance(ink),luminance(behind))+0.05)/(Math.min(luminance(ink),luminance(behind))+0.05)>=3,
     item.name+' heading must have readable contrast: '+result.headingColor+' on '+result.headingBackground);
   assert.ok(result.overflow<=2,item.name+' has horizontal viewport overflow at '+width+'px: '+result.overflow);
   assert.deepEqual(pageErrors,[],item.name+' JavaScript errors: '+pageErrors.join('; '));
   if(evidence&&['login','login-error','client-portal-invalid','quote-response-invalid','technical-intake-invalid','partner-review-invalid','final-files-denied'].includes(item.name)){
    // These are deliberately ANONYMOUS / synthetic states. Never capture logged-in pages.
    await page.screenshot({path:join(evidence,item.name+'-'+width+'.png'),fullPage:true,animations:'disabled'});
   }
   console.log('PASS '+item.name+' '+width+'px: responsive dark canvas, heading contrast and no JS errors');
   checks++;
  }
  // Explicit negative permission smoke: external dashboards stay locked by
  // default until paid-only migration AND protected authenticated QA approval.
  for(const protectedPath of [
   '/portal/client','/portal/partner',
   '/portal/client/projects/00000000-0000-4000-8000-000000000001',
   '/portal/partner/projects/00000000-0000-4000-8000-000000000001'
  ]){
   const forbidden=await page.goto(new URL(protectedPath,base).toString(),{waitUntil:'domcontentloaded',timeout:20000});
   assert.equal(forbidden?.status(),404,'Unauthorized external dashboard must be unavailable: '+protectedPath);
   assert.equal(await page.getByRole('heading',{name:'Your engineering projects'}).count(),0,'No Client project content');
   assert.equal(await page.getByRole('heading',{name:'Your engineering work'}).count(),0,'No Partner project content');
   console.log('PASS anonymous external project access denied '+protectedPath+' at '+width+'px');
   checks++;
  }
  // Interaction: native form validation blocks blank login without server submission.
  let postCount=0;
  page.on('request',request=>{if(request.method()==='POST')postCount++;});
  await page.goto(new URL('/login',base).toString(),{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Enter Secure Workspace/i}).click();
  assert.equal(await page.locator('#workspace-email').evaluate(input=>input.validity.valueMissing),true,'Blank login must be invalid');
  assert.equal(postCount,0,'Blank login must not POST to Supabase or application');
  assert.equal(new URL(page.url()).pathname,'/login');
  console.log('PASS blank login button enforces native validation without any POST at '+width+'px');
  checks++;
  await context.close();
 }
 console.log('OPOS anonymous dark-theme browser acceptance: '+checks+' checks passed (no authenticated coverage claimed)');
}finally{await browser.close();}
