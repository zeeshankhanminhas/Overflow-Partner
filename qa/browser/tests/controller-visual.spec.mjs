import {test,expect} from '@playwright/test';

/**
 * Authenticated Controller visual acceptance for OPOS Workspace 2.0.
 * Approved protected-manual-main workflow only. READ ONLY: no form submissions
 * after sign-in, no downloads, no sensitive screenshots, video, trace or artifacts.
 * All failure details are structural, never record contents or credentials.
 */
const pages=[
  ['Home','/workspace'],
  ['Opportunities','/workspace/opportunities'],
  ['Projects','/workspace/projects'],
  ['Finance','/workspace/payments'],
  ['Documents','/workspace/documents'],
  ['My Work','/workspace/attention'],
];
const viewports=[
  {name:'desktop',size:{width:1440,height:900}},
  {name:'mobile',size:{width:390,height:844}},
];
async function inspect(page) {
 return await page.evaluate(() => {
  const rgb=value=>{
   const match=String(value).match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/);
   return match?{r:+match[1],g:+match[2],b:+match[3],a:match[4]===undefined?1:+match[4]}:null;
  };
  const blend=(fg,bg)=>({r:fg.r*fg.a+bg.r*(1-fg.a),g:fg.g*fg.a+bg.g*(1-fg.a),b:fg.b*fg.a+bg.b*(1-fg.a),a:1});
  const luminance=c=>{
   const f=n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4};
   return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);
  };
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const shown=el=>{
   const style=getComputedStyle(el),box=el.getBoundingClientRect();
   return style.display!=='none'&&style.visibility!=='hidden'&&+style.opacity>0&&box.width>0&&box.height>0;
  };
  const background=el=>{
   const tree=[];for(let node=el;node instanceof Element;node=node.parentElement)tree.push(node);
   let result={r:8,g:9,b:10,a:1};
   for(const node of tree.reverse()){
    const style=getComputedStyle(node);
    if(style.backgroundImage!=='none')return null; // gradient cannot be sampled safely by computed styles
    const color=rgb(style.backgroundColor);
    if(color)result=blend(color,result);
   }
   return result;
  };
  const scope=document.querySelector('.workspace.op-shell');
  if(!scope)return {count:0,issues:['workspace-shell-absent']};
  const elements=[...scope.querySelectorAll('button, a.button, [role="button"], input[type="submit"], summary')].filter(shown);
  const issues=[];
  for(let index=0;index<elements.length;index++){
   const el=elements[index];
   const labelNodes=[...el.querySelectorAll('span, strong, small, em')].filter(
     child=>shown(child)&&child.textContent?.trim()&&!child.querySelector('span,strong,small,em')
   );
   const textNodes=labelNodes.length?labelNodes:[el];
   for(const node of textNodes){
    if(!(node.textContent||'').trim())continue;
    const fg=rgb(getComputedStyle(node).color),bg=background(node);
    // Fail closed on unparseable colors; never silently claim good contrast.
    if(!fg||!bg){issues.push('unmeasurable-color-'+index);continue;}
    const ratio=contrast(blend(fg,bg),bg);
    const font=getComputedStyle(node);
    const large=parseFloat(font.fontSize)>=24||
      (parseFloat(font.fontSize)>=18.66&&parseInt(font.fontWeight,10)>=700);
    const min=el.matches(':disabled,[aria-disabled="true"]')?3:(large?3:4.5);
    if(ratio<min)issues.push('low-contrast-control-'+index+'-'+ratio.toFixed(2));
   }
  }
  return {count:elements.length,issues};
 });
}
for(const viewport of viewports){
 test('Controller visual acceptance: '+viewport.name,async({browser})=>{
  test.setTimeout(180_000);
  const context=await browser.newContext({
   baseURL:process.env.OPOS_QA_BASE_URL,
   viewport:viewport.size,
   serviceWorkers:'block',
   extraHTTPHeaders:{
    'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    'x-vercel-set-bypass-cookie':'true',
   },
  });
  try {
   const page=await context.newPage();
   await page.goto('/login');
   await expect(page.getByRole('heading',{name:'Sign In'})).toBeVisible();
   await page.getByLabel('Email address').fill(process.env.OPOS_QA_CONTROLLER_EMAIL);
   await page.getByLabel('Password').fill(process.env.OPOS_QA_CONTROLLER_PASSWORD);
   await Promise.all([
    page.waitForURL(url=>url.pathname==='/workspace',{timeout:30_000}),
    page.getByRole('button',{name:/Enter Secure Workspace/}).click(),
   ]);
   for(const [label,route] of pages){
    const response=await page.goto(route,{waitUntil:'domcontentloaded'});
    expect(response?.status(),label+' HTTP status').toBeLessThan(400);
    await expect(page.locator('.workspace.op-shell'),label+' workspace shell').toBeVisible();
    await expect(page.locator('.op-content h1').first(),label+' page heading').toBeVisible();
    await expect(page.getByRole('heading',{name:/Something went wrong/i})).toHaveCount(0);
    const visual=await inspect(page);
    expect(visual.count,label+' interactive controls').toBeGreaterThan(0);
    expect(visual.issues,label+' contrast defects (structural indices only)').toEqual([]);
   }
   await page.goto('/workspace');
   const search=page.getByRole('button',{name:'Search workspace'}).last();
   await expect(search).toBeVisible();
   await search.click(); // UI only; no record mutation
   await expect(page.getByRole('dialog',{name:'Workspace command palette'})).toBeVisible();
   const popover=await inspect(page);
   expect(popover.issues,'Command palette contrast').toEqual([]);
   await page.keyboard.press('Escape');
   await expect(page.getByRole('dialog',{name:'Workspace command palette'})).toHaveCount(0);
  }finally{
   await context.close();
  }
 });
}
