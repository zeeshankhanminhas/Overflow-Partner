import 'server-only';
import {createHash} from 'node:crypto';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {createExecutionSessionToken} from '@/lib/execution/sessionToken';
import type {PortalProject} from './account';

type Handler = (request:Request, context:{params:Promise<{token:string}>}) => Promise<Response>;
export function partnerTask(handler:Handler) {
  return async function handle(request:Request, {params}:{params:Promise<{projectId:string}>}) {
    const {projectId}=await params;
    if (request.method !== 'GET' && request.headers.get('origin') !== new URL(request.url).origin)
      return Response.json({message:'Request origin is invalid.'},{status:403});
    const db=await createClient();
    const identity=await db.auth.getUser();
    if (!identity.data.user) return Response.json({message:'Sign in to continue.'},{status:401});
    const access=await db.rpc('portal_my_projects',{p_kind:'partner'});
    if (access.error) return Response.json({message:'Assignment access is unavailable.'},{status:503});
    const project=(access.data as PortalProject[]).find(row=>row.project_id===projectId && row.portal_kind==='partner');
    if (!project) return Response.json({message:'Assignment unavailable.'},{status:404});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return Response.json({message:'Assignment service unavailable.'},{status:503});
    const service=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const session=await service.from('partner_execution_sessions').select('id,token_hash')
      .eq('organisation_id',project.organisation_id).eq('partner_id',project.account_id)
      .eq('project_id',projectId).in('status',['invited','opened','active'])
      .gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if (session.error) return Response.json({message:'Assignment service unavailable.'},{status:503});
    if (!session.data) return Response.json({message:'Ask Overflow Partner to renew the assignment invitation.'},{status:403});
    const token=createExecutionSessionToken(session.data.id);
    if (createHash('sha256').update(token).digest('hex')!==session.data.token_hash)
      return Response.json({message:'The assignment invitation has changed.'},{status:403});
    return handler(request,{params:Promise.resolve({token})});
  };
}
