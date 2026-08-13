import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/auth/context';
import { normaliseWorkspaceSearchQuery, searchWorkspace } from '@/lib/search/workspaceSearch';

export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  try{
    const q=normaliseWorkspaceSearchQuery(String(request.nextUrl.searchParams.get('q')||''));
    if(q.length<2)return NextResponse.json({results:[]});
    const {supabase,organisationId}=await requireUserContext();
    return NextResponse.json({results:await searchWorkspace(supabase,organisationId,q,30)});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Search unavailable.',results:[]},{status:500});}
}
