// Browser-only acquisition setup: all business records originate from real forms.
import assert from 'node:assert/strict';

export async function createHelixAcquisitionThroughWorkspace(control,admin,organisationId){
 const clientName='Helix E2E Engineering Client';
 await control.goto('/workspace/acquisition');
 await control.getByRole('button',{name:'1 · Add company'}).click();
 const companyForm=control.locator('form:has(input[name="name"])');
 await companyForm.locator('input[name="name"]').fill(clientName);
 await companyForm.locator('input[name="industry"]').fill('Advanced manufacturing');
 await Promise.all([
  control.waitForURL(u=>u.pathname==='/workspace/acquisition'&&u.searchParams.get('company_created')==='1',{timeout:30000}),
  companyForm.getByRole('button',{name:'Create company'}).click()
 ]);
 const companyId=new URL(control.url()).searchParams.get('company_id');
 assert.ok(companyId,'Actual company form must return a company ID');
 await control.getByRole('button',{name:'2 · Add contact'}).click();
 const contactForm=control.locator('form:has(input[name="full_name"])');
 await contactForm.locator('input[name="full_name"]').fill('Helix QA Client Engineer');
 await contactForm.locator('input[name="email"]').fill('helix-client@example.invalid');
 await Promise.all([
  control.waitForURL(u=>u.pathname==='/workspace/acquisition'&&u.searchParams.get('contact_created')==='1',{timeout:30000}),
  contactForm.getByRole('button',{name:'Add contact'}).click()
 ]);
 const contactId=new URL(control.url()).searchParams.get('contact_id');
 assert.ok(contactId,'Contact must be created through its actual form');
 const prospectForm=control.locator('form.acquisition-entry-form');
 await prospectForm.locator('select[name="status"]').selectOption('conversation');
 await prospectForm.locator('textarea[name="notes"]').fill('Disposable controlled CAD design capacity request for a pump housing and fixtures');
 await Promise.all([
  control.waitForURL(u=>u.pathname.startsWith('/workspace/acquisition/')&&u.searchParams.has('created'),{timeout:30000}),
  prospectForm.getByRole('button',{name:'Create prospect'}).click()
 ]);
 const prospectId=new URL(control.url()).pathname.split('/').at(-1);
 assert.match(prospectId,/^[0-9a-f-]{36}$/i);
 const [company,contact,prospect]=await Promise.all([
  admin.from('companies').select('id').eq('organisation_id',organisationId).eq('id',companyId).single(),
  admin.from('contacts').select('id,company_id').eq('organisation_id',organisationId).eq('id',contactId).single(),
  admin.from('prospects').select('id,company_id,contact_id').eq('organisation_id',organisationId).eq('id',prospectId).single()
 ]);
 assert.equal(company.error,null);
 assert.equal(contact.error,null);
 assert.equal(prospect.error,null);
 assert.equal(contact.data.company_id,companyId);
 assert.equal(prospect.data.company_id,companyId);
 assert.equal(prospect.data.contact_id,contactId);
 console.log('PASS browser: Helix company, contact and prospect originated from real Acquisition forms.');

 await control.goto('/workspace/partners');
 await control.getByRole('button',{name:'Add partner'}).click();
 const partnerForm=control.locator('form:has(select[name="nda_signed"])');
 await partnerForm.locator('input[name="company_name"]').fill('Helix QA Precision Execution Partner');
 await partnerForm.locator('input[name="country"]').fill('United Kingdom');
 await partnerForm.locator('input[name="contact_name"]').fill('Helix QA Partner Lead');
 await partnerForm.locator('input[name="email"]').fill('helix-partner@example.invalid');
 await partnerForm.locator('select[name="status"]').selectOption('approved');
 await partnerForm.locator('select[name="nda_signed"]').selectOption('true');
 await partnerForm.locator('textarea[name="services"]').fill('Mechanical CAD, GD&T and manufacturing drawing review for disposable QA');
 await Promise.all([
  control.waitForURL(u=>u.pathname==='/workspace/partners'&&u.searchParams.get('created')==='1',{timeout:30000}),
  partnerForm.getByRole('button',{name:'Add partner'}).click()
 ]);
 const {data:partners,error:partnerError}=await admin.from('partners')
  .select('id,status,nda_signed').eq('organisation_id',organisationId)
  .eq('company_name','Helix QA Precision Execution Partner');
 assert.equal(partnerError,null);
 assert.equal(partners?.length,1);
 assert.equal(partners[0].status,'approved');
 assert.equal(partners[0].nda_signed,true);
 console.log('PASS browser: Helix test execution partner registered through real Partner form.');

 return {companyId,contactId,prospectId,partnerId:partners[0].id};
}
