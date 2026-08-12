import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/auth/context';

export const dynamic='force-dynamic';

type SearchResult={entity_type:string;entity_id:string;title:string;subtitle:string|null;href:string};
function safe(value:string){return value.replace(/[,()%]/g,' ').replace(/\s+/g,' ').trim();}

export async function GET(request:NextRequest){
  try{
    const q=safe(String(request.nextUrl.searchParams.get('q')||''));
    if(q.length<2)return NextResponse.json({results:[]});
    const {supabase,organisationId}=await requireUserContext();
    const pattern=`%${q}%`;
    const [companies,projects,partners,cases,quotes,documents,enquiries]=await Promise.all([
      supabase.from('companies').select('id,name,industry,country').eq('organisation_id',organisationId).or(`name.ilike.${pattern},industry.ilike.${pattern},country.ilike.${pattern}`).limit(6),
      supabase.from('projects').select('id,project_number,title,status,project_stage').eq('organisation_id',organisationId).or(`project_number.ilike.${pattern},title.ilike.${pattern}`).limit(8),
      supabase.from('partners').select('id,company_name,country,services,status').eq('organisation_id',organisationId).or(`company_name.ilike.${pattern},services.ilike.${pattern},country.ilike.${pattern}`).limit(6),
      supabase.from('leads').select('id,title,company_name,status').eq('organisation_id',organisationId).or(`title.ilike.${pattern},company_name.ilike.${pattern}`).limit(8),
      supabase.from('quotes').select('id,quote_number,revision,status,lead_id').eq('organisation_id',organisationId).ilike('quote_number',pattern).limit(6),
      supabase.from('documents').select('id,reference,title,status').eq('organisation_id',organisationId).or(`reference.ilike.${pattern},title.ilike.${pattern}`).limit(8),
      supabase.from('prospects').select('id,company_name,contact_name,status').eq('organisation_id',organisationId).or(`company_name.ilike.${pattern},contact_name.ilike.${pattern}`).limit(8),
    ]);
    const errors=[companies.error,projects.error,partners.error,cases.error,quotes.error,documents.error,enquiries.error].filter(Boolean);
    if(errors.length)throw new Error(errors[0]?.message||'Search unavailable.');
    const results:SearchResult[]=[
      ...(companies.data||[]).map((row:any)=>({entity_type:'company',entity_id:row.id,title:row.name,subtitle:[row.industry,row.country].filter(Boolean).join(' · ')||'Company',href:`/workspace/companies/${row.id}`})),
      ...(projects.data||[]).map((row:any)=>({entity_type:'project',entity_id:row.id,title:`${row.project_number} · ${row.title}`,subtitle:String(row.project_stage||row.status||'Project').replaceAll('_',' '),href:`/workspace/projects/${row.id}`})),
      ...(partners.data||[]).map((row:any)=>({entity_type:'partner',entity_id:row.id,title:row.company_name,subtitle:[row.status,row.country].filter(Boolean).join(' · '),href:`/workspace/partners?q=${encodeURIComponent(row.company_name)}`})),
      ...(cases.data||[]).map((row:any)=>({entity_type:'case',entity_id:row.id,title:row.title||row.company_name,subtitle:`${row.company_name} · ${String(row.status||'Case').replaceAll('_',' ')}`,href:`/workspace/leads/${row.id}`})),
      ...(quotes.data||[]).map((row:any)=>({entity_type:'quote',entity_id:row.id,title:`${row.quote_number} · Rev ${row.revision}`,subtitle:String(row.status||'Quote').replaceAll('_',' '),href:`/workspace/quotes?quote=${row.id}`})),
      ...(documents.data||[]).map((row:any)=>({entity_type:'document',entity_id:row.id,title:`${row.reference} · ${row.title}`,subtitle:String(row.status||'Document').replaceAll('_',' '),href:`/workspace/documents/${row.id}`})),
      ...(enquiries.data||[]).map((row:any)=>({entity_type:'enquiry',entity_id:row.id,title:row.company_name,subtitle:[row.contact_name,String(row.status||'Enquiry').replaceAll('_',' ')].filter(Boolean).join(' · '),href:`/workspace/acquisition/${row.id}`})),
    ];
    const needle=q.toLowerCase();
    results.sort((a,b)=>{const aExact=a.title.toLowerCase().startsWith(needle)?0:1;const bExact=b.title.toLowerCase().startsWith(needle)?0:1;return aExact-bExact||a.title.localeCompare(b.title);});
    return NextResponse.json({results:results.slice(0,30)});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Search unavailable.',results:[]},{status:500});}
}
