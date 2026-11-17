import {test,expect} from '@playwright/test';

// Read-only, protected manual browser QA: project links come from the scoped
// paid-only list, not guessed UUIDs. No uploads or project mutations.
for(const role of [
 {kind:'client',key:'CLIENT',heading:'Your engineering projects',wrong:'partner'},
 {kind:'partner',key:'PARTNER',heading:'Your engineering work',wrong:'client'},
]){
 test(role.kind+' sees an authorized paid project but cannot view the other portal',async({browser})=>{
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
   const home='/portal/'+role.kind;
   await page.goto('/login');
   await page.getByLabel('Email address',{exact:true}).fill(process.env['OPOS_QA_'+role.key+'_EMAIL']);
   await page.getByLabel('Password',{exact:true}).fill(process.env['OPOS_QA_'+role.key+'_PASSWORD']);
   await Promise.all([
    page.waitForURL(url=>url.pathname===home,{timeout:30_000}),
    page.getByRole('button',{name:/Enter Secure Workspace/}).click(),
   ]);
   await expect(page.getByRole('heading',{name:role.heading,exact:true})).toBeVisible();
   const projectLink=page.locator('a[href^="'+home+'/projects/"]').first();
   await expect(projectLink).toBeVisible();
   const assignedUrl=await projectLink.getAttribute('href');
   expect(assignedUrl).toMatch(new RegExp('^/portal/'+role.kind+'/projects/[0-9a-fA-F-]{36}$'));
   const projectId=assignedUrl.split('/').at(-1);
   await projectLink.click();
   await expect(page).toHaveURL(url=>url.pathname===assignedUrl);
   await expect(page.getByText('Verified paid project',{exact:false})).toBeVisible();
   const closed=await page.getByText('Project closed — no pending actions',{exact:true}).count()>0;
   if(closed){
    await expect(page.getByText('Next action',{exact:true})).toHaveCount(0);
    await expect(page.getByText(/read-only/i).first()).toBeVisible();
    await expect(page.getByRole('button',{name:/submit|report issue|update progress|make payment/i})).toHaveCount(0);
   }else{
    await expect(page.getByText('Your next step',{exact:true})).toBeVisible();
   }
   if(role.kind==='partner')await expect(page.getByText('Work Order acceptance',{exact:true})).toBeVisible();
   // The internal 28-gate evidence and Controller navigation must not render.
   await expect(page.getByText('Lifecycle evidence',{exact:false})).toHaveCount(0);
   await expect(page.locator('.op-sidebar')).toHaveCount(0);
   const response=await page.goto('/portal/'+role.wrong+'/projects/'+projectId);
   expect(response?.status()).toBe(404);
   await expect(page.getByText('Verified paid project',{exact:false})).toHaveCount(0);
  }finally{
   await context.close();
  }
 });
}
