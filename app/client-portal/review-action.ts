'use server';

import {redirect} from 'next/navigation';
import {createClient} from '@supabase/supabase-js';
import {verifyClientPortalToken} from '@/lib/quotes/clientPortalToken';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The token is a signed, expiring bearer link sent to the actual quote recipient.
// The SQL RPC additionally validates quote revision, transmittal recipient, cycle,
// handover pack and lifecycle stage. No privileged DB writes from the browser.
export async function submitClientProjectReview(formData:FormData){
 const token=String(formData.get('token')||'');
 const access=verifyClientPortalToken(token);
 if(!access)redirect('/client-portal?review_result=invalid');
 const projectId=String(formData.get('project_id')||'');
 const transmittalId=String(formData.get('transmittal_id')||'');
 const outcome=String(formData.get('outcome')||'');
 const email=String(formData.get('client_email')||'').trim().toLowerCase();
 const comments=String(formData.get('comments')||'').trim();
 const attested=formData.get('authority_attested')==='yes';
 const back='/client-portal?token='+encodeURIComponent(token);
 if(!uuid.test(projectId)||!uuid.test(transmittalId)||!['accepted','accepted_with_comments'].includes(outcome)
    ||!email||email.length>254||!attested||(outcome==='accepted_with_comments'&&!comments))
   redirect(back+'&review_result=invalid');
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)redirect(back+'&review_result=unavailable');
 const db=createClient(url!,key!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await db.rpc('op_record_attested_client_portal_review',{
   p_quote_id:access.quoteId,p_quote_revision:access.revision,
   p_project_id:projectId,p_transmittal_id:transmittalId,
   p_client_email:email,p_outcome:outcome,p_comments:comments||null
 });
 if(error)redirect(back+'&review_result=unavailable');
 redirect(back+'&review_result=recorded');
}
