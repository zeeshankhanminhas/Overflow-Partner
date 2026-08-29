import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyNurtureUnsubscribeToken } from '@/lib/notifications/unsubscribe';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase server credentials are not configured.');
  return createClient(url, key, { auth: { persistSession:false, autoRefreshToken:false } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organisationId = String(url.searchParams.get('organisationId') || '');
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
  const token = String(url.searchParams.get('token') || '');
  if (!organisationId || !email || !verifyNurtureUnsubscribeToken(organisationId, email, token)) {
    return new NextResponse('This unsubscribe link is invalid or expired.', { status: 400, headers: { 'Content-Type':'text/plain; charset=utf-8' } });
  }

  const supabase = admin();
  const now = new Date().toISOString();
  const { error } = await supabase.from('notification_preferences').upsert({
    organisation_id: organisationId,
    email,
    nurture_email_enabled: false,
    nurture_unsubscribed_at: now,
    updated_at: now,
  }, { onConflict:'organisation_id,email' });
  if (error) return new NextResponse('We could not update your email preference. Please reply to the latest email and ask us to unsubscribe you.', { status: 500, headers: { 'Content-Type':'text/plain; charset=utf-8' } });

  await supabase.from('notification_outbox').update({ status:'cancelled', updated_at:now })
    .eq('organisation_id', organisationId).eq('recipient_email', email).eq('category','nurture').in('status',['pending','failed']);

  return new NextResponse('You have been unsubscribed from Overflow Partner nurture emails. Transactional project emails are unaffected.', { status: 200, headers: { 'Content-Type':'text/plain; charset=utf-8' } });
}
