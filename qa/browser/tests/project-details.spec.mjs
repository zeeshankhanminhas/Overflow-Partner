import {test,expect} from '@playwright/test';

// Read-only access checks for projects already assigned to synthetic QA identities.
// Never create/edit a project, make a payment, acknowledge work, or download files.
for(const role of [
 {kind:'client',key:'CLIENT',home:'Your engineering projects',wrong:'partner'},
 {kind:'partner',key:'PARTNER',home:'Your engineering work',wrong:'client'},
]){
 test(role.kind+' can inspect its assigned project and cannot open the other portal project URL',async({browser})=>{
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
   await page.goto('/login?next='+encodeURIComponent(home));
   await page.getByLabel('Email',{exact:true}).fill(process.env['OPOS_QA_'+role.key+'_EMAIL']);
   await page.getByLabel('Password',{exact:true}).fill(process.env['OPOS_QA_'+role.key+'_PASSWORD']);
   await Promise.all([
    page.waitForURL(url=>url.pathname===home,{timeout:30_000}),
    page.getByRole('button',{name:'Enter Workspace'}).click(),
   ]);
   await expect(page.getByRole('heading',{name:role.home,exact:true})).toBeVisible();

   // The project link must come from the role-scoped dashboard, not an assumed UUID.
   const projectLink=page.locator('a[href^="'+home+'/projects/"]').first();
   await expect(projectLink).toBeVisible();
   const assignedUrl=await projectLink.getAttribute('href');
   expect(assignedUrl).toMatch(new RegExp('^/portal/'+role.kind+'/projects/[0-9a-fA-F-]{36}$'));
   const projectId=assignedUrl.split('/').at(-1);

   await projectLink.click();
   await expect(page).toHaveURL(url=>url.pathname===assignedUrl);
   await expect(page.locator('section[aria-label="Authoritative project next action"]')).toBeVisible();
   await expect(page.getByText('Responsible role:',{exact:false})).toBeVisible();
   await expect(page.getByText('Business lifecycle',{exact:true})).toBeVisible();

   // Full 28-gate internal evidence must never render for an external user.
   await expect(page.getByText('Lifecycle evidence',{exact:false})).toHaveCount(0);

   // Direct URL navigation must deny access even when both portal kinds may
   // be associated with the same QA project. A shared project is not shared login.
   await page.goto('/portal/'+role.wrong+'/projects/'+projectId);
   await expect(page).toHaveURL(/\/login\?next=/);
   await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
   await expect(page.locator('section[aria-label="Authoritative project next action"]')).toHaveCount(0);
  }finally{
   await context.close();
  }
 });
}
