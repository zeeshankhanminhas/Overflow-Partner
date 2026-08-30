import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/auth/context';
import { resolveDocumentPresentation } from '@/lib/presentation/operatingState';
import { commercialCopy } from '@/lib/presentation/commercialLanguage';

function csv(value:unknown){const text=String(value??'');return /[",\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text}
function canonical(value:string){return value.replaceAll('_','-')}
function state(d:any){return d.control_state||String(d.status||'').replaceAll('_',' ')}
function purpose(d:any){if(d.issue_purpose&&d.issue_purpose!=='internal')return String(d.issue_purpose).replaceAll('_',' ');const type=canonical(String(d.document_type||''));if(type.includes('client-quote'))return 'Client issue';if(type.includes('commercial-approval'))return 'Internal approval';if(type.includes('partner-technical'))return 'Partner review';if(type.includes('client-requirements'))return 'Client requirements';if(type.includes('technical-review'))return 'Technical review';if(type.includes('document-register'))return 'Controlled record';return d.project_id?'Project evidence':'Internal working'}
function revision(d:any){return d.revision_code||`P${String(Math.max(1,Number(d.version||1))).padStart(2,'0')}`}

export async function GET(request:NextRequest){
  const {supabase,organisationId}=await requireUserContext();
  const params=request.nextUrl.searchParams;const q=(params.get('q')||'').trim().toLowerCase();const type=params.get('type')||'';const owner=params.get('owner')||'';const view=params.get('view')||'all';const lead=params.get('lead')||'';const project=params.get('project')||'';
  let query=supabase.from('documents').select('id,document_type,reference,title,status,version,created_at,updated_at,lead_id,project_id,created_by,prepared_by,revision_code,issue_purpose,control_state,is_current_revision,storage_path').eq('organisation_id',organisationId);
  if(lead)query=query.eq('lead_id',lead);if(project)query=query.eq('project_id',project);
  const {data,error}=await query;if(error)return NextResponse.json({error:'Document export could not be prepared.'},{status:500});
  let docs=(data||[]).filter((d:any)=>d.is_current_revision!==false&&state(d)!=='superseded'&&state(d)!=='withdrawn');
  const ids=docs.map((d:any)=>d.id);const issues=ids.length?(await supabase.from('document_issue_records').select('document_id,recipient_name,recipient_email,issued_at,purpose').eq('organisation_id',organisationId).in('document_id',ids).order('issued_at',{ascending:false})).data||[]:[];
  const latest=new Map<string,any>();for(const issue of issues as any[]){if(!latest.has(issue.document_id))latest.set(issue.document_id,issue)}
  if(type)docs=docs.filter((d:any)=>d.document_type===type);if(owner)docs=docs.filter((d:any)=>(d.prepared_by||d.created_by)===owner);
  if(q)docs=docs.filter((d:any)=>[d.title,d.reference,d.document_type,d.storage_path,purpose(d),latest.get(d.id)?.recipient_name,latest.get(d.id)?.recipient_email].some(v=>String(v||'').toLowerCase().includes(q)));
  if(view==='review')docs=docs.filter((d:any)=>resolveDocumentPresentation(state(d),d.title).approval?.required);
  if(view==='progress')docs=docs.filter((d:any)=>!resolveDocumentPresentation(state(d),d.title).approval?.required&&!['approved','issued','published','archived'].includes(d.status));
  if(view==='sent')docs=docs.filter((d:any)=>['issued','published'].includes(d.status)||state(d)==='issued');
  if(view==='overdue')docs=docs.filter((d:any)=>(Date.now()-new Date(d.updated_at||d.created_at).getTime())>=7*86400000&&!['issued','published','archived'].includes(d.status)&&state(d)!=='issued');
  if(view==='recent')docs=docs.filter((d:any)=>(Date.now()-new Date(d.updated_at||d.created_at).getTime())<=7*86400000);
  const header=['#','Reference','Title','Document type','Status','Revision','Purpose','Project ID','Case ID','File','Release recipient','Release email','Release date','Updated'];
  const rows=docs.map((d:any,index:number)=>{const issue=latest.get(d.id);const presentation=resolveDocumentPresentation(state(d),d.title);return [index+1,d.reference,d.title,canonical(d.document_type).replaceAll('-',' '),commercialCopy(presentation.state),revision(d),purpose(d),d.project_id||'',d.lead_id||'',d.storage_path?.split('/').pop()||'',issue?.recipient_name||'',issue?.recipient_email||'',issue?.issued_at||'',d.updated_at||d.created_at]});
  const body=[header,...rows].map(row=>row.map(csv).join(',')).join('\n');
  return new NextResponse(body,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="overflow-partner-document-register-${new Date().toISOString().slice(0,10)}.csv"`,'Cache-Control':'no-store'}});
}
