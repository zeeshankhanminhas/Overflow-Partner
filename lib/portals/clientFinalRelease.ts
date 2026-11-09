import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';

/** Read-only, exact project and organisation scoped readiness for authorised
 * client final file retrieval. Caller MUST verify the signed-in Client
 * account's portal_my_projects entitlement before using this helper.
 * This is not a replacement for the checks inside /client-final-files.
 */
export async function clientFinalFilesReady(db:SupabaseClient, organisationId:string, projectId:string):Promise<boolean>{
 const [settlement,release,handover]=await Promise.all([
  db.from('op_project_final_settlements').select('verified_at').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle(),
  db.from('op_project_final_release_approvals').select('approved_at,submission_id').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle(),
  db.from('documents').select('id,issued_at,approved_at,storage_path,status').eq('organisation_id',organisationId)
   .eq('project_id',projectId).eq('document_type','handover-pack').eq('is_current_revision',true).maybeSingle()
 ]);
 if(settlement.error||release.error||handover.error||!settlement.data?.verified_at||!release.data?.approved_at||
    !handover.data?.issued_at||!handover.data?.approved_at||!handover.data?.storage_path||
    !['issued','published'].includes(String(handover.data.status)))return false;
 const {data:assignment,error:assignmentError}=await db.from('project_execution_assignments')
  .select('id,execution_cycle').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
 if(assignmentError||!assignment)return false;
 const {data:submission,error:submissionError}=await db.from('partner_delivery_submissions')
  .select('id').eq('organisation_id',organisationId).eq('project_id',projectId)
  .eq('assignment_id',assignment.id).eq('execution_cycle',assignment.execution_cycle||1)
  .eq('review_status','accepted').order('submitted_at',{ascending:false}).limit(1).maybeSingle();
 if(submissionError||!submission||submission.id!==release.data.submission_id)return false;
 const {data:files,error:fileError}=await db.from('partner_delivery_submission_files')
  .select('id,storage_bucket,storage_path').eq('organisation_id',organisationId).eq('project_id',projectId)
  .eq('assignment_id',assignment.id).eq('submission_id',submission.id)
  .eq('execution_cycle',assignment.execution_cycle||1).limit(100);
 return !fileError&&Boolean(files?.length)&&files!.every(f=>Boolean(f.storage_bucket&&f.storage_path));
}
