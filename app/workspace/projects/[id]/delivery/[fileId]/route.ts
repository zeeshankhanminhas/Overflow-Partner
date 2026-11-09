import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { assertIsolatedQaBackend } from '@/lib/qa/isolation';

// Signed, short-lived access to one exact Partner submission file, for the
// authenticated QA reviewer. Never expose the storage service key in a client.
// Production is deliberately excluded while the controlled preview is tested.
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, {params}: {params: Promise<{id:string;fileId:string}>}) {
  try {
    assertIsolatedQaBackend();
    const {id, fileId} = await params;
    const {supabase, organisationId, profile} = await requireUserContext();
    assertRole(profile.role, ['owner','admin','engineering','operator']);

    const {data:project,error:projectError} = await supabase.from('projects')
      .select('id,project_stage').eq('organisation_id',organisationId).eq('id',id).maybeSingle();
    if(projectError || !project || !['internal_review','partner_correction','ready_for_client_issue','issued_to_client','client_review','completion'].includes(String(project.project_stage))) {
      return NextResponse.json({error:'No authorised internal-review project found.'},{status:404,headers:{'Cache-Control':'no-store'}});
    }

    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    const apiUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
    if(!key||!apiUrl) throw new Error('Private QA file-viewing credentials are not configured.');
    const storageDb=createClient(apiUrl,key,{auth:{persistSession:false,autoRefreshToken:false}});

    const {data:file,error:fileError}=await storageDb.from('partner_delivery_submission_files')
      .select('id,storage_bucket,storage_path,submission_id,execution_cycle')
      .eq('organisation_id',organisationId).eq('project_id',id).eq('id',fileId).maybeSingle();
    if(fileError||!file||file.storage_bucket!=='partner-delivery') {
      return NextResponse.json({error:'The requested Partner attachment was not found in this project.'},{status:404,headers:{'Cache-Control':'no-store'}});
    }
    const {data:submission,error:submissionError}=await storageDb.from('partner_delivery_submissions')
      .select('id,review_status,execution_cycle,submitted_at')
      .eq('organisation_id',organisationId).eq('project_id',id).eq('id',file.submission_id).maybeSingle();
    if(submissionError||!submission||!submission.submitted_at||submission.execution_cycle!==file.execution_cycle||
      ['withdrawn','rejected'].includes(String(submission.review_status))) {
      return NextResponse.json({error:'A current governed Partner submission is required.'},{status:404,headers:{'Cache-Control':'no-store'}});
    }

    const {data:signed,error:signedError}=await storageDb.storage.from('partner-delivery')
      .createSignedUrl(String(file.storage_path),120);
    if(signedError||!signed?.signedUrl) throw new Error('The private attachment could not be opened.');
    return NextResponse.redirect(signed.signedUrl,{status:302,headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({error:'Unable to authorise the secure Partner file preview.'},{status:403,headers:{'Cache-Control':'no-store'}});
  }
}
