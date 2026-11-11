import {test,expect} from '@playwright/test';

/**
 * These are authenticated READ-ONLY checks for synthetic Northfield QA data.
 * No project changes, uploads, emails, payment attempts, or bank operations.
 * Each identity uses its own disposable browser context; never persist state.
 */
const identities=[
 {role:'Controller',key:'CONTROLLER',next:'/opos-next',heading:'Mission Control'},
 {role:'Client',key:'CLIENT',next:'/portal/client',heading:'Your engineering projects',account:'Northfield'},
 {role:'Execution Partner',key:'PARTNER',next:'/portal/partner',heading:'Your engineering work',account:'Precision Mechanical Design'},
];
for(const identity of identities){
 test(identity.role+' signs in and sees only its intended workspace',async({browser})=>{
  const context=await browser.newContext({
   baseURL:process.env.OPOS_QA_BASE_URL,
   extraHTTPHeaders:{
    'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    'x-vercel-set-bypass-cookie':'true',
   },
   serviceWorkers:'block',
  });
  try{
   const page=await context.newPage();
   await page.goto('/login?next='+encodeURIComponent(identity.next));
   await expect(page.getByRole('heading',{name:identity.role==='Controller'?'Operator Workspace':identity.role==='Client'?'Client Workspace':'Execution Partner Workspace',exact:true})).toBeVisible();
   await page.getByLabel('Email',{exact:true}).fill(process.env['OPOS_QA_'+identity.key+'_EMAIL']);
   await page.getByLabel('Password',{exact:true}).fill(process.env['OPOS_QA_'+identity.key+'_PASSWORD']);
   await Promise.all([
    page.waitForURL(url=>url.pathname===identity.next,{timeout:30_000}),
    page.getByRole('button',{name:'Enter Workspace'}).click(),
   ]);
   await expect(page.getByRole('heading',{name:identity.heading,exact:true})).toBeVisible();
   if(identity.account)await expect(page.getByText(identity.account,{exact:false}).first()).toBeVisible();
   await expect(page.getByLabel('Password',{exact:true})).toHaveCount(0);
   // Confirm role boundaries as rendered by the authenticated app.
   const mustBeDenied=async path=>{
    await page.goto(path);
    const denied=page.getByText('This sign-in does not have access',{exact:false});
    const login=page.getByLabel('Password',{exact:true});
    await expect.poll(async()=>await denied.count()>0 || await login.count()>0).toBe(true);
    await expect(page.getByRole('link',{name:/Open project handover|Review your drawings|Review your quotation/})).toHaveCount(0);
   };
   if(identity.role==='Controller'){
    await mustBeDenied('/portal/client');
    await mustBeDenied('/portal/partner');
   }else{
    await page.goto('/opos-next');
    await expect(page.getByRole('heading',{name:'Mission Control',exact:true})).toHaveCount(0);
    await mustBeDenied(identity.role==='Client'?'/portal/partner':'/portal/client');
   }
  }finally{
   await context.close();
  }
 });
}
