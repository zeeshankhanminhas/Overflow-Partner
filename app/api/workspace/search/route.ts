import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/auth/context';

export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  try{
    const q=String(request.nextUrl.searchParams.get('q')||'').trim();
    if(q.length<2)return NextResponse.json({results:[]});
    const {supabase,organisationId}=await requireUserContext();
    const {data,error}=await supabase.rpc('op_global_search',{p_organisation_id:organisationId,p_query:q,p_limit:30});
    if(error)throw new Error(error.message);
    return NextResponse.json({results:data||[]});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Search unavailable.',results:[]},{status:500});}
}
