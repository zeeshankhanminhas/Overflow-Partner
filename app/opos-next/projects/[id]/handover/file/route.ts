import {NextResponse} from 'next/server';
import {createClient as createSupabaseClient} from '@supabase/supabase-js';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

export const runtime='nodejs';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 try{
  assertIsolatedQaBackend();
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))return new Response('Invalid project',{status:400});
  const {supabase,organisationId,profile}=await requireUserContext('/opos-next');
  assertRole(profile.role,['owner','admin']);
  const {data:doc,error}=await supabase.from('documents').select('id,storage_path,reference')
    .eq('organisation_id',organisationId).eq('project_id',id)
    .eq('document_type','handover-pack').eq('is_current_revision',true).maybeSingle();
  if(error||!doc?.storage_path)return new Response('Controlled Handover Pack not prepared',{status:404});
  const prefix='opos-qa-controlled-handover:';
  const path=String(doc.storage_path);
  if(!path.startsWith(prefix+organisationId+'/'+id+'/'+doc.id+'/'))return new Response('Untrusted protected file path',{status:403});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return new Response('QA storage unavailable',{status:503});
  const db=createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error:storageError}=await db.storage.from('opos-qa-controlled-handover').download(path.slice(prefix.length));
  if(storageError||!data)return new Response('Controlled file not found',{status:404});
  const buffer=await data.arrayBuffer();
  return new Response(buffer,{headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':'inline; filename="Northfield-QA-Controlled-Handover-R01.pdf"',
    'Cache-Control':'private, no-store, max-age=0',
    'X-Content-Type-Options':'nosniff'
  }});
 }catch{return new Response('Not authorised',{status:403});}
}
