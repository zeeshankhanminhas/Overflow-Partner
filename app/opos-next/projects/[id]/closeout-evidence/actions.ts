'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {getCloseoutEvidence,CLOSEOUT_BUCKET,CLOSEOUT_BASE,DEPOSIT_INVOICE,INVOICE_DOC,QUOTE_ID} from '@/lib/qa/northfieldCloseoutEvidence';
import {PROJECT,ORG} from '@/lib/qa/northfieldPartnerSettlement';

const idOk=(value:string)=>/^[0-9a-f-]{36}$/i.test(value);
const clean=(value:unknown,max=120)=>String(value||'').normalize('NFKD')
 .replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'")
 .replace(/[\u00a3]/g,'GBP ').replace(/[^\x20-\x7e]/g,'?').slice(0,max);

async function makePdf(kind:'invoice'|'completion-report',e:Awaited<ReturnType<typeof getCloseoutEvidence>>,reference:string){
 const pdf=await PDFDocument.create();
 pdf.setTitle('Northfield QA controlled '+kind+' R01');
 const font=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const page=pdf.addPage([595,842]);
 const ink=rgb(.1,.13,.16);
 let y=784;
 const line=(s:string,size=10,b=false)=>{
  if(y<85)throw new Error('Controlled QA evidence exceeds one PDF page');
  page.drawText(clean(s,110),{x:44,y,size,font:b?bold:font,color:ink});y-=size+11;
 };
 line('OVERFLOW PARTNER  |  NORTHFIELD QA',14,true);
 line('CONTROLLED EVIDENCE R01 - FOR OWNER REVIEW ONLY',10,true);y-=14;
 line('Document: '+reference,11,true);
 line('Project: OP-PRJ-2026-0002');
 line('Accepted quotation: OP-Q-2026-0001-R01 | GBP 2,149.25');
 line('Protected Handover Pack: OP-DOC-2026-0006 / R01 / ISSUED');
 line('Approved exact engineering revision: '+e.submission.id.slice(0,8)+' / R01');
 line('Client acceptance: recorded | final owner release: approved');y-=10;
 if(kind==='invoice'){
  line('PAID CUSTOMER BILLING RECONCILIATION - QA ONLY',12,true);
  line('Historical opening deposit record: '+DEPOSIT_INVOICE);
  line('Opening Stripe TEST receipt: GBP 644.78 on 2 November 2026');
  line('Opening invoice recorded from previously verified payment; no new charge.');
  line('Existing final invoice: '+e.final.invoice_number);
  line('Final Stripe TEST payment: GBP 1,504.47 on 7 November 2026');
  line('Total paid TEST consideration: GBP 2,149.25');
  line('Total remaining on accepted quotation: GBP 0.00');
  line('This is controlled internal QA billing EVIDENCE, NOT a new tax invoice.');
  line('Existing invoice records remain authoritative and independently auditable.');
 }else{
  line('COMPLETION REPORT - NORTHFIELD QA DEMONSTRATION',12,true);
  line('Work Order: OP-PRJ-2026-0002/WO-01');
  line('Selected Execution Partner cost: GBP 1,200.00');
  line('Accepted engineering evidence: '+e.submission.id);
  line('Drawing submission reviewed and accepted in the recorded R01 cycle.');
  line('Client accepted project delivery and final controlled handover was issued.');
  line('The Client Portal final-file download has been exercised in QA.');
  line('Partner transfer: QA-SIM-NORTHFIELD-WO01 / GBP 1,200.00');
  line('IMPORTANT: Synthetic partner payment only. NO BANK TRANSFER took place.');
  line('QA demo drawings are not certified manufacturing-ready CAD.');
  line('Project closure remains a separate governed owner decision.');
 }
 y-=10;line('OPOS isolated QA / not client billing or real-world payment evidence.',9,true);
 return pdf.save();
}

function finish(message:string,error=false):never{
 revalidatePath(CLOSEOUT_BASE);
 revalidatePath('/opos-next/projects/'+PROJECT);
 revalidatePath('/opos-next/projects/'+PROJECT+'/partner-settlement');
 revalidatePath('/opos-next/finance');
 redirect(CLOSEOUT_BASE+'?'+(error?'error':'updated')+'='+encodeURIComponent(message));
}

export async function reconcileNorthfieldOpeningInvoice(fd:FormData){
 let success='';
 try{
  if(String(fd.get('project_id'))!==PROJECT||String(fd.get('acknowledge'))!=='verified')
   throw new Error('Explicit Northfield reconciliation confirmation required.');
  const e=await getCloseoutEvidence(PROJECT);
  if(e.deposit)throw new Error('The existing deposit invoice must be reviewed; do not create another.');
  if(e.project.project_stage!=='completion')throw new Error('Project must remain in completion.');
  const {data:project,error:projectError}=await e.supabase.from('projects').select('lead_id,quote_id')
    .eq('id',PROJECT).eq('organisation_id',ORG).maybeSingle();
  if(projectError||project?.quote_id!==QUOTE_ID)throw new Error('Accepted quote project linkage missing.');
  const {error}=await e.supabase.from('invoices').insert({
   organisation_id:ORG,project_id:PROJECT,lead_id:project.lead_id,quote_id:QUOTE_ID,
   invoice_number:DEPOSIT_INVOICE,invoice_type:'deposit',status:'paid',
   description:'QA HISTORICAL DEPOSIT RECONCILIATION ONLY. Existing verified Stripe TEST receipt; no new charge or customer send.',
   subtotal:537.32,vat_rate:20,vat:107.46,total:644.78,amount_paid:644.78,currency:'GBP',
   external_reference:e.receipt.payment_reference,paid_at:e.receipt.confirmed_at,
   issued_at:new Date().toISOString(),created_by:e.user.id
  });
  if(error)throw new Error('Historical deposit reconciliation rejected: '+error.message);
  success='Opening TEST payment reconciled to the project invoice ledger. No additional payment was created.';
 }catch(err){finish(err instanceof Error?err.message:'Deposit invoice reconciliation failed',true);}
 finish(success);
}

export async function prepareNorthfieldCloseoutDocument(fd:FormData){
 let success='';
 try{
  const id=String(fd.get('project_id')||'');
  const kind=String(fd.get('kind')||'') as 'invoice'|'completion-report';
  if(id!==PROJECT||!['invoice','completion-report'].includes(kind))throw new Error('Invalid Northfield closeout evidence request.');
  const e=await getCloseoutEvidence(id);
  if(!e.billingReady)throw new Error('The historical deposit and final invoice must be fully reconciled first.');
  if(e.project.project_stage!=='completion')throw new Error('Project is not in completion.');
  if(kind==='invoice'&&e.invoiceDoc?.status!=='draft'&&e.invoiceDoc)
   throw new Error('Existing controlled Invoice evidence cannot be replaced.');
  if(kind==='completion-report'&&e.completionDoc?.status!=='draft')
   throw new Error('Existing Completion Report must remain a draft before preparation.');
  let doc=kind==='invoice'?e.invoiceDoc:e.completionDoc;
  if(!doc){
   if(kind!=='invoice')throw new Error('Existing Completion Report record missing.');
   const {data,error}=await e.supabase.from('documents').insert({
    organisation_id:ORG,project_id:PROJECT,quote_id:QUOTE_ID,
    created_by:e.user.id,document_type:'invoice',reference:INVOICE_DOC,
    title:'QA controlled paid Invoice reconciliation evidence',status:'draft',version:1,
    revision_code:'P01'
   }).select('id,reference,status,storage_path').single();
   if(error||!data)throw new Error('Controlled Invoice evidence record could not be created: '+(error?.message||''));
   doc=data;
  }
  if(!doc||!idOk(doc.id)||doc.status!=='draft'||doc.storage_path)
   throw new Error('An unprepared Draft document is required.');
  const prefix=ORG+'/'+PROJECT+'/'+doc.id+'/';
  const {data:objects,error:listError}=await e.db.storage.from(CLOSEOUT_BUCKET).list(prefix,{limit:20});
  if(listError)throw new Error('Private closeout storage unavailable: '+listError.message);
  const matches=(objects||[]).filter(x=>/^R01-[0-9a-f-]{36}\.pdf$/i.test(x.name));
  if(matches.length>1)throw new Error('Multiple closeout evidence PDFs require manual reconciliation.');
  const path=prefix+(matches[0]?.name||'R01-'+crypto.randomUUID()+'.pdf');
  let uploaded=false;
  if(matches.length){
   const {data,error}=await e.db.storage.from(CLOSEOUT_BUCKET).download(path);
   if(error||!data)throw new Error('Existing controlled QA PDF is not retrievable.');
   const check=await PDFDocument.load(await data.arrayBuffer());
   if(check.getTitle()!=='Northfield QA controlled '+kind+' R01')
    throw new Error('Existing closeout PDF is not a matching QA document.');
  }else{
   const bytes=await makePdf(kind,e,doc.reference);
   const {error}=await e.db.storage.from(CLOSEOUT_BUCKET).upload(path,bytes,{
     contentType:'application/pdf',cacheControl:'no-store',upsert:false
   });
   if(error)throw new Error('QA closeout evidence upload failed: '+error.message);
   uploaded=true;
  }
  const {data,error}=await e.supabase.from('documents').update({
    storage_path:CLOSEOUT_BUCKET+':'+path,revision_code:'R01',prepared_by:e.user.id,
    issue_purpose:kind==='invoice'?'qa_paid_invoice_reconciliation':'qa_completion_report',
    status:'in_review'
  }).eq('id',doc.id).eq('organisation_id',ORG).eq('project_id',PROJECT).eq('status','draft')
    .select('id').maybeSingle();
  if(error||!data){
   if(uploaded)await e.db.storage.from(CLOSEOUT_BUCKET).remove([path]);
   throw new Error('Controlled document transition failed: '+(error?.message||'no matching Draft document'));
  }
  success=(kind==='invoice'?'Invoice reconciliation evidence':'Completion Report')+' prepared for explicit review. No client message sent.';
 }catch(err){finish(err instanceof Error?err.message:'Closeout PDF preparation failed',true);}
 finish(success);
}

export async function advanceNorthfieldCloseoutDocument(fd:FormData){
 let success='';
 try{
  if(String(fd.get('project_id'))!==PROJECT||String(fd.get('acknowledge'))!=='reviewed')
   throw new Error('You must confirm review of the controlled PDF and source evidence.');
  const kind=String(fd.get('kind'));
  const step=String(fd.get('step'));
  if(!['invoice','completion-report'].includes(kind)||!['sign','approve','issue'].includes(step))
   throw new Error('Invalid document-control action.');
  const e=await getCloseoutEvidence(PROJECT);
  if(!e.billingReady)throw new Error('Billing reconciliation is incomplete.');
  const doc=kind==='invoice'?e.invoiceDoc:e.completionDoc;
  if(!doc?.storage_path)throw new Error('Private controlled PDF must exist before review.');
  const current=step==='sign'?'in_review':step==='approve'?'signed':'approved';
  const next=step==='sign'?'signed':step==='approve'?'approved':'issued';
  if(doc.status!==current)throw new Error('Document status changed. Reload before deciding.');
  const scope=CLOSEOUT_BUCKET+':'+ORG+'/'+PROJECT+'/'+doc.id+'/';
  if(!doc.storage_path.startsWith(scope))throw new Error('Untrusted document storage location.');
  const {error:storedError}=await e.db.storage.from(CLOSEOUT_BUCKET).download(doc.storage_path.slice(CLOSEOUT_BUCKET.length+1));
  if(storedError)throw new Error('Controlled evidence PDF is missing from private storage.');
  if(step==='approve'&&doc.independent_review_required&&doc.signed_by===e.user.id)
   throw new Error('Independent approver must differ from signer.');
  const update=step==='sign'?{status:next,signed_by:e.user.id,signed_at:new Date().toISOString()}:
   step==='approve'?{status:next,approved_by:e.user.id,approved_at:new Date().toISOString()}:
    {status:next,issued_by:e.user.id,issued_at:new Date().toISOString()};
  const {data,error}=await e.supabase.from('documents').update(update)
   .eq('id',doc.id).eq('organisation_id',ORG).eq('project_id',PROJECT).eq('status',current)
   .select('id').maybeSingle();
  if(error||!data)throw new Error('Governed '+step+' rejected: '+(error?.message||'status changed'));
  success=kind+' R01 moved to '+next+'. Project closure remains a separate decision.';
 }catch(err){finish(err instanceof Error?err.message:'Controlled document transition failed',true);}
 finish(success);
}
