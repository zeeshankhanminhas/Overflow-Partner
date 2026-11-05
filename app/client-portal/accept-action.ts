'use server';
import {redirect} from 'next/navigation';
import {createClient} from '@supabase/supabase-js';
import {verifyClientPortalToken} from '@/lib/quotes/clientPortalToken';

export async function acceptClientQuotationInPortal(formData:FormData){
  const token=String(formData.get('token')||'');
  const access=verifyClientPortalToken(token);
  if(!access)redirect('/quote-response?result=invalid');
  const returnUrl='/client-portal?token='+encodeURIComponent(token);
  const name=String(formData.get('signatory_name')||'').trim();
  const email=String(formData.get('signatory_email')||'').trim().toLowerCase();
  if(name.length<2||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||
     formData.get('authority_attested')!=='yes'||process.env.OP_CONTRACTUAL_RELEASE_ENABLED!=='true')
    redirect(returnUrl+'&notice=acceptance_unavailable');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)redirect(returnUrl+'&notice=acceptance_unavailable');
  const db=createClient(url!,secret!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:issue,error:issueError}=await db.from('quote_issue_records')
    .select('organisation_id,client_response').eq('quote_id',access.quoteId)
    .eq('quote_revision',access.revision).maybeSingle();
  if(issueError||!issue||issue.client_response)
    redirect(returnUrl+'&notice=acceptance_unavailable');
  const {data:quote,error:quoteError}=await db.from('quotes')
    .select('status,valid_until').eq('organisation_id',issue.organisation_id)
    .eq('id',access.quoteId).eq('revision',access.revision).maybeSingle();
  if(quoteError||!quote||quote.status!=='issued'||!quote.valid_until||
      new Date(quote.valid_until+'T23:59:59Z').getTime()<Date.now())
    redirect(returnUrl+'&notice=acceptance_unavailable');
  const {error}=await db.rpc('op_record_authorised_public_quote_response',{
    p_quote_id:access.quoteId,p_quote_revision:access.revision,p_response:'accepted',
    p_signatory_name:name,p_signatory_email:email,p_authority_attested:true,
  });
  if(error)redirect(returnUrl+'&notice=acceptance_unavailable');
  redirect(returnUrl);
}
