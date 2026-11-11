import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';

export async function hasCurrentClientAcceptance(db:SupabaseClient, organisationId:string, projectId:string) {
  const {data:assignment,error}=await db.from('project_execution_assignments').select('execution_cycle')
    .eq('organisation_id',organisationId).eq('project_id',projectId)
    .neq('execution_state','cancelled').order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error)return false;
  // Projects without a partner assignment use cycle one in the canonical review RPC.
  const cycle=assignment ? assignment.execution_cycle : 1;
  if(!Number.isInteger(cycle)||cycle<1)return false;
  const {data:review,error:reviewError}=await db.from('project_client_reviews').select('outcome')
    .eq('organisation_id',organisationId).eq('project_id',projectId).eq('execution_cycle',cycle).maybeSingle();
  return !reviewError && ['accepted','accepted_with_comments'].includes(String(review?.outcome));
}
