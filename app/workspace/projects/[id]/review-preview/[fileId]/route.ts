import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {PDFDocument,StandardFonts,degrees,rgb} from 'pdf-lib';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

export const dynamic='force-dynamic';
export const runtime='nodejs';
type GateFile={id:string;filename:string;bucket:string;path:string;size:number};
type Gate={project_stage:string;revision:string|null;submission_id:string|null;
 files:GateFile[];file_count:number;storage_complete:boolean;engineering_accepted:boolean;
 manifest_verified:boolean;release_authorised:boolean};

const denied=(status:number)=>new NextResponse('This preview is not available for your account or the current engineering revision.',{
 status,headers:{'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}
});

/**
 * Internal OP QA preparation preview ONLY. No external token, no signed URL,
 * no client-facing route, no DB mutation. The watermark is embedded in bytes
 * sent only after staff/organisation/current-cycle release checks.
 */
export async function GET(_request:Request,{params}:{params:Promise<{id:string;fileId:string}>}){
 let phase='qa-isolation';
 try{
  assertIsolatedQaBackend();
  const {id,fileId}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(fileId))return denied(404);
  phase='internal-operator-auth';
  const {supabase,organisationId,profile,user}=await requireUserContext();
  assertRole(profile.role,['owner','admin','operator','engineering']);
  const {data:project,error:projectError}=await supabase.from('projects')
    .select('id,project_number,project_stage').eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(projectError||!project||project.project_stage!=='ready_for_client_issue')return denied(404);
  phase='current-submission-gate';
  const {data,error}=await supabase.rpc('op_qa_delivery_gate',{p_project_id:id});
  const gate=data as Gate|null;
  if(error||!gate||gate.project_stage!=='ready_for_client_issue'||!gate.submission_id||
     !gate.storage_complete||!gate.engineering_accepted||!gate.manifest_verified||!gate.release_authorised)return denied(403);
  const item=(gate.files||[]).find(file=>file.id===fileId);
  if(!item||item.bucket!=='partner-delivery'||!item.filename.toLowerCase().endsWith('.pdf')||
     Number(item.size)>15*1024*1024||Number(item.size)<100)return denied(404);

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return denied(503);
  // A service connection is used only after authenticated organisational and
  // authoritative current-manifest checks; its credentials never leave server.
  phase='private-storage-download';
  const storage=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:blob,error:downloadError}=await storage.storage.from(item.bucket).download(item.path);
  if(downloadError||!blob||blob.size>15*1024*1024)return denied(404);
  const raw=new Uint8Array(await blob.arrayBuffer());
  if(raw.length<8||new TextDecoder().decode(raw.subarray(0,5))!=='%PDF-')return denied(415);
  phase='pdf-parse';
  const doc=await PDFDocument.load(raw,{updateMetadata:false});
  if(doc.isEncrypted)return denied(415);
  if(doc.getPageCount()>80)return denied(413);
  phase='pdf-watermark';
  const watermarkFont=await doc.embedFont(StandardFonts.HelveticaBold);
  const now=new Date().toISOString().replace('T',' ').slice(0,16)+' UTC';
  const ref=String(project.project_number||'QA PROJECT').replace(/[^a-zA-Z0-9-]/g,'').slice(0,48);
  const actor=String(user.id||'').slice(0,8);
  for(const page of doc.getPages()){
   const {width,height}=page.getSize();
   // Embedded markings survive ordinary PDF saving or screen capture.
   const text='OPOS QA REVIEW ONLY - NOT ISSUED';
   for(let y=height*.20;y<height*.9;y+=Math.max(160,height*.27)){
    page.drawText(text,{x:Math.max(12,width*.07),y,size:Math.max(16,Math.min(30,width/18)),
     font:watermarkFont,color:rgb(.32,.22,.22),opacity:.25,rotate:degrees(22)});
   }
   page.drawText((ref+' / '+String(gate.revision||'unlabelled')+' / QA '+actor+' / '+now).slice(0,115),
    {x:18,y:15,size:Math.min(9,Math.max(6,width/70)),font:watermarkFont,color:rgb(.24,.20,.20),opacity:.80});
  }
  doc.setTitle(ref+' - internal QA review preparation (not issued)');
  phase='pdf-serialisation';
  // Avoid compressed object streams for compatibility with the Edge/Chromium PDF viewer.
  const output=await doc.save({useObjectStreams:false});
  const payload=Uint8Array.from(output);
  const beginning=new TextDecoder().decode(payload.subarray(0,5));
  const ending=new TextDecoder().decode(payload.subarray(Math.max(0,payload.length-2048)));
  if(beginning!=='%PDF-'||!ending.includes('%%EOF'))throw new Error('Watermarked PDF serialization validation failed');
  return new NextResponse(new Blob([payload],{type:'application/pdf'}),{status:200,headers:{
   'Content-Type':'application/pdf','Content-Disposition':'inline; filename="OPOS-QA-Review-Preview.pdf"',
   'Content-Length':String(payload.length),
   'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff',
   'X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer',
   'Cross-Origin-Resource-Policy':'same-origin'
  }});
 }catch(error){
  // Logs contain only a controlled stage and error category; never tokens, paths or PDF contents.
  console.error('OPOS QA watermarked preview failed',{
    phase,kind:error instanceof Error?error.name:'UnknownFailure',
  });
  return denied(500);
 }
}
