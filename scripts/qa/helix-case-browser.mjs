// Governed Case 360 progression: only rendered operator server actions.
import assert from 'node:assert/strict';
import {approveHelixCaseEvidence} from './helix-document-browser.mjs';
import {verifyHelixOpeningPayment} from './helix-opening-payment.mjs';
import {mobiliseHelixNewProject} from './helix-project-browser.mjs';

export async function createHelixDraftQuoteThroughCase360(control,admin,orgId,caseId,partnerId,operatorDb,onStage=async()=>{}){
 const path='/workspace/leads/'+caseId;
 const open=async()=>{
  await control.goto(path);
  await control.locator('#record-next-action').waitFor({timeout:30000});
 };
 const act=async(label)=>{
  const button=control.locator('#record-next-action').getByRole('button',{name:label});
  assert.equal(await button.count(),1,'Expected one governed Case action: '+label);
  await Promise.all([
   control.waitForURL(u=>u.pathname===path&&(u.searchParams.has('success')||u.searchParams.has('error')),{timeout:30000}),
   button.click()
  ]);
  const url=new URL(control.url());
  assert.equal(url.searchParams.get('error'),null,'Case action '+label+' failed: '+url.searchParams.get('error'));
  assert.ok(url.searchParams.get('success'),'Case action '+label+' must report success');
  await open();
 };
 await open();
 if(await control.locator('#record-next-action').getByRole('button',{name:'Create technical scope'}).count()){
  await act('Create technical scope');
 }
 await approveHelixCaseEvidence(control,admin,orgId,caseId,'client-requirements');
 await approveHelixCaseEvidence(control,admin,orgId,caseId,'partner-technical-assessment-report');
 // Both controlled evidence documents must be approved before the operator
 // can perform the governed Technical Scope approval.
 assert.equal(await control.locator('#record-next-action').getByRole('button',{name:'Approve technical scope'}).count(),1,
  'Both approved document records must expose the actual technical approval');
 await act('Approve technical scope');
 const [intake,partnerQuotes,reviews,controlled]=await Promise.all([
  admin.from('technical_intakes').select('id,status').eq('organisation_id',orgId).eq('lead_id',caseId),
  admin.from('partner_quotes').select('id,status,price,partner_review_request_id').eq('organisation_id',orgId).eq('lead_id',caseId),
  admin.from('partner_review_requests').select('id,status,partner_id').eq('organisation_id',orgId).eq('lead_id',caseId),
  admin.from('documents').select('document_type,status').eq('organisation_id',orgId).eq('lead_id',caseId)
 ]);
 const next=await control.locator('#record-next-action').innerText();
 console.log('HELIX CASE PRICING READINESS '+JSON.stringify({next,intake:intake.data,partnerQuotes:partnerQuotes.data,reviews:reviews.data,documents:controlled.data,errors:[intake.error?.message,partnerQuotes.error?.message,reviews.error?.message,controlled.error?.message].filter(Boolean)}));
 assert.equal(await control.locator('#record-next-action').getByRole('button',{name:'Set commercial position'}).count(),1,
  'Approved inherited partner feasibility and scope must enable commercial pricing');
 await act('Set commercial position');
 await act('Approve position and generate Client Quote');
 const {data:quotes,error:quoteError}=await admin.from('quotes')
  .select('id,lead_id,commercial_review_id,status,revision,total,currency')
  .eq('organisation_id',orgId).eq('lead_id',caseId).order('created_at',{ascending:false});
 assert.equal(quoteError,null);
 assert.equal(quotes?.length,1,'One canonical client quote generated from the approved Case');
 assert.equal(quotes[0].status,'draft','Quote must remain controlled draft until document approval and actual provider acknowledgement');
 assert.ok(quotes[0].commercial_review_id,'Quote must inherit approved partner commercial lineage');
 assert.ok(Number(quotes[0].total)>0,'Quote total must be positive');
 console.log('PASS browser: governed Case technical approval, 33% margin and draft Client Quote generated through UI.');
 await approveHelixCaseEvidence(control,admin,orgId,caseId,'client-quote');
 const {data:controlledQuote,error:controlledQuoteError}=await admin.from('documents')
  .select('id,status,quote_id,approved_by,signed_by').eq('organisation_id',orgId)
  .eq('lead_id',caseId).eq('quote_id',quotes[0].id).eq('document_type','client-quote')
  .eq('is_current_revision',true).single();
 assert.equal(controlledQuoteError,null,'Generated Client Quote must have its controlled document');
 assert.equal(controlledQuote.status,'approved');
 assert.ok(controlledQuote.signed_by&&controlledQuote.approved_by);
 console.log('PASS browser: actual Client Quote independently governed document approved before issue.');
 await control.goto(path);
 const issueForm=control.locator('#record-next-action form:has(select[name="contract_release_basis"])');
 assert.equal(await issueForm.count(),1,'Approved quotation must offer governed client issue');
 assert.equal(await issueForm.locator('select[name="contract_release_basis"]').inputValue(),'deposit');
 await Promise.all([
  control.waitForURL(u=>u.pathname===path&&(u.searchParams.has('success')||u.searchParams.has('error')),{timeout:30000}),
  issueForm.getByRole('button',{name:'Send Client Quote by email'}).click()
 ]);
 const issueUrl=new URL(control.url());
 assert.equal(issueUrl.searchParams.get('error'),null,'Actual quotation issue blocked: '+issueUrl.searchParams.get('error'));
 const {data:issuedQuote,error:issuedQuoteError}=await admin.from('quotes')
  .select('status').eq('organisation_id',orgId).eq('id',quotes[0].id).single();
 assert.equal(issuedQuoteError,null);
 assert.equal(issuedQuote.status,'issued','Client Quote must issue only after mail provider acceptance');
 const {data:outbox,error:outboxError}=await admin.from('notification_outbox')
  .select('status,provider_message_id,payload').eq('organisation_id',orgId)
  .eq('entity_id',quotes[0].id).eq('event_key','quote.issued').single();
 assert.equal(outboxError,null);
 assert.equal(outbox.status,'sent');
 assert.match(outbox.provider_message_id,/^qa-local-provider-/);
 const response=await fetch('http://127.0.0.1:3411/messages');
 assert.equal(response.status,200);
 const {messages}=await response.json();
 const delivered=messages.find(x=>x.id===outbox.provider_message_id);
 assert.ok(delivered,'Provider acknowledgement must identify this customer quotation');
 assert.match(delivered.html,/quote-response\?token=/);
 assert.ok(delivered.attachments?.some(x=>x.filename?.endsWith('.pdf')&&x.content?.length>100));
 console.log('PASS browser: Client Quote issued through governed UI; local HTTP provider accepted PDF and signed response links.');
 const acceptUrl=outbox.payload?.actions?.find(action=>action.label==='Accept and proceed')?.url;
 assert.ok(acceptUrl?.includes('/quote-response?token='),'Mail payload must contain signed client acceptance action');
 const clientContext=await control.context().browser().newContext({serviceWorkers:'block'});
 try{
  const client=await clientContext.newPage();
  client.setDefaultTimeout(25000);
  await client.goto(acceptUrl);
  await client.getByRole('heading',{name:'Accept this quotation?'}).waitFor();
  await client.locator('input[name="signatory_name"]').fill('Helix QA Client Engineer');
  await client.locator('input[name="signatory_email"]').fill('helix-client@example.invalid');
  await client.locator('input[name="authority_attested"]').check();
  await Promise.all([
   client.waitForURL(u=>u.pathname==='/quote-payment'&&u.searchParams.has('token'),{timeout:30000}),
   client.getByRole('button',{name:'Confirm acceptance'}).click()
  ]);
  await client.getByRole('heading',{name:'Complete your payment'}).waitFor();
  const {data:decision,error:decisionError}=await admin.from('quote_issue_records')
   .select('client_response').eq('organisation_id',orgId).eq('quote_id',quotes[0].id).single();
  assert.equal(decisionError,null);
  assert.equal(decision.client_response,'accepted');
  const {data:attestation,error:attestationError}=await admin.from('quote_client_signatory_attestations')
   .select('signatory_email,authority_attested_at').eq('organisation_id',orgId)
   .eq('quote_id',quotes[0].id).eq('quote_revision',quotes[0].revision).single();
  assert.equal(attestationError,null);
  assert.equal(String(attestation.signatory_email).toLowerCase(),'helix-client@example.invalid');
  assert.ok(attestation.authority_attested_at);
  const {count:unpaidProject,error:unpaidProjectError}=await admin.from('projects')
   .select('*',{count:'exact',head:true}).eq('organisation_id',orgId).eq('quote_id',quotes[0].id);
  assert.equal(unpaidProjectError,null);
  assert.equal(unpaidProject,0,'Client acceptance alone cannot release Project 360 without verified opening payment');
  console.log('PASS browser: separate client signed quote acceptance and attested authority; opening payment still required.');
 }finally{await clientContext.close();}
 const projectId=await verifyHelixOpeningPayment(admin,orgId,quotes[0],caseId);
 await control.goto('/workspace/projects/'+projectId);
 await control.locator('#record-next-action').waitFor({timeout:30000});
 const {data:createdProject,error:createdProjectError}=await admin.from('projects')
  .select('project_stage,quote_id,lead_id').eq('organisation_id',orgId).eq('id',projectId).single();
 assert.equal(createdProjectError,null);
 assert.equal(createdProject.project_stage,'mobilisation','Real opening payment must not bypass mobilisation');
 assert.equal(createdProject.quote_id,quotes[0].id);
 assert.equal(createdProject.lead_id,caseId);
 console.log('PASS browser: new client-originated Helix Project 360 is visible to operator at governed mobilisation stage.');
 await onStage('mobilisation',projectId);
 await mobiliseHelixNewProject(control,admin,operatorDb,orgId,projectId,partnerId,onStage);

 return quotes[0];
}
