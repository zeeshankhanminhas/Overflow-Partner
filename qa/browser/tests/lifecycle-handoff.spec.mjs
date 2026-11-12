import {test, expect} from '@playwright/test';

// Non-destructive, authenticated continuity test. A full write-enabled lifecycle
// must use a NEW synthetic project; never mutate the frozen Northfield baseline.
const baseURL=process.env.OPOS_QA_BASE_URL;
const bypass=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const cases=[
  {kind:'client',key:'CLIENT',heading:'Your engineering projects'},
  {kind:'partner',key:'PARTNER',heading:'Your engineering work'},
];

async function openAs(browser,role) {
  const context=await browser.newContext({
    baseURL,
    serviceWorkers:'block',
    extraHTTPHeaders:{
      'x-vercel-protection-bypass':bypass,
      'x-vercel-set-bypass-cookie':'true',
    },
  });
  const page=await context.newPage();
  const home='/portal/'+role.kind;
  await page.goto('/login?next='+encodeURIComponent(home));
  await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
  await page.getByLabel('Email',{exact:true}).fill(process.env['OPOS_QA_'+role.key+'_EMAIL']);
  await page.getByLabel('Password',{exact:true}).fill(process.env['OPOS_QA_'+role.key+'_PASSWORD']);
  await Promise.all([
    page.waitForURL(url=>url.pathname===home,{timeout:30_000}),
    page.getByRole('button',{name:'Enter Workspace'}).click(),
  ]);
  await expect(page.getByRole('heading',{name:role.heading,exact:true})).toBeVisible();
  const projectLink=page.locator('a[href^="'+home+'/projects/"]').first();
  await expect(projectLink).toBeVisible();
  const path=await projectLink.getAttribute('href');
  expect(path).toMatch(new RegExp('^'+home+'/projects/[0-9a-fA-F-]{36}$'));
  await projectLink.click();
  await expect(page).toHaveURL(url=>url.pathname===path);
  await expect(page.locator('section[aria-label="Authoritative project next action"]')).toBeVisible();
  await expect(page.getByText('Business lifecycle',{exact:true})).toBeVisible();
  await expect(page.getByText('Responsible role:',{exact:false})).toBeVisible();
  // Internal evidence is never exposed to external accounts.
  await expect(page.getByText('Lifecycle evidence',{exact:false})).toHaveCount(0);
  return {context,page,projectId:path.split('/').at(-1)};
}

test('one governed project remains consistent across client and partner browser sessions',async({browser})=>{
  // Isolated sessions: no state or cookie sharing between roles.
  const opened=[];
  try {
    for(const role of cases) opened.push({...await openAs(browser,role),role});
    expect(opened[0].projectId).toBe(opened[1].projectId);
    for(const entry of opened){
      const wrong=entry.role.kind==='client'?'partner':'client';
      await entry.page.goto('/portal/'+wrong+'/projects/'+entry.projectId);
      await expect(entry.page).toHaveURL(/\\/login\\?next=/);
      await expect(entry.page.getByLabel('Password',{exact:true})).toBeVisible();
      await expect(entry.page.locator('section[aria-label="Authoritative project next action"]')).toHaveCount(0);
    }
  }finally{
    await Promise.all(opened.map(({context})=>context.close()));
  }
});
