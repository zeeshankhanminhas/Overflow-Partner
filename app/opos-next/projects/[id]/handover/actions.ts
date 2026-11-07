'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {createClient as createSupabaseClient} from '@supabase/supabase-js';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

const BUCKET='opos-qa-controlled-handover';
const validId=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function short(s:unknown,max=160){return String(s||'').replace(/[\x00-\x1f]+/g,' ').slice(0,max);}
function money(n:number){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n);}

async function trustedContext(projectId:string) {
  assertIsolatedQaBackend();
  if(!validId(projectId))throw new Error('Valid project required.');
  const {supabase,user,profile,organisationId}=await requireUserContext('/opos-next');
  assertRole(profile.role,['owner','admin']);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('QA storage unavailable.');
  const db=createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:project,error:pErr}=await db.from('projects').select('id,organisation_id,project_number,title,quote_id,project_stage')
    .eq('id',projectId).eq('organisation_id',organisationId).maybeSingle();
  if(pErr||!project||project.project_stage!=='completion')throw new Error('Completed Project 360 required.');
  const {data:document,error:dErr}=await db.from('documents')
    .select('id,status,reference,revision_code,storage_path,project_id,organisation_id,independent_review_required,signed_by')
    .eq('organisation_id',organisationId).eq('project_id',projectId).eq('document_type','handover-pack')
    .eq('is_current_revision',true).maybeSingle();
  if(dErr||!document)throw new Error('Current controlled Handover Pack record not found.');
  const {data:quote}=await db.from('quotes').select('id,quote_number,total,revision,currency')
    .eq('id',project.quote_id).eq('organisation_id',organisationId).eq('status','accepted').maybeSingle();
  if(!quote)throw new Error('Accepted quotation evidence missing.');
  const {data:review}=await db.from('project_client_reviews').select('outcome')
    .eq('organisation_id',organisationId).eq('project_id',projectId)
    .order('recorded_at',{ascending:false}).limit(1).maybeSingle();
  if(!['accepted','accepted_with_comments'].includes(String(review?.outcome)))throw new Error('Latest client review is not accepted.');
  const {data:paid}=await db.from('op_project_final_settlements').select('project_id,amount,verified_at')
    .eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
  if(!paid)throw new Error('Verified final client payment required.');
  const {data:assignments}=await db.from('project_execution_assignments').select('execution_cycle')
    .eq('organisation_id',organisationId).eq('project_id',projectId).order('execution_cycle',{ascending:false}).limit(1);
  const cycle=Number(assignments?.[0]?.execution_cycle||1);
  const {data:submission}=await db.from('partner_delivery_submissions')
    .select('id,revision,review_status,execution_cycle,delivery_summary,deliverables_manifest')
    .eq('organisation_id',organisationId).eq('project_id',projectId).eq('execution_cycle',cycle)
    .eq('review_status','accepted').order('submitted_at',{ascending:false}).limit(1).maybeSingle();
  if(!submission)throw new Error('Current accepted Partner R01 submission required.');
  const {data:files,error:fErr}=await db.from('partner_delivery_submission_files')
    .select('id,original_filename,storage_bucket,storage_path,size_bytes')
    .eq('organisation_id',organisationId).eq('project_id',projectId).eq('submission_id',submission.id);
  if(fErr||!files?.length||files.some(f=>!f.storage_path||!f.storage_bucket))throw new Error('Stored accepted engineering evidence is incomplete.');
  return {supabase,db,user,organisationId,project,document,quote,paid,submission,files};
}

async function createQaPackPdf(d:Awaited<ReturnType<typeof trustedContext>>):Promise<Uint8Array> {
 const pdf=await PDFDocument.create();
 pdf.setTitle('QA Controlled Handover Pack - '+d.project.project_number);
 const page=pdf.addPage([595,842]);
 const font=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.10,.13,.17),muted=rgb(.37,.40,.44);
 let y=785;
 const line=(label:string,value:string,height=18)=>{
   if(y<90)throw new Error('Too many files for one-page QA handover. Manual document review required.');
   page.drawText(short(label,48),{x:48,y,size:10,font:bold,color:ink});
   y-=height;
   for(const text of value.match(/.{1,85}(?:\s|$)/g)||[value]){
     if(y<90)throw new Error('Document exceeds controlled page.');
     page.drawText(short(text,105),{x:48,y,size:10,font,color:ink});y-=15;
   }
   y-=8;
 };
 page.drawText('OVERFLOW PARTNER  |  QA CONTROLLED HANDOVER',{x:48,y,size:14,font:bold,color:ink});y-=34;
 page.drawText('DRAFT FOR OWNER REVIEW - NOT AN AUTHORISED FILE RELEASE',{x:48,y,size:10,font:bold,color:rgb(.64,.17,.14)});y-=35;
 line('Project',d.project.project_number+' - '+d.project.title);
 line('Controlled document',d.document.reference+' / R01 / Pending controlled approval');
 line('Accepted commercial baseline',d.quote.quote_number+' / '+money(Number(d.quote.total)));
 line('Final client settlement','Verified QA sandbox payment: '+money(Number(d.paid.amount)));
 line('Accepted technical delivery',short(d.submission.revision)+' / submission '+d.submission.id);
 line('Delivery summary',short(d.submission.delivery_summary,300)||'See accepted partner submission');
 line('Evidence manifest',short(d.submission.deliverables_manifest,300)||'Refer to the controlled partner submission manifest');
 line('Included approved engineering evidence',d.files.map((f,i)=>(i+1)+'. '+short(f.original_filename,55)).join('; '));
 y-=10;
 page.drawText('CONTROL: This PDF is the handover index, not the original editable CAD deliverables.',{x:48,y,size:9,font,color:muted});y-=18;
 page.drawText('Native files remain protected until the separate authenticated owner approval.',{x:48,y,size:9,font,color:muted});
 page.drawText('OPOS QA ONLY | No legal, manufacturing or live payment representation',{x:48,y:45,size:8,font,color:muted});
 return pdf.save();
}

export async function prepareQaHandoverPack(formData:FormData) {
 const id=String(formData.get('project_id')||'');
 const base='/opos-next/projects/'+id+'/handover';
 let destination=base;
 try {
  const d=await trustedContext(id);
  if(d.document.status!=='draft'||d.document.storage_path)throw new Error('Handover Pack has already entered governed review.');
  const bytes=await createQaPackPdf(d);
  const path=d.organisationId+'/'+id+'/'+d.document.id+'/R01-'+crypto.randomUUID()+'.pdf';
  const bucketCheck=await d.db.storage.getBucket(BUCKET);
  if(bucketCheck.error)throw new Error('Private QA handover storage bucket is not available.');
  const upload=await d.db.storage.from(BUCKET).upload(path,bytes,{
    contentType:'application/pdf',cacheControl:'no-store',upsert:false
  });
  if(upload.error)throw new Error('Failed to store the QA handover draft.');
  const {data,error}=await d.supabase.from('documents').update({
    storage_path:BUCKET+':'+path,revision_code:'R01',prepared_by:d.user.id,
    issue_purpose:'final_handover',status:'in_review'
  }).eq('id',d.document.id).eq('organisation_id',d.organisationId)
    .eq('project_id',id).eq('status','draft').select('id').maybeSingle();
  if(error||!data)throw new Error('The controlled document did not advance to In Review. Stored file requires administrative cleanup.');
  destination+='?updated='+encodeURIComponent('R01 Handover Pack prepared for controlled review. No native file released.');
 } catch(e) { destination+='?error='+encodeURIComponent(e instanceof Error?e.message:'Handover preparation failed'); }
 revalidatePath(base);revalidatePath('/opos-next/projects/'+id+'/final-settlement');
 redirect(destination);
}

export async function advanceQaHandoverPack(formData:FormData) {
 const id=String(formData.get('project_id')||'');
 const step=String(formData.get('step')||'');
 const acknowledgement=String(formData.get('acknowledge')||'');
 const base='/opos-next/projects/'+id+'/handover';
 let destination=base;
 try {
  if(acknowledgement!=='reviewed')throw new Error('Explicit document review confirmation is required.');
  const d=await trustedContext(id);
  const next=step==='sign'?'signed':step==='approve'?'approved':step==='issue'?'issued':'';
  const current=step==='sign'?'in_review':step==='approve'?'signed':step==='issue'?'approved':'';
  if(!next||d.document.status!==current||!d.document.storage_path)throw new Error('Controlled document review sequence is incomplete.');
  const expectedPrefix=BUCKET+':'+d.organisationId+'/'+id+'/'+d.document.id+'/';
  if(!String(d.document.storage_path).startsWith(expectedPrefix))throw new Error('Document is not backed by verified QA private storage.');
  const fileKey=String(d.document.storage_path).slice(BUCKET.length+1);
  const {error:objectError}=await d.db.storage.from(BUCKET).download(fileKey);
  if(objectError)throw new Error('Controlled PDF evidence is no longer in private storage.');
  if(step==='approve'&&d.document.independent_review_required&&d.document.signed_by===d.user.id)
    throw new Error('Independent approver must differ from signer.');
  const patch=step==='sign'?{status:'signed',signed_by:d.user.id,signed_at:new Date().toISOString()}:
    step==='approve'?{status:'approved',approved_by:d.user.id,approved_at:new Date().toISOString()}:
    {status:'issued',issued_by:d.user.id,issued_at:new Date().toISOString()};
  const {data,error}=await d.supabase.from('documents').update(patch)
    .eq('id',d.document.id).eq('organisation_id',d.organisationId)
    .eq('project_id',id).eq('status',current).select('id').maybeSingle();
  if(error||!data)throw new Error('Governed '+step+' transition failed: '+String(error?.message||'No matching document status.'));
  destination+='?updated='+encodeURIComponent('Controlled Handover Pack moved to '+next+'.');
 }catch(e){destination+='?error='+encodeURIComponent(e instanceof Error?e.message:'Document review failed');}
 revalidatePath(base);revalidatePath('/opos-next/projects/'+id+'/final-settlement');revalidatePath('/opos-next/projects/'+id);
 redirect(destination);
}
