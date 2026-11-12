import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {approveHelixProjectEvidence} from '../../scripts/qa/helix-document-browser.mjs';

export async function finishJourney({control,db,orgId,project,step,expect}){
 const path='/workspace/projects/'+project.id;
 const stage=async target=>{
  await control.goto(path);
  const form=control.locator('form:has(input[name="target_stage"][value="'+target+'"])');
  await expect(form).toHaveCount(1);
  await Promise.all([control.waitForURL(u=>u.searchParams.has('advanced')||u.searchParams.has('error')),form.getByRole('button').first().click()]);
  assert.equal(new URL(control.url()).searchParams.get('error'),null);
  const {data,error}=await db.from('projects').select('project_stage').eq('id',project.id).eq('organisation_id',orgId).single();assert.equal(error,null);assert.equal(data.project_stage,target);
 };
 const document=async(slug,issue=false)=>{
  const id=await approveHelixProjectEvidence(control,db,orgId,project.id,slug);
  if(issue){await control.goto('/workspace/documents/templates/'+slug+'?project='+project.id+'&document_record='+id);await control.getByRole('button',{name:'Issue',exact:true}).click();await expect.poll(async()=>{const {data,error}=await db.from('documents').select('status').eq('id',id).single();assert.equal(error,null);return data.status;}).toMatch(/issued|published/);}
 };
 await step('Gate 6: issued to client through controlled transmittal',async()=>{
  assert.equal(project.project_stage,'ready_for_client_issue');
  await document('handover-pack',true);
  await control.goto(path);
  const send=control.getByRole('button',{name:'Send delivery to client',exact:true});await expect(send).toBeEnabled();
  await Promise.all([control.waitForURL(u=>u.searchParams.has('advanced')||u.searchParams.has('error')),send.click()]);
  assert.equal(new URL(control.url()).searchParams.get('error'),null);
 });
 await step('Gate 7: separate customer attests current-cycle review',async()=>{
  await stage('client_review');
  const {data:notice,error}=await db.from('notification_outbox').select('payload').eq('organisation_id',orgId).eq('entity_id',project.id).eq('event_key','client_delivery.issued').single();assert.equal(error,null);
  const url=notice.payload?.actionUrl;assert.ok(url?.startsWith('http://127.0.0.1:3211/client-portal?'));
  const ctx=await control.context().browser().newContext({serviceWorkers:'block'});
  try{const client=await ctx.newPage();await client.goto(url);await expect(client.getByText(/Download approved final engineering files/)).toHaveCount(0);await client.locator('input[name="authority_attested"]').check();await client.getByRole('button',{name:'Submit project review'}).click();
   await expect.poll(async()=>{const {data,error}=await db.from('project_client_reviews').select('client_submitted_by_email,client_authority_attested_at').eq('project_id',project.id).eq('organisation_id',orgId);assert.equal(error,null);return data?.filter(x=>x.client_submitted_by_email==='helix-client@example.invalid'&&x.client_authority_attested_at).length;}).toBe(1);
  }finally{await ctx.close();}
 });
 await step('Gate 8: completion and governed final release',async()=>{
  await stage('completion');
  await document('completion-report',true);
  await control.goto(path);
  await expect(control.getByRole('button',{name:'Approve final engineering file release'})).toBeDisabled();
  const {data:quote,error:qe}=await db.from('quotes').select('id,revision,total,currency').eq('id',project.quote_id).eq('organisation_id',orgId).single();assert.equal(qe,null);
  const {data:terms,error:te}=await db.from('quote_release_contracts').select('opening_amount').eq('quote_id',quote.id).eq('organisation_id',orgId).single();assert.equal(te,null);
  const eventId='evt_browser_final_'+project.id;
  const body=JSON.stringify({id:eventId,livemode:false,type:'checkout.session.completed',data:{object:{object:'checkout.session',id:'cs_'+eventId,livemode:false,mode:'payment',payment_status:'paid',currency:quote.currency.toLowerCase(),amount_total:Math.round((Number(quote.total)-Number(terms.opening_amount))*100),payment_intent:'pi_'+eventId,metadata:{quote_id:quote.id,organisation_id:orgId,quote_revision:String(quote.revision),project_id:project.id,payment_stage:'final'}}}});
  const timestamp=Math.floor(Date.now()/1000),signature=createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(timestamp+'.'+body).digest('hex');
  const response=await fetch('http://127.0.0.1:3211/api/stripe/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':'t='+timestamp+',v1='+signature},body});
  assert.equal(response.status,200,'Synthetic final webhook rejected: '+await response.text());
  // Build the invoice through commercial UI, then record the synthetic
  // provider receipt in the ledger. This is bookkeeping, never a second charge.
  await control.goto('/workspace/commercial-control?project='+project.id);
  await control.getByRole('button',{name:'Create invoice',exact:true}).click();
  const invoice=control.locator('form:has(select[name="invoice_type"])');
  await invoice.locator('select[name="invoice_type"]').selectOption('final');await invoice.locator('input[name="subtotal"]').fill(String(quote.total));await invoice.locator('input[name="vat_rate"]').fill('0');await invoice.locator('input[name="due_date"]').fill(new Date().toISOString().slice(0,10));
  await Promise.all([control.waitForURL(u=>u.searchParams.has('created')||u.searchParams.has('error')),invoice.getByRole('button',{name:'Create invoice',exact:true}).click()]);assert.equal(new URL(control.url()).searchParams.get('error'),null);
  await control.getByRole('button',{name:'Issue',exact:true}).click();
  await Promise.all([control.waitForURL(u=>u.searchParams.has('updated')||u.searchParams.has('error')),control.getByRole('button',{name:'Confirm issue',exact:true}).click()]);assert.equal(new URL(control.url()).searchParams.get('error'),null);
  await document('invoice',true);
  await control.goto('/workspace/payments?project='+project.id);
  await control.getByRole('button',{name:'Record payment',exact:true}).click();
  const receipt=control.locator('form:has(input[name="invoice_id"])');await receipt.locator('input[name="reference"]').fill('SIMULATED-PROVIDER-RECEIPTS-'+project.id);
  await Promise.all([control.waitForURL(u=>u.searchParams.has('updated')||u.searchParams.has('error')),receipt.getByRole('button',{name:'Confirm client payment'}).click()]);assert.equal(new URL(control.url()).searchParams.get('error'),null);
  await control.goto(path);const release=control.getByRole('button',{name:'Approve final engineering file release'});await expect(release).toBeEnabled();
  await Promise.all([control.waitForURL(u=>u.searchParams.has('updated')||u.searchParams.has('error')),release.click()]);assert.equal(new URL(control.url()).searchParams.get('error'),null);
  const {data:notice,error:ne}=await db.from('notification_outbox').select('payload').eq('organisation_id',orgId).eq('entity_id',project.id).eq('event_key','client_delivery.final_released').single();assert.equal(ne,null);
  const ctx=await control.context().browser().newContext({serviceWorkers:'block',acceptDownloads:true});
  try{const client=await ctx.newPage();await client.goto(notice.payload.actionUrl);const file=client.getByRole('link',{name:/helix-qa-pump-assembly-evidence/});await expect(file).toHaveCount(1);await file.click();await expect(client.locator('body')).toContainText('Disposable QA engineering package');}finally{await ctx.close();}
 });
 await step('Gate 9: simulated Partner settlement and governed closure',async()=>{
  // This exercises bookkeeping only. SIMULATED reference is never bank evidence.
  await control.goto('/workspace/commercial-control?project='+project.id);
  await control.getByRole('button',{name:'Record Partner invoice',exact:true}).click();
  const form=control.locator('form:has(input[name="invoice_reference"])');
  const {data:assignment,error}=await db.from('project_execution_assignments').select('partner_id').eq('project_id',project.id).eq('organisation_id',orgId).single();assert.equal(error,null);
  await form.locator('select[name="partner_id"]').selectOption(assignment.partner_id);
  await form.locator('input[name="invoice_reference"]').fill('SIMULATED-QA-PARTNER-INVOICE');await form.locator('input[name="subtotal"]').fill('1600');await form.locator('input[name="evidence_confirmed"]').check();
  await Promise.all([control.waitForURL(u=>u.searchParams.has('created')||u.searchParams.has('error')),form.getByRole('button',{name:'Record Partner payable'}).click()]);assert.equal(new URL(control.url()).searchParams.get('error'),null);
  await control.getByRole('button',{name:'Approve',exact:true}).click();
  await Promise.all([control.waitForURL(u=>u.searchParams.has('updated')||u.searchParams.has('error')),control.getByRole('button',{name:'Confirm approval',exact:true}).click()]);assert.equal(new URL(control.url()).searchParams.get('error'),null);
  await control.goto('/workspace/payments?project='+project.id);
  await control.getByRole('button',{name:'Record payment',exact:true}).last().click();
  const pay=control.locator('form:has(input[name="payable_id"])');await pay.locator('input[name="reference"]').fill('SIMULATED-QA-NO-BANK-TRANSFER');
  await Promise.all([control.waitForURL(u=>u.searchParams.has('updated')||u.searchParams.has('error')),pay.getByRole('button',{name:'Confirm Partner payment'}).click()]);assert.equal(new URL(control.url()).searchParams.get('error'),null);
  await stage('closed');
 });
}
