import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalToken } from '@/lib/quotes/clientPortalToken';

export const dynamic='force-dynamic';
export const metadata={title:'Final engineering files | Overflow Partner',robots:{index:false,follow:false}};

const denied=(message:string)=><main style={{maxWidth:720,margin:'3rem auto',padding:24}}>
  <p>OVERFLOW PARTNER · SECURE CLIENT PORTAL</p><h1>Final files not available</h1><p>{message}</p>
</main>;

/** Signed URLs are minted ONLY after the verified final settlement AND a distinct
 * authenticated OPOS owner approval. Do not pre-sign links in review emails.
 */
export default async function ClientFinalFiles({searchParams}:{searchParams:Promise<{token?:string}>}) {
  if(process.env.OP_VOICE_FINAL_RELEASE_ENABLED!=='true')
    return denied('The controlled final handover service has not been enabled yet.');
  const {token=''}=await searchParams;
  const access=token?verifyClientPortalToken(token):null;
  if(!access)return denied('Your private client portal link has expired. Please request a fresh link.');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return denied('The secure document service is temporarily unavailable.');
  const db=createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:issue}=await db.from('quote_issue_records').select('organisation_id,client_response')
    .eq('quote_id',access.quoteId).eq('quote_revision',access.revision).maybeSingle();
  if(issue?.client_response!=='accepted')return denied('Client quotation acceptance is missing.');
  const {data:quote}=await db.from('quotes').select('id,revision,quote_number')
    .eq('id',access.quoteId).eq('organisation_id',issue.organisation_id).eq('revision',access.revision).maybeSingle();
  if(!quote)return denied('The accepted quotation revision is no longer current.');
  const {data:project}=await db.from('projects').select('id,project_number')
    .eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle();
  if(!project)return denied('The project has not been commercially released.');
  const [payment,approval]=await Promise.all([
    db.from('op_project_final_settlements').select('project_id,verified_at')
      .eq('project_id',project.id).eq('organisation_id',issue.organisation_id).maybeSingle(),
    db.from('op_project_final_release_approvals').select('project_id,approved_at')
      .eq('project_id',project.id).eq('organisation_id',issue.organisation_id).maybeSingle(),
  ]);
  if(payment.error||approval.error||!payment.data||!approval.data)
    return denied('Final cleared payment and the last OPOS owner release approval are both required.');
  const {data:assignment}=await db.from('project_execution_assignments')
    .select('id,execution_cycle').eq('project_id',project.id).eq('organisation_id',issue.organisation_id).maybeSingle();
  if(!assignment)return denied('There is no final approved engineering submission for this project.');
  const {data:reviewed}=await db.from('partner_delivery_submissions').select('id')
    .eq('project_id',project.id).eq('assignment_id',assignment.id).eq('organisation_id',issue.organisation_id)
    .eq('execution_cycle',assignment.execution_cycle||1).eq('review_status','accepted')
    .order('submitted_at',{ascending:false}).limit(1).maybeSingle();
  if(!reviewed)return denied('The latest engineering revision has not passed technical review.');
  const {data:files,error}=await db.from('partner_delivery_submission_files')
    .select('id,original_filename,storage_bucket,storage_path').eq('organisation_id',issue.organisation_id)
    .eq('project_id',project.id).eq('assignment_id',assignment.id).eq('submission_id',reviewed.id)
    .eq('execution_cycle',assignment.execution_cycle||1);
  if(error||!files?.length)return denied('The approved final package is temporarily unavailable.');
  const links: {id:string;name:string;url:string}[]=[];
  for(const file of files){
    const {data:signed,error:signError}=await db.storage.from(file.storage_bucket).createSignedUrl(file.storage_path,300);
    if(signError||!signed?.signedUrl)return denied('A secure file link could not be created. Please try again.');
    links.push({id:file.id,name:file.original_filename,url:signed.signedUrl});
  }
  return <main style={{maxWidth:740,margin:'3rem auto',padding:24}}>
    <p>OVERFLOW PARTNER · SECURE CLIENT PORTAL</p>
    <h1>Final engineering package</h1>
    <p>Project {project.project_number} · Quotation {quote.quote_number}</p>
    <p>Final settlement verified. Overflow Partner has approved release of this specific engineering revision.</p>
    <ul>{links.map(file=><li key={file.id}><a href={file.url} rel="nofollow noopener noreferrer">{file.name}</a></li>)}</ul>
    <p>Links expire after five minutes. Refresh this private page for fresh links. Please keep the package confidential.</p>
  </main>;
}
