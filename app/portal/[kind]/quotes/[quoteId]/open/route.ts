import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createClientPortalToken} from '@/lib/quotes/clientPortalToken';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{kind:string;quoteId:string}>}){
 const {kind,quoteId}=await params;
 if(kind!=='client'||!/^[0-9a-f-]{36}$/i.test(quoteId))return new NextResponse('Not found',{status:404});
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.redirect(new URL('/login?next=%2Fportal%2Fclient',request.url));
 const {data:quotes,error}=await db.rpc('portal_my_quotations');
 if(error)return new NextResponse('Unavailable',{status:503});
 const q=(quotes||[]).find((q:{quote_id:string})=>q.quote_id===quoteId);
 if(!q)return new NextResponse('Not found',{status:404});
 const token=createClientPortalToken(q.quote_id,q.quote_revision);
 const url=new URL('/client-portal',request.url);url.searchParams.set('token',token);
 return NextResponse.redirect(url,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
