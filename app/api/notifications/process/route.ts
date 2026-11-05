import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isKnownIsolatedQaBackend } from '@/lib/qa/isolation';
import {deliverNotificationEmail,type OutboxRow} from '@/lib/notifications/emailProvider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';



function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase notification-worker credentials are not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}



export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.VERCEL_ENV === 'preview' && (!isKnownIsolatedQaBackend() || process.env.OP_QA_EMAIL_SENDING_ENABLED !== 'true')) {
    return NextResponse.json({ error: 'OPOS-QA outbound worker is locked.' }, { status: 503 });
  }

  try {
    const supabase = adminClient();
    const { data, error } = await supabase.rpc('op_claim_notification_batch', { p_limit: 25 });
    if (error) throw new Error(error.message);

    const rows = (data || []) as OutboxRow[];
    const results: Array<{ id: string; status: 'sent' | 'failed'; error?: string }> = [];

    for (const row of rows) {
      try {
        const providerId = await deliverNotificationEmail(row);
        const { error: completeError } = await supabase.rpc('op_complete_notification', {
          p_id: row.id,
          p_provider_message_id: providerId,
        });
        if (completeError) throw new Error(completeError.message);
        results.push({ id: row.id, status: 'sent' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown notification delivery failure.';
        await supabase.rpc('op_fail_notification', { p_id: row.id, p_error: message });
        results.push({ id: row.id, status: 'failed', error: message });
      }
    }

    return NextResponse.json({ processed: rows.length, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Notification worker failed.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
