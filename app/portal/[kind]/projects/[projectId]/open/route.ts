import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createClient as createAdminClient} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {isPortalKind} from '@/lib/portals/account';
import {createClientPortalToken} from '@/lib/quotes/clientPortalToken';
import {createExecutionSessionToken} from '@/lib/execution/sessionToken';

export const dynamic='force-dynamic';
function back(request:NextRequest,kind:string,id:string,reason:string){
 const url=new URL('/portal/'+kind+'/projects/'+id,request.url);
 url.searchParams.set('notice',reason);
 return NextResponse.redirect(url,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
export async function GET(request:NextRequest,{params}:{params:Promise<{kind:string;projectId:string}>}){
 const {kind,projectId}=await params;
 if(!isPortalKind(kind)||!/^[0-9a-f-]{36}$/i.test(projectId))return new NextResponse('Not found',{status:404});
 const supabase=await createClient();
 const {data:{user},error:userError}=await supabase.auth.getUser();
 if(userError||!user){
  const url=new URL('/login',request.url);url.searchParams.set('next','/portal/'+kind);
  return NextResponse.redirect(url);
 }
 const {data:projects,error}=await supabase.rpc('portal_my_projects',{p_kind:kind});
 if(error)return new NextResponse('Workspace access temporarily unavailable',{status:503});
 const project=(projects||[]).find((p:{project_id:string})=>p.project_id===projectId);
 if(!project)return new NextResponse('Not found',{status:404});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return new NextResponse('Secure workflow temporarily unavailable',{status:503});
 // Membership is independently checked by the auth-scoped RPC above.
 // This new service client only resolves the already-entitled existing workflow,
 // not a different assignment, company, or downloadable file.
 const db=createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 if(kind==='client'){
  const {data:p,error:pError}=await db.from('projects').select('id,quote_id,organisation_id')
   .eq('id',projectId).eq('organisation_id',project.organisation_id).maybeSingle();
  if(pError||!p?.quote_id)return back(request,kind,projectId,'No issued quotation is linked to this project.');
  const {data:q}=await db.from('quotes').select('id,revision,status')
   .eq('id',p.quote_id).eq('organisation_id',project.organisation_id).maybeSingle();
  if(!q||!['issued','accepted'].includes(String(q.status)))return back(request,kind,projectId,'The quotation is not available for secure review.');
  const token=createClientPortalToken(q.id,q.revision);
  // Client-selected final settlement is an explicit, authenticated portal
  // handoff. Reuse the same company/project entitlement check above and
  // require an accepted current-cycle review; never infer payment from stage.
  const finalFlow=request.nextUrl.searchParams.get('flow')==='final-settlement';
  if(finalFlow){
    const {data:projectStatus}=await db.from('projects')
      .select('project_stage').eq('id',projectId).eq('organisation_id',project.organisation_id).maybeSingle();
    const {data:assignment}=await db.from('project_execution_assignments')
      .select('execution_cycle').eq('project_id',projectId)
      .eq('organisation_id',project.organisation_id).maybeSingle();
    const {data:acceptedReview}=await db.from('project_client_reviews')
      .select('outcome').eq('project_id',projectId)
      .eq('organisation_id',project.organisation_id)
      .eq('execution_cycle',assignment?.execution_cycle||-1)
      .order('recorded_at',{ascending:false}).limit(1).maybeSingle();
    if(!projectStatus || !['completion','closed'].includes(projectStatus.project_stage) ||
       !acceptedReview || !['accepted','accepted_with_comments'].includes(acceptedReview.outcome))
      return back(request,kind,projectId,'Final settlement requires the current accepted client review.');
    const payment=new URL('/project-final-payment',request.url);
    payment.searchParams.set('token',token);
    return NextResponse.redirect(payment,{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
  }
  const target=new URL('/client-portal',request.url);
  target.searchParams.set('token',token);
  return NextResponse.redirect(target,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }
 const {data:session,error:sessionError}=await db.from('partner_execution_sessions')
  .select('id,token_hash,status,expires_at,organisation_id,partner_id,project_id')
  .eq('organisation_id',project.organisation_id).eq('project_id',projectId)
  .eq('partner_id',project.account_id).in('status',['invited','opened','active'])
  .order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(sessionError||!session||Date.parse(session.expires_at)<=Date.now())
  return back(request,kind,projectId,'The previous secure partner invitation has expired. Ask Overflow Partner for a fresh one.');
 const token=createExecutionSessionToken(session.id);
 if(createHash('sha256').update(token).digest('hex')!==session.token_hash)
  return back(request,kind,projectId,'The secure partner invitation was rotated. Use the latest invitation or request a new one.');
 return NextResponse.redirect(new URL('/execution/'+encodeURIComponent(token),request.url),{
  headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}
 });
}
