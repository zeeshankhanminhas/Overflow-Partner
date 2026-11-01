'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { createClientPortalToken } from '@/lib/quotes/clientPortalToken';

export async function sendFreshPortalLink(formData: FormData) {
  const leadId=String(formData.get('lead_id')||'');
  const quoteId=String(formData.get('quote_id')||'');
  const target='/opos-next/cases/'+encodeURIComponent(leadId);
  let result='';
  try {
    const {supabase,organisationId,user,profile}=await requireUserContext();
    assertRole(profile.role,['owner','admin','commercial','business_development']);
    const {data:issue,error:issueError}=await supabase.from('quote_issue_records')
      .select('quote_revision,recipient_name,recipient_email,client_response')
      .eq('organisation_id',organisationId).eq('lead_id',leadId).eq('quote_id',quoteId).maybeSingle();
    if(issueError)throw issueError;
    if(!issue?.recipient_email||issue.client_response!=='accepted')throw new Error('Accepted quotation and authorised recipient required.');
    const {data:quote,error:quoteError}=await supabase.from('quotes')
      .select('revision,quote_number,status').eq('organisation_id',organisationId).eq('lead_id',leadId).eq('id',quoteId).maybeSingle();
    if(quoteError)throw quoteError;
    if(!quote||quote.revision!==issue.quote_revision||!['issued','accepted'].includes(quote.status))throw new Error('Quotation revision mismatch.');
    const origin=process.env.OP_ISOLATED_QA_BACKEND==='true' && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
    if(!origin)throw new Error('Public site URL is not configured.');
    const link=new URL('/client-portal',origin);
    link.searchParams.set('token',createClientPortalToken(quoteId,Number(quote.revision)));
    const requestId=String(formData.get('request_id')||'');
    if(!/^[0-9a-f-]{36}$/i.test(requestId))throw new Error('Refresh the case before requesting another link.');
    const outboxId=await queueLifecycleEmail(supabase,{
      organisationId,scenario:'quote.issued',recipientEmail:issue.recipient_email,
      recipientName:issue.recipient_name||'Client',
      subject:'Secure client portal access · '+quote.quote_number,
      actionUrl:link.toString(),
      payload:{heading:'Your secure client portal',message:'Your quotation is already accepted. Open the secure portal to continue.',actions:[{label:'Open client portal',url:link.toString()}]},
      entityType:'quote',entityId:quoteId,
      idempotencyKey:'quote:portal-access:'+quoteId+':'+quote.revision+':'+requestId,
    });
    if(!outboxId)throw new Error('Email is not enabled for this recipient.');
    const {error:auditError}=await supabase.rpc('op_record_activity',{
      p_organisation_id:organisationId,p_user_id:user.id,p_entity_type:'quote',p_entity_id:quoteId,
      p_event_type:'client_portal_access_requested',p_event_data:{revision:quote.revision,recipientEmail:issue.recipient_email,outboxId},
    });
    if(auditError)throw auditError;
    revalidatePath(target);
    result='Fresh portal link queued to the authorised recipient.';
  }catch(e){result='Unable to send portal link: '+(e instanceof Error?e.message:'Unexpected error');}
  redirect(target+'?'+(result.startsWith('Unable')?'error=':'success=')+encodeURIComponent(result));
}
