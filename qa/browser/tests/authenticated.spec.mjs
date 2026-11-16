import {test,expect} from '@playwright/test';

/** Protected manual QA only, never credentials in PR jobs or artifacts.
 * Read-only: sign-in and role-bound pages, no business state mutations. */
const identities=[
 {role:'Controller',key:'CONTROLLER',home:'/workspace',heading:'What needs your attention?'},
 {role:'Client',key:'CLIENT',home:'/portal/client',heading:'Your engineering projects'},
 {role:'Execution Partner',key:'PARTNER',home:'/portal/partner',heading:'Your engineering work'},
];
for(const identity of identities){
 test(identity.role+' signs in to the correct paid-scope workspace',async({browser})=>{
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
   await page.goto('/login');
   await expect(page.getByRole('heading',{name:'Sign In',exact:true})).toBeVisible();
   await page.getByLabel('Email address',{exact:true}).fill(process.env['OPOS_QA_'+identity.key+'_EMAIL']);
   await page.getByLabel('Password',{exact:true}).fill(process.env['OPOS_QA_'+identity.key+'_PASSWORD']);
   await Promise.all([
    page.waitForURL(url=>url.pathname===identity.home,{timeout:30_000}),
    page.getByRole('button',{name:/Enter Secure Workspace/}).click(),
   ]);
   await expect(page.getByRole('heading',{name:identity.heading,exact:true})).toBeVisible();
   await expect(page.getByLabel('Password',{exact:true})).toHaveCount(0);
   if(identity.role==='Controller'){
    for(const path of ['/portal/client','/portal/partner']){
     const r=await page.goto(path);
     expect(r?.status()).toBe(404);
     await expect(page.getByRole('heading',{name:/Your engineering projects|Your engineering work/})).toHaveCount(0);
    }
   }else{
    const other=identity.role==='Client'?'partner':'client';
    const response=await page.goto('/portal/'+other);
    expect(response?.status()).toBe(404);
    await page.goto('/workspace');
    await expect(page.getByRole('heading',{name:'What needs your attention?',exact:true})).toHaveCount(0);
   }
  }finally{
   await context.close();
  }
 });
}
