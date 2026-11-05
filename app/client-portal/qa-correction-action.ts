'use server';
import {redirect} from 'next/navigation';
import {createClient} from '@supabase/supabase-js';
import {verifyClientPortalToken} from '@/lib/quotes/clientPortalToken';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

/** Scoped solely to the existing fictional Northfield QA quotation. */
export async function acceptNorthfieldQaCorrection(formData:FormData){
  assertIsolatedQaBackend();
  const token=String(formData.get('token')||'');
  const access=verifyClientPortalToken(token);
  if(!access||access.quoteId!=='c5b894db-ccdd-47e2-a58a-c38005bcaa99'||access.revision!==1)
    redirect('/quote-response?result=invalid');
  const back='/client-portal?token='+encodeURIComponent(token);
  const name=String(formData.get('signatory_name')||'').trim();
  const email=String(formData.get('signatory_email')||'').trim().toLowerCase();
  if(formData.get('qa_correction_acknowledged')!=='yes'||!name||!email)
    redirect(back+'&notice=qa_addendum_unavailable');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)redirect(back+'&notice=qa_addendum_unavailable');
  const db=createClient(url!,secret!,{auth:{persistSession:false,autoRefreshToken:false}});
  const org='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
  const [replay,issue,contract]=await Promise.all([
    db.from('op_qa_northfield_replay').select('quote_id').eq('quote_id',access.quoteId)
      .eq('organisation_id',org).gt('expires_at',new Date().toISOString()).maybeSingle(),
    db.from('quote_issue_records').select('client_response').eq('quote_id',access.quoteId)
      .eq('organisation_id',org).eq('quote_revision',1).maybeSingle(),
    db.from('quote_release_contracts').select('authorised_contact_name,authorised_contact_email')
      .eq('quote_id',access.quoteId).eq('organisation_id',org).eq('quote_revision',1).maybeSingle(),
  ]);
  if(replay.error||issue.error||contract.error||!replay.data||
      issue.data?.client_response!=='accepted'||!contract.data||
      name.toLowerCase()!==String(contract.data.authorised_contact_name).trim().toLowerCase()||
      email!==String(contract.data.authorised_contact_email).trim().toLowerCase())
    redirect(back+'&notice=qa_addendum_unavailable');
  const {error}=await db.from('op_qa_northfield_addendum_acceptances').insert({
    quote_id:access.quoteId,organisation_id:org,
    accepted_by_name:name,accepted_by_email:email,
    acceptance_note:'EXPLICIT FICTIONAL NORTHFIELD QA VAT-INCLUSIVE CORRECTION; no legal signature or live payment'
  });
  if(error && error.code!=='23505')
    redirect(back+'&notice=qa_addendum_unavailable');
  redirect(back);
}
