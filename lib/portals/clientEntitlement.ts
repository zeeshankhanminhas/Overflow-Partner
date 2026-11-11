import 'server-only';
import {createClient} from '@/lib/supabase/server';

/**
 * An authenticated Client Workspace membership is required for every final
 * payment and native-file task, including bookmarked token-based URLs.
 * A valid quotation token is NOT an account or project entitlement.
 * This query runs as the signed-in user and relies on the database's
 * tenant/member-scoped portal_my_projects RPC (never service_role).
 */
export async function clientProjectEntitled(organisationId:string, projectId:string):Promise<boolean>{
  if(!organisationId || !projectId)return false;
  const db=await createClient();
  const {data:{user},error:identityError}=await db.auth.getUser();
  if(identityError || !user)return false;
  const {data,error}=await db.rpc('portal_my_projects',{p_kind:'client'});
  if(error || !Array.isArray(data))return false;
  return data.some((row:unknown)=>{
    if(!row || typeof row!=='object')return false;
    const item=row as {portal_kind?:string;organisation_id?:string;project_id?:string};
    return item.portal_kind==='client' &&
      item.organisation_id===organisationId && item.project_id===projectId;
  });
}
