// Governed document creation, technical signature and independent approval.
import assert from 'node:assert/strict';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function awaitDocumentState(admin,orgId,documentId,state,control){
 for(let n=0;n<20;n++){
  const {data,error}=await admin.from('documents').select('status,approved_by,signed_by')
   .eq('organisation_id',orgId).eq('id',documentId).single();
  if(error)throw error;
  if(data?.status===state)return data;
  await pause(350);
 }
 throw Error('Expected document '+documentId+' to reach '+state+
  '; current URL '+control.url()+'; feedback '+(await control.locator('#document-review-feedback').allInnerTexts()).join(' | '));
}
async function prepareIndependentReviewer(admin,orgId,control){
 const email='helix-independent-'+Math.random().toString(36).slice(2)+'@example.invalid';
 const password='qa-Independent-review-2026!'+Math.random().toString(36).slice(2);
 const {data:user,error:userError}=await admin.auth.admin.createUser({email,password,email_confirm:true});
 assert.equal(userError,null);
 const {error:profileError}=await admin.from('profiles').upsert({
  id:user.user.id,organisation_id:orgId,role:'admin',full_name:'Helix Independent QA Approver',is_active:true
 },{onConflict:'id'});
 assert.equal(profileError,null);
 const ctx=await control.context().browser().newContext({baseURL:'http://127.0.0.1:3211',serviceWorkers:'block'});
 const reviewer=await ctx.newPage();
 reviewer.setDefaultTimeout(25000);
 await reviewer.goto('/login');
 await reviewer.getByLabel('Email',{exact:true}).fill(email);
 await reviewer.getByLabel('Password',{exact:true}).fill(password);
 await Promise.all([
  reviewer.waitForURL(u=>u.pathname==='/workspace',{timeout:30000}),
  reviewer.getByRole('button',{name:'Enter Workspace'}).click()
 ]);
 return {ctx,reviewer,id:user.user.id};
}
export async function approveHelixCaseEvidence(control,admin,orgId,caseId,slug){
 return approveHelixDocument(control,admin,orgId,caseId,slug,'case');
}
export async function approveHelixProjectEvidence(control,admin,orgId,projectId,slug){
 return approveHelixDocument(control,admin,orgId,projectId,slug,'project');
}
async function approveHelixDocument(control,admin,orgId,recordId,slug,kind){
 const scope=kind==='case'?'lead_id':'project_id';
 const query=kind+'='+recordId;
 const owner=(kind==='case'?'/workspace/leads/':'/workspace/projects/')+recordId;
 const {data:found,error:findError}=await admin.from('documents')
  .select('id,status,independent_review_required').eq('organisation_id',orgId)
  .eq(scope,recordId).eq('document_type',slug)
  .eq('is_current_revision',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
 assert.equal(findError,null);
 let documentId=found?.id;
 await control.goto(owner);
 await control.getByRole('heading',{name:'Required documents'}).waitFor({timeout:25000});
 if(!documentId){
  const generator=control.locator('form:has(input[name="document_slug"][value="'+slug+'"])');
  assert.equal(await generator.count(),1,'Governed document generator missing for '+slug);
  await Promise.all([
   control.waitForURL(u=>u.pathname==='/workspace/documents/templates/'+slug &&
     u.searchParams.has('document_record'),{timeout:30000}),
   generator.getByRole('button',{name:'Create document'}).click()
  ]);
  documentId=new URL(control.url()).searchParams.get('document_record');
 }else{
  await control.goto('/workspace/documents/templates/'+slug+'?'+query+'&document_record='+documentId);
 }
 assert.ok(documentId);
 const {data:doc,error:docError}=await admin.from('documents').select('status,independent_review_required')
  .eq('organisation_id',orgId).eq('id',documentId).single();
 assert.equal(docError,null);
 await control.locator('#document-review-status').waitFor({timeout:25000});
 if(doc.status==='draft'){
  await control.getByRole('button',{name:'Submit for Review'}).click();
  await awaitDocumentState(admin,orgId,documentId,'in_review',control);
 }
 const {data:review}=await admin.from('documents').select('status').eq('id',documentId).single();
 if(review.status==='in_review'){
  await control.getByRole('button',{name:'E-Sign'}).click();
  await control.locator('#document-signer-name').fill('Helix QA Technical Signatory');
  await control.locator('#document-signer-role').fill('Mechanical Technical Reviewer');
  await control.locator('#document-signature-declaration input[type="checkbox"]').check();
  await control.getByRole('button',{name:'Apply e-signature'}).click();
  await awaitDocumentState(admin,orgId,documentId,'signed',control);
 }
 const {data:signed}=await admin.from('documents').select('status,independent_review_required,signed_by').eq('id',documentId).single();
 if(signed.status==='signed'){
  if(signed.independent_review_required){
   const {ctx,reviewer,id}=await prepareIndependentReviewer(admin,orgId,control);
   try{
    await reviewer.goto('/workspace/documents/templates/'+slug+'?'+query+'&document_record='+documentId);
    await reviewer.getByRole('button',{name:'Approve',exact:true}).click();
    const result=await awaitDocumentState(admin,orgId,documentId,'approved',reviewer);
    assert.equal(result.approved_by,id,'Independent reviewer must approve, not the technical signer');
    assert.notEqual(result.approved_by,result.signed_by);
   }finally{await ctx.close();}
  }else{
   await control.getByRole('button',{name:'Approve',exact:true}).click();
   await awaitDocumentState(admin,orgId,documentId,'approved',control);
  }
 }
 const {data:approved,error:approvedError}=await admin.from('documents')
  .select('status,approved_by,signed_by').eq('organisation_id',orgId).eq('id',documentId).single();
 assert.equal(approvedError,null);
 assert.equal(approved.status,'approved');
 assert.ok(approved.approved_by);
 assert.ok(approved.signed_by);
 console.log('PASS browser: controlled '+slug+' created, signed and approved through real workspace actions.');
 await control.goto(owner);
 await control.locator('#record-next-action').waitFor({timeout:25000});
 return documentId;
}
