import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

// All accounts and all screenshots are fictional localhost-only CI fixtures.
const password='isolated-qa-Browser-2026!';
const paidProject='00000000-0000-4000-8000-000000007107';
const unpaidProject='00000000-0000-4000-8000-000000007108';
const evidence=process.env.OPOS_SYNTHETIC_SCREENSHOT_DIR||'';
const pages=[
 ['/workspace','Home'],['/workspace/opportunities','Opportunities'],
 ['/workspace/projects','Projects'],['/workspace/payments','Finance'],
 ['/workspace/documents','Documents'],['/workspace/attention','My Work']
];
const parseColor=c=>{const m=String(c).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);return m?[+m[1],+m[2],+m[3]]:null};
const lightness=c=>{
 const vals=c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});
 return .2126*vals[0]+.7152*vals[1]+.0722*vals[2];
};
const contrast=(x,y)=>{
 const a=parseColor(x),b=parseColor(y);
 if(!a||!b)return 0;
 const l=lightness(a),r=lightness(b);
 return (Math.max(l,r)+.05)/(Math.min(l,r)+.05);
};
async function login(page,role){
 await page.goto('/login');
 await expect(page.getByRole('heading',{name:'Sign In'})).toBeVisible();
 await page.getByLabel('Email address').fill(role+'.qa@example.invalid');
 await page.getByLabel('Password').fill(password);
 await page.getByRole('button',{name:/Enter Secure Workspace/}).click();
}
async function screenshot(page,name,width){
 if(!evidence)return;
 await mkdir(evidence,{recursive:true});
 await page.screenshot({path:join(evidence,name+'-'+width+'.png'),fullPage:true,animations:'disabled'});
}
async function noOverflow(page,label='page'){
 const detail=await page.evaluate(()=>{
   const pixels=document.documentElement.scrollWidth-window.innerWidth;
   const offenders=[...document.querySelectorAll('body *')]
     .filter(el=>{const box=el.getBoundingClientRect();const style=getComputedStyle(el);
       return box.width>0 && box.right>window.innerWidth+2 && style.position!=='fixed'
         && style.visibility!=='hidden';})
     .slice(0,5).map(el=>el.tagName.toLowerCase()+'.'+String(el.className||'').slice(0,70));
   return {pixels,offenders};
 });
 expect(detail.pixels,label+' horizontal overflow; offenders='+detail.offenders.join(';')).toBeLessThanOrEqual(2);
}
for(const width of [390,1440]){
 test('Controller real signed-in visual navigation '+width,async({browser})=>{
  test.setTimeout(240000);
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();
   await login(page,'controller');
   await expect(page).toHaveURL(/\/workspace$/);
   for(const [path,label] of pages){
    const response=await page.goto(path,{waitUntil:'domcontentloaded'});
    expect(response?.status(),label+' HTTP status').toBeLessThan(400);
    await expect(page.locator('.workspace.op-shell')).toBeVisible();
    await expect(page.locator('.op-content h1').first()).toBeVisible();
    await expect(page.getByRole('heading',{name:'Something went wrong'})).toHaveCount(0);
    if(path==='/workspace')await screenshot(page,'controller-home',width);
    if(path==='/workspace/projects' && width===1440){
     const register=page.locator('.project-portfolio-register');
     await expect(register).toBeVisible();
     const dimensions=await register.evaluate(el=>({
       visibleWidth:el.getBoundingClientRect().width,
       scrollWidth:el.scrollWidth,
       width:el.clientWidth,
       overflowX:getComputedStyle(el).overflowX
     }));
     expect(dimensions.overflowX).toBe('auto');
     expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.width);
     expect(dimensions.visibleWidth).toBeLessThan(1100);
    }
    await noOverflow(page,label);
   }
   await page.goto('/workspace');
   const search=page.getByRole('button',{name:'Search workspace'}).last();
   await search.click();
   await expect(page.getByRole('dialog',{name:'Workspace command palette'})).toBeVisible();
   await screenshot(page,'controller-search',width);
   await page.keyboard.press('Escape');
   await expect(page.getByRole('dialog',{name:'Workspace command palette'})).toHaveCount(0);
   const denied=await page.goto('/portal/client');
   expect(denied?.status()).toBe(404);
  }finally{await context.close()}
 });
 test('Paid Client actual dashboard and cross-project isolation '+width,async({browser})=>{
  test.setTimeout(160000);
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   const page=await context.newPage();
   await login(page,'client');
   await expect(page).toHaveURL(/\/portal\/client$/);
   await expect(page.getByRole('heading',{name:'Your engineering projects'})).toBeVisible();
   await expect(page.getByText('Synthetic Paid Engineering Project')).toBeVisible();
   await expect(page.getByText('Synthetic Unpaid Engineering Project')).toHaveCount(0);
   await expect(page.getByRole('heading',{name:'Active projects'})).toBeVisible();
   await expect(page.getByRole('heading',{name:'Completed and closed projects'})).toBeVisible();
   await expect(page.getByRole('link',{name:'View closed project'})).toHaveCount(1);
   const link=page.getByRole('link',{name:'Open project'});
   await expect(link).toBeVisible();
   const ratio=await link.evaluate(el=>{
    const c=getComputedStyle(el);
    return {ink:c.color,background:c.backgroundColor};
   });
   expect(contrast(ratio.ink,ratio.background),'Orange CTA readable contrast').toBeGreaterThanOrEqual(4.5);
   await screenshot(page,'client-paid',width);
   await noOverflow(page,'Client paid overview');
   await link.click();
   await expect(page).toHaveURL(new RegExp('/portal/client/projects/'+paidProject+'$'));
   await expect(page.getByText('Verified paid project',{exact:false})).toBeVisible();
   await screenshot(page,'client-project',width);
   const denied=await page.goto('/portal/client/projects/'+unpaidProject);
   expect(denied?.status()).toBe(404);
   const wrong=await page.goto('/portal/partner/projects/'+paidProject);
   expect(wrong?.status()).toBe(404);
   await page.goto('/portal/client');
   await page.getByRole('link',{name:'View closed project'}).click();
   await expect(page).toHaveURL(/\/portal\/client\/projects\/00000000-0000-4000-8000-000000007112$/);
   await expect(page.getByText('Project closed — no pending actions')).toBeVisible();
   await expect(page.getByText('This is a read-only record',{exact:false})).toBeVisible();
   await expect(page.getByText('Next action',{exact:true})).toHaveCount(0);
   await expect(page.getByRole('button',{name:/Submit|Report issue|Update progress/i})).toHaveCount(0);
   await screenshot(page,'client-closed',width);
   await noOverflow(page,'Client closed project');
   await page.goto('/workspace');
   await expect(page.getByRole('heading',{name:'Your engineering projects'})).toBeVisible();
   await expect(page.locator('.op-sidebar')).toHaveCount(0);
  }finally{await context.close()}
 });
}
test('Unpaid Client and unauthorized Partner receive secure-link-only denial',async({browser})=>{
 for(const persona of ['unpaid','partner']){
  const context=await browser.newContext();
  try{
   const page=await context.newPage();
   await login(page,persona);
   await expect(page).toHaveURL(/\/login\?error=/);
   await expect(page.getByRole('heading',{name:'Sign In'})).toBeVisible();
   await expect(page.getByRole('heading',{name:'Your engineering projects'})).toHaveCount(0);
   await expect(page.getByRole('heading',{name:'Your engineering work'})).toHaveCount(0);
   const target=persona==='unpaid'?'/portal/client':'/portal/partner';
   await page.goto(target);
   await expect(page.getByRole('heading',{name:/Your engineering projects|Your engineering work/})).toHaveCount(0);
  }finally{await context.close()}
 }
});
test('Legacy mixed Controller and Partner identity is denied at sign-in',async({browser})=>{
 const context=await browser.newContext();
 try{
  const page=await context.newPage();
  await login(page,'conflict');
  await expect(page).toHaveURL(/\/login\?error=/);
  await expect(page.getByText(/Conflicting account permissions/i)).toBeVisible();
  await page.goto('/workspace');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('.workspace.op-shell')).toHaveCount(0);
  await page.goto('/portal/partner');
  await expect(page.getByRole('heading',{name:'Your engineering work'})).toHaveCount(0);
 }finally{await context.close()}
});
test('Anonymous requests never receive paid dashboards',async({page})=>{
 for(const path of ['/portal/client','/portal/partner',
   '/portal/client/projects/'+paidProject,'/portal/partner/projects/'+paidProject]){
  await page.goto(path);
  await expect(page.getByRole('heading',{name:/Your engineering projects|Your engineering work/})).toHaveCount(0);
 }
});
