import 'server-only';
import {createClient as createAdminClient} from '@supabase/supabase-js';
import {clientFinalFilesReady} from './clientFinalRelease';
import {hasCurrentClientAcceptance} from '@/lib/payments/currentClientAcceptance';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';

/**
 * Read-only financial and handover evidence for an authenticated, previously
 * entitled Client Workspace project. Call ONLY after portal_my_projects has
 * returned the exact organisation and project for this signed-in client.
 * Service-role access here does not establish external membership.
 */
export type ClientSettlementPosition={
 finalBalanceReady:boolean;
 finalFilesReady:boolean;
 finalPaid:boolean;
 finalSettlementUnavailable:boolean;
};
export async function clientSettlementPosition(
 organisationId:string,projectId:string,stage:string,
):Promise<ClientSettlementPosition>{
 const state:ClientSettlementPosition={
  finalBalanceReady:false,finalFilesReady:false,finalPaid:false,
  finalSettlementUnavailable:false,
 };
 if(!['completion','closed'].includes(stage))return state;
 const enabled=process.env.OP_VOICE_FINAL_RELEASE_ENABLED==='true' &&
  (isKnownIsolatedQaBackend()||process.env.VERCEL_ENV==='production');
 if(!enabled)return {...state,finalSettlementUnavailable:true};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return {...state,finalSettlementUnavailable:true};
 try{
  const db=createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  // A false/unknown acceptance must never be interpreted as verified funds.
  const accepted=await hasCurrentClientAcceptance(db,organisationId,projectId);
  if(!accepted)return state;
  const settlement=await db.from('op_project_final_settlements')
   .select('verified_at').eq('organisation_id',organisationId)
   .eq('project_id',projectId).maybeSingle();
  if(settlement.error)return {...state,finalBalanceReady:true,finalSettlementUnavailable:true};
  const paid=Boolean(settlement.data?.verified_at);
  const files=paid?await clientFinalFilesReady(db,organisationId,projectId):false;
  return {...state,finalBalanceReady:true,finalPaid:paid,finalFilesReady:files};
 }catch{
  return {...state,finalSettlementUnavailable:true};
 }
}
