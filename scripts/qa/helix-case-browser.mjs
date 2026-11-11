// Governed Case 360 progression: only rendered operator server actions.
import assert from 'node:assert/strict';
import {approveHelixCaseEvidence} from './helix-document-browser.mjs';

export async function createHelixDraftQuoteThroughCase360(control,admin,orgId,caseId){
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
 if(await control.locator('#record-next-action').getByRole('button',{name:'Approve technical scope'}).count()){
  await act('Approve technical scope');
 }
 await approveHelixCaseEvidence(control,admin,orgId,caseId,'partner-technical-assessment-report');
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
 return quotes[0];
}
