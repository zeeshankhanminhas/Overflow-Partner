import { createHash, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executionSessionIdFromToken } from '@/lib/execution/sessionToken';

const BUCKET='partner-delivery';
const MAX_FILE_BYTES=25*1024*1024;
const MAX_FILES_PER_CYCLE=20;
const ALLOWED_EXTENSIONS=new Set([
  'pdf','png','jpg','jpeg','zip','docx','xlsx','xls','csv','txt',
  'step','stp','iges','igs','x_t','x_b','sldprt','sldasm','ipt','iam',
  'dwg','dxf','stl','obj','3mf','nc','ncc','cnc','tap','gcode','prt'
]);

function admin(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error('Supabase server credentials are not configured.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
function extension(name:string){const part=name.split('.').pop()?.toLowerCase()||'';return part===name.toLowerCase()?'':part;}
function safeFilename(name:string){const cleaned=name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^[-.]+|[-.]+$/g,'').slice(0,140);return cleaned||'engineering-output';}
function descriptorError(filename:string,size:number){if(!filename)return 'File name is required.';if(!Number.isFinite(size)||size<=0)return 'The selected file is empty.';if(size>MAX_FILE_BYTES)return 'Each engineering output file must be 25 MB or smaller.';const ext=extension(filename);if(!ext||!ALLOWED_EXTENSIONS.has(ext))return `.${ext||'unknown'} files are not accepted for Partner delivery.`;return '';}

async function contextForToken(token:string){
  const supabase=admin();
  const signedSessionId=executionSessionIdFromToken(token);
  const sessionQuery=supabase.from('partner_execution_sessions').select('*');
  const {data:session,error}=signedSessionId
    ? await sessionQuery.eq('id',signedSessionId).maybeSingle()
    : await sessionQuery.eq('token_hash',hashToken(token)).maybeSingle();
  if(error||!session)return{supabase,session:null,assignment:null,project:null};
  if(new Date(session.expires_at).getTime()<Date.now()&&!['expired','revoked'].includes(session.status)){
    await supabase.from('partner_execution_sessions').update({status:'expired'}).eq('id',session.id);
    return{supabase,session:null,assignment:null,project:null};
  }
  if(['expired','revoked'].includes(session.status))return{supabase,session:null,assignment:null,project:null};
  const [{data:assignment,error:assignmentError},{data:project,error:projectError}]=await Promise.all([
    supabase.from('project_execution_assignments').select('*').eq('id',session.assignment_id).eq('project_id',session.project_id).maybeSingle(),
    supabase.from('projects').select('id,project_stage').eq('id',session.project_id).maybeSingle(),
  ]);
  if(assignmentError||projectError||!assignment||!project||['closed','cancelled'].includes(String(assignment.execution_state)))return{supabase,session:null,assignment:null,project:null};
  return{supabase,session,assignment,project};
}

export async function GET(_:Request,context:{params:Promise<{token:string}>}){
  try{
    const {token}=await context.params;const{supabase,session,assignment,project}=await contextForToken(token);
    if(!session||!assignment||!project)return NextResponse.json({message:'This Partner Execution link is invalid, expired or revoked.'},{status:404});
    const cycle=Number(assignment.execution_cycle||1);
    const [{data:files,error:fileError},{data:submission,error:submissionError}]=await Promise.all([
      supabase.from('partner_delivery_submission_files').select('id,submission_id,original_filename,mime_type,size_bytes,uploaded_at,attached_at').eq('assignment_id',assignment.id).eq('execution_cycle',cycle).order('uploaded_at'),
      supabase.from('partner_delivery_submissions').select('id,review_status,submitted_at').eq('assignment_id',assignment.id).eq('execution_cycle',cycle).maybeSingle(),
    ]);
    if(fileError)throw fileError;if(submissionError)throw submissionError;
    return NextResponse.json({execution_cycle:cycle,project_stage:project.project_stage,submission:submission||null,files:files||[],locked:Boolean(submission)});
  }catch(error){console.error('Partner delivery files load failed',error);return NextResponse.json({message:'Unable to load Partner delivery files.'},{status:500});}
}

export async function POST(request:Request,context:{params:Promise<{token:string}>}){
  try{
    const {token}=await context.params;const{supabase,session,assignment,project}=await contextForToken(token);
    if(!session||!assignment||!project)return NextResponse.json({message:'This Partner Execution link is invalid, expired or revoked.'},{status:404});
    if(!['in_progress','partner_correction'].includes(String(project.project_stage)))return NextResponse.json({message:'Engineering output files can be attached only during active execution or correction.'},{status:409});
    const {data:commencement}=await supabase.from('partner_commencement_declarations').select('id').eq('assignment_id',assignment.id).maybeSingle();
    if(!commencement)return NextResponse.json({message:'Partner commencement must be declared before engineering delivery files can be uploaded.'},{status:409});
    const cycle=Number(assignment.execution_cycle||1);
    const {data:existingSubmission}=await supabase.from('partner_delivery_submissions').select('id').eq('assignment_id',assignment.id).eq('execution_cycle',cycle).maybeSingle();
    if(existingSubmission)return NextResponse.json({message:'This execution cycle has already been submitted for Overflow Partner review. Files are now locked.'},{status:409});

    const body=await request.json().catch(()=>({}));const action=String(body?.action||'');
    if(action==='prepare'){
      const filename=String(body?.filename||'').trim();const size=Number(body?.size||0);const mimeType=String(body?.mimeType||'application/octet-stream').slice(0,180);
      const invalid=descriptorError(filename,size);if(invalid)return NextResponse.json({message:invalid},{status:size>MAX_FILE_BYTES?413:400});
      const {count,error:countError}=await supabase.from('partner_delivery_submission_files').select('id',{count:'exact',head:true}).eq('assignment_id',assignment.id).eq('execution_cycle',cycle);
      if(countError)throw countError;if((count||0)>=MAX_FILES_PER_CYCLE)return NextResponse.json({message:`A maximum of ${MAX_FILES_PER_CYCLE} engineering output files can be attached to one execution cycle.`},{status:409});
      const storedName=`${randomUUID()}-${safeFilename(filename)}`;
      const storagePath=`${assignment.organisation_id}/${assignment.project_id}/${assignment.id}/cycle-${cycle}/${session.id}/${storedName}`;
      const {data:signed,error:signedError}=await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
      if(signedError||!signed?.token)throw signedError||new Error('Signed upload token was not created.');
      return NextResponse.json({upload:{path:storagePath,token:signed.token,bucket:BUCKET,filename,size,mimeType,executionCycle:cycle}});
    }

    if(action==='finalize'){
      const storagePath=String(body?.path||'');const filename=String(body?.filename||'').trim();const size=Number(body?.size||0);const mimeType=String(body?.mimeType||'application/octet-stream').slice(0,180);
      const invalid=descriptorError(filename,size);if(invalid)return NextResponse.json({message:invalid},{status:400});
      const requiredPrefix=`${assignment.organisation_id}/${assignment.project_id}/${assignment.id}/cycle-${cycle}/${session.id}/`;
      if(!storagePath.startsWith(requiredPrefix))return NextResponse.json({message:'The uploaded file does not belong to this controlled execution cycle.'},{status:403});
      const {data:existing}=await supabase.from('partner_delivery_submission_files').select('id,submission_id,original_filename,mime_type,size_bytes,uploaded_at,attached_at').eq('storage_path',storagePath).maybeSingle();
      if(existing)return NextResponse.json({file:existing});
      const {data:row,error:insertError}=await supabase.from('partner_delivery_submission_files').insert({
        organisation_id:assignment.organisation_id,assignment_id:assignment.id,project_id:assignment.project_id,partner_id:assignment.partner_id,session_id:session.id,
        execution_cycle:cycle,storage_bucket:BUCKET,storage_path:storagePath,original_filename:filename,mime_type:mimeType||'application/octet-stream',size_bytes:size,
      }).select('id,submission_id,original_filename,mime_type,size_bytes,uploaded_at,attached_at').single();
      if(insertError){await supabase.storage.from(BUCKET).remove([storagePath]).catch(()=>null);throw insertError;}
      return NextResponse.json({file:row},{status:201});
    }
    return NextResponse.json({message:'Unsupported file operation.'},{status:400});
  }catch(error){console.error('Partner delivery file operation failed',error);return NextResponse.json({message:'The engineering output file could not be processed.'},{status:500});}
}

export async function DELETE(request:Request,context:{params:Promise<{token:string}>}){
  try{
    const {token}=await context.params;const{supabase,session,assignment}=await contextForToken(token);
    if(!session||!assignment)return NextResponse.json({message:'This Partner Execution link is invalid, expired or revoked.'},{status:404});
    const fileId=String((await request.json().catch(()=>({})))?.fileId||'');if(!fileId)return NextResponse.json({message:'File ID is required.'},{status:400});
    const cycle=Number(assignment.execution_cycle||1);
    const {data:row,error}=await supabase.from('partner_delivery_submission_files').select('id,storage_path,submission_id').eq('id',fileId).eq('assignment_id',assignment.id).eq('session_id',session.id).eq('execution_cycle',cycle).maybeSingle();
    if(error)throw error;if(!row)return NextResponse.json({message:'File not found.'},{status:404});if(row.submission_id)return NextResponse.json({message:'Submitted engineering delivery files are immutable.'},{status:409});
    const {error:storageError}=await supabase.storage.from(BUCKET).remove([row.storage_path]);if(storageError)throw storageError;
    const {error:deleteError}=await supabase.from('partner_delivery_submission_files').delete().eq('id',row.id);if(deleteError)throw deleteError;
    return NextResponse.json({success:true});
  }catch(error){console.error('Partner delivery file removal failed',error);return NextResponse.json({message:'The engineering output file could not be removed.'},{status:500});}
}
