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
  const { error } = await admin.rpc('op_record_public_quote_response', {
    p_quote_id: payload.quoteId,
    p_quote_revision: payload.revision,
    p_response: payload.response,
  });
  if (error) {
    const status = error.message.toLowerCase().includes('already') ? 'recorded' : 'unavailable';
    redirect(`/quote-response?result=${status}`);
  }
  const portalToken = createClientPortalToken(payload.quoteId, payload.revision);
  redirect(`/client-portal?token=${encodeURIComponent(portalToken)}`);
}
