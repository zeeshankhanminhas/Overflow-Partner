import {test,expect} from '@playwright/test';

/**
 * Credential-free, read-only browser checks. These do not claim to validate
 * authenticated Controller/Client/Partner business actions or Gmail delivery.
 * Never send passwords, trigger payments or mutate the QA database here.
 */
for(const entry of [
 {name:'Controller',next:'/opos-next',heading:'Operator Workspace'},
 {name:'Client',next:'/portal/client',heading:'Client Workspace'},
 {name:'Execution Partner',next:'/portal/partner',heading:'Execution Partner Workspace'},
]){
 test(`${entry.name} sign-in renders the correct workspace destination`,async({page})=>{
  await page.goto('/login?next='+encodeURIComponent(entry.next));
  await expect(page.getByRole('heading',{name:entry.heading,exact:true})).toBeVisible();
  await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
  await expect(page.locator('form input[name="next"]')).toHaveValue(entry.next);
  await expect(page.getByRole('button',{name:'Enter Workspace'})).toBeVisible();
 });
}
for(const kind of ['client','partner']){
 test(`unauthenticated ${kind} portal cannot reveal projects`,async({page})=>{
  await page.goto('/portal/'+kind);
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
  await expect(page.getByText('Northfield',{exact:false})).toHaveCount(0);
 });
}
test('login return destination rejects an arbitrary external URL',async({page})=>{
 await page.goto('/login?next='+encodeURIComponent('https://example.com'));
 await expect(page.locator('form input[name="next"]')).toHaveValue('/opos-next');
 await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
});
