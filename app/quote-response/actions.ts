'use server';

import { redirect } from 'next/navigation';
import { verifyClientResponseToken } from '@/lib/quotes/clientResponseToken';
import { createClientPortalToken } from '@/lib/quotes/clientPortalToken';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Quote response service is temporarily unavailable.');
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function recordClientQuoteResponse(formData: FormData) {
  const token = String(formData.get('token') || '');
  const payload = verifyClientResponseToken(token);
  if (!payload) redirect('/quote-response?result=invalid');
  const admin = adminClient();
  const signatoryName=String(formData.get('signatory_name')||'').trim();
  const signatoryEmail=String(formData.get('signatory_email')||'').trim().toLowerCase();
  const authorityAttested=formData.get('authority_attested')==='yes';
  if (payload.response==='accepted' && (!signatoryName || !signatoryEmail || !authorityAttested)) {
    redirect('/quote-response?result=unavailable');
  }
  const { error } = await admin.rpc('op_record_authorised_public_quote_response', {
    p_quote_id: payload.quoteId,
    p_quote_revision: payload.revision,
    p_response: payload.response,
    p_signatory_name: payload.response==='accepted' ? signatoryName : null,
    p_signatory_email: payload.response==='accepted' ? signatoryEmail : null,
    p_authority_attested: payload.response==='accepted' && authorityAttested,
  });
  if (error) {
    // A repeated action must never mutate an already-recorded response.
    // The status portal remains available from the original quotation email.
    redirect('/quote-response?result=unavailable');
  }
  const portalToken = createClientPortalToken(payload.quoteId, payload.revision);
  redirect(`${payload.response === 'accepted' && process.env.OP_PACKAGE01_PAYMENTS_ENABLED === 'true' ? '/quote-payment' : '/client-portal'}?token=${encodeURIComponent(portalToken)}`);
}
