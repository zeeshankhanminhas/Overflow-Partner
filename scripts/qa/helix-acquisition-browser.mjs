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


 // Customer requirement is requested through the operator UI and submitted through
 // a separate public browser session, not inserted into intake tables.
 await control.goto('/workspace/acquisition/'+prospectId);
 await control.getByRole('button',{name:'Create requirements request'}).click();
 await control.waitForURL(u=>u.pathname==='/workspace/acquisition/'+prospectId&&u.searchParams.has('invitation'),{timeout:30000});
 const invitation=new URL(control.url()).searchParams.get('invitation');
 assert.ok(invitation?.includes('/intake/'));
 const clientContext=await control.context().browser().newContext({serviceWorkers:'block'});
 try{
  const intake=await clientContext.newPage();
  await intake.goto(invitation);
  await intake.getByRole('heading',{name:'Technical intake'}).waitFor();
  await intake.locator('textarea[name="description"]').fill(
   'Manufacturing CAD package for pump housing and assembly fixtures: full dimensions, GD&T and fabrication-ready drawings.');
  await intake.locator('select[name="project_type"]').selectOption('Manufacturing drawings');
  await intake.locator('input[name="deliverable_items"][value="Manufacturing drawings"]').check();
  await intake.locator('input[name="deliverable_items"][value="3D CAD models"]').check();
  const requestPromise=intake.waitForResponse(
   response=>response.url().includes('/api/intake/')&&response.request().method()==='POST',
   {timeout:30000}
  );
  await intake.getByRole('button',{name:'Submit technical intake'}).click();
  const submittedResponse=await requestPromise;
  const submittedBody=await submittedResponse.text();
  assert.equal(submittedResponse.status(),200,
   'Client intake POST rejected: '+submittedResponse.status()+' '+submittedBody.slice(0,800));
  await intake.getByRole('heading',{name:'Technical requirement submitted.'}).waitFor({timeout:15000});
 } finally { await clientContext.close(); }
 const {count:submittedIntakes,error:intakeError}=await admin.from('intake_submissions')
  .select('*',{count:'exact',head:true}).eq('organisation_id',organisationId);
 assert.equal(intakeError,null);
 assert.ok(submittedIntakes>0,'Client must submit actual technical requirements');
 console.log('PASS browser: secure requirements request and separate client submission recorded.');

 // A single approved NDA-ready partner is deliberately available, so the
 // trusted intake handler should create the actual referral and notification.
 // Read the issued URL; do not fabricate or directly insert partner approval.
 const {data:referrals,error:referralError}=await admin.from('partner_review_requests')
  .select('id,status,partner_id').eq('organisation_id',organisationId)
  .eq('prospect_id',prospectId).order('created_at',{ascending:false});
 assert.equal(referralError,null);
 assert.equal(referrals?.length,1,'Automatic intake handoff must create exactly one partner referral');
 assert.equal(referrals[0].partner_id,partners[0].id);
 assert.equal(referrals[0].status,'invited');
 const {data:notice,error:noticeError}=await admin.from('notification_outbox')
  .select('id,payload,recipient_email').eq('organisation_id',organisationId)
  .eq('event_key','partner_review.requested').eq('entity_id',prospectId).single();
 assert.equal(noticeError,null,'Partner review invitation must be queued');
 assert.equal(notice.recipient_email,'helix-partner@example.invalid');
 const partnerUrl=notice.payload?.actionUrl;
 assert.ok(partnerUrl?.includes('/partner-review/'),'Partner link must be issued by the normal notification system');
 console.log('PASS browser: approved partner automatically referred with governed invitation.');
 const partnerContext=await control.context().browser().newContext({serviceWorkers:'block'});
 try{
  const review=await partnerContext.newPage();
  await review.goto(partnerUrl);
  await review.getByRole('heading',{name:'Partner review'}).waitFor();
  const form=review.locator('form:has(select[name="feasibility"])');
  await form.locator('select[name="feasibility"]').selectOption('feasible');
  await form.locator('input[name="confidence_percent"]').fill('94');
  await form.locator('select[name="capability_confirmed"]').selectOption('true');
  await form.locator('select[name="capacity_status"]').selectOption('available');
  await form.locator('input[name="estimated_engineering_hours"]').fill('30');
  await form.locator('input[name="estimated_lead_time_days"]').fill('14');
  await form.locator('select[name="pricing_readiness"]').selectOption('ready');
  await form.locator('input[name="commercial_price"]').fill('1600');
  await form.locator('input[name="quote_reference"]').fill('HELIX-QA-PTA-001');
  await form.locator('input[name="reviewer_name"]').fill('Helix QA Partner Engineer');
  await form.locator('input[name="declaration_checked"]').check();
  await form.getByRole('button',{name:'Submit technical and commercial response'}).click();
  await review.getByText('Technical and commercial response submitted.',{exact:false}).waitFor({timeout:30000});
 } finally { await partnerContext.close(); }
 console.log('PASS browser: Execution Partner submitted feasibility, capacity and price through public review.');

 await control.goto('/workspace/acquisition/'+prospectId);
 const decision=control.locator('form:has(select[name="decision"])');
 await decision.locator('select[name="decision"]').selectOption('approved');
 await decision.locator('textarea[name="review_notes"]').fill('Engineering feasibility and commercial capacity independently reviewed');
 await Promise.all([
  control.waitForURL(u=>u.pathname==='/workspace/acquisition/'+prospectId&&u.searchParams.has('partnerDecision'),{timeout:30000}),
  decision.getByRole('button',{name:'Confirm decision'}).click()
 ]);
 await control.getByRole('button',{name:'Progress opportunity'}).click();
 await control.waitForURL(u=>u.pathname.startsWith('/workspace/leads/')&&u.searchParams.has('success'),{timeout:30000});
 const caseId=new URL(control.url()).pathname.split('/').at(-1);
 assert.match(caseId,/^[0-9a-f-]{36}$/i);
 const {data:caseRow,error:caseError}=await admin.from('leads').select('id,organisation_id').eq('id',caseId).single();
 assert.equal(caseError,null);
 assert.equal(caseRow.organisation_id,organisationId);
 console.log('PASS browser: partner-approved Go / No-Go converted Helix prospect into Case 360.');
 return {companyId,contactId,prospectId,caseId,partnerId:partners[0].id};
}
