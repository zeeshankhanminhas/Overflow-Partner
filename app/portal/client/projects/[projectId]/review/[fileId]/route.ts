import {NextResponse} from 'next/server';
import {createClient as createAdminClient} from '@supabase/supabase-js';
import {PDFDocument,StandardFonts,degrees,rgb} from 'pdf-lib';
import {createClient} from '@/lib/supabase/server';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

export const dynamic='force-dynamic';
export const runtime='nodejs';
type VisibleFile={id:string;filename:string;size:number};
type Position={issueId:string;projectId:string;revision:string;stage:string;files:VisibleFile[]};
type CurrentFile={id:string;filename:string;bucket:string;path:string;size:number};
type Gate={submission_id:string|null;revision:string|null;manifest_hash:string|null;
 storage_complete:boolean;engineering_accepted:boolean;manifest_verified:boolean;release_authorised:boolean;
 files:CurrentFile[]};

function denied(status:number,message='The controlled engineering review is not available for this session.'){
 return new NextResponse(message,{status,headers:{'Cache-Control':'private, no-store, max-age=0',
 'X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff'}});
}

/**
 * A verified external client may view ONLY the issued current-cycle PDF.
 * This does not use the Operator profile, never exposes the original storage URL,
 * and never releases native files. Browser extraction cannot be fully prevented.
 */
export async function GET(_req:Request,{params}:{params:Promise<{projectId:string;fileId:string}>}){
 let phase='isolation';
 const blocked=(status:number,reason:string,message?:string)=>{
  // QA server diagnostics only: never log identity, secret, file path or content.
  console.warn('OPOS QA client PDF blocked',{phase,reason,status});
  return denied(status,message);
 };
 try{
  assertIsolatedQaBackend();
  const {projectId,fileId}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(projectId)||!/^[0-9a-f-]{36}$/i.test(fileId))return blocked(404,'invalid-file-request');
  phase='external-client-auth';
  const supabase=await createClient();
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user)return blocked(401,'client-session-missing','Sign in to your authorised Client Workspace to view the drawings.');
  // Read-only, SECURITY DEFINER RPC validates exact active client membership,
  // original company, issued current cycle, and delivered revision.
  phase='client-review-position';
  const {data,error:positionError}=await supabase.rpc('op_qa_client_review_position',{
    p_project_id:projectId});
  const position=data as Position|null;
  if(positionError||!position||position.projectId!==projectId||
     !['issued_to_client','client_review','completion','closed'].includes(position.stage)||
     !position.files?.some(file=>file.id===fileId))return blocked(403,'client-review-position-invalid');
  const envUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!envUrl||!serviceKey)return blocked(503,'qa-service-config-missing','Secure review service is not configured.');
  phase='current-cycle-qa-gate';
  const admin=createAdminClient(envUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const [issueResult,gateResult]=await Promise.all([
    admin.from('op_qa_client_review_issues')
      .select('id,organisation_id,project_id,submission_id,execution_cycle,revision,manifest_hash')
      .eq('id',position.issueId).eq('project_id',projectId).maybeSingle(),
    admin.rpc('op_qa_delivery_gate',{p_project_id:projectId}),
  ]);
  const issue=issueResult.data;
  const gate=gateResult.data as Gate|null;
  if(issueResult.error||gateResult.error||!issue||!gate||
     gate.submission_id!==issue.submission_id||gate.manifest_hash!==issue.manifest_hash||
     gate.revision!==issue.revision||!gate.storage_complete||
     !gate.engineering_accepted||!gate.manifest_verified||!gate.release_authorised)
    return blocked(403,'current-cycle-gate-not-authorised','The review is not the currently authorised engineering submission.');
  const file=(gate.files||[]).find(f=>f.id===fileId);
  if(!file||file.bucket!=='partner-delivery'||!file.filename.toLowerCase().endsWith('.pdf')||
    file.size<100||file.size>15*1024*1024)return blocked(404,'review-file-invalid');
  phase='private-file-download';
  const {data:blob,error:downloadError}=await admin.storage.from('partner-delivery').download(file.path);
  if(downloadError||!blob||blob.size>15*1024*1024)return blocked(404,'private-pdf-not-available');
  const raw=new Uint8Array(await blob.arrayBuffer());
  if(raw.length<100||new TextDecoder().decode(raw.subarray(0,5))!=='%PDF-')return blocked(415,'invalid-pdf-bytes','The engineering review file is not a supported PDF.');
  phase='watermark-pdf';
  const doc=await PDFDocument.load(raw,{updateMetadata:false});
  if(doc.isEncrypted||doc.getPageCount()>80)return blocked(415,'pdf-conversion-not-supported','This engineering PDF cannot yet be safely prepared for browser review.');
  const font=await doc.embedFont(StandardFonts.HelveticaBold);
  const ref='CLIENT REVIEW / '+String(issue.revision||'').slice(0,18)+' / '+projectId.slice(0,8);
  const identity=String(user.id).slice(0,8);
  for(const page of doc.getPages()){
   const {width,height}=page.getSize();
   for(let y=Math.max(80,height*.2);y<height*.88;y+=Math.max(155,height*.29)){
     page.drawText('OPOS CLIENT REVIEW - NOT FINAL HANDOVER',{
       x:Math.max(15,width*.055),y,
       font,color:rgb(.34,.22,.22),opacity:.25,rotate:degrees(22),
       size:Math.min(27,Math.max(14,width/19))
     });
   }
   page.drawText((ref+' / authorised account '+identity).slice(0,105),
     {x:18,y:15,font,size:Math.max(6,Math.min(9,width/65)),color:rgb(.22,.2,.2),opacity:.78});
  }
  doc.setTitle('OPOS controlled client review - not final delivery');
  phase='pdf-serialization';
  const output=Uint8Array.from(await doc.save({useObjectStreams:false}));
  const head=new TextDecoder().decode(output.subarray(0,5));
  const tail=new TextDecoder().decode(output.subarray(Math.max(0,output.length-2048)));
  if(head!=='%PDF-'||!tail.includes('%%EOF'))throw new Error('Invalid serialised PDF');
  return new NextResponse(new Blob([output],{type:'application/pdf'}),{status:200,headers:{
   'Content-Type':'application/pdf',
   'Content-Disposition':'inline; filename="OPOS-Controlled-Client-Review.pdf"',
   'Content-Length':String(output.length),
   'Cache-Control':'private, no-store, max-age=0',
   'Pragma':'no-cache','X-Content-Type-Options':'nosniff',
   'X-Robots-Tag':'noindex, nofollow, noarchive',
   'Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin'
  }});
 }catch(error){
  console.error('OPOS protected client review PDF failed',{
   phase,errorCategory:error instanceof Error?error.name:'Unknown'
  });
  return denied(500,'The protected review PDF could not be prepared. Please contact Overflow Partner.');
 }
}
