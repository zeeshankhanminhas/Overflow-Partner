import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderNotificationEmail } from '@/lib/notifications/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OutboxRow = {
  id: string;
  event_key: string;
  category: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  template_key: string;
  payload: Record<string, unknown>;
};

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

async function deliver(row: OutboxRow) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.');

  const { html, text } = renderNotificationEmail(row);
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `overflow-partner-${row.id}`,
    },
    body: JSON.stringify({
      from,
      to: [row.recipient_email],
      subject: row.subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      headers: {
        'X-Overflow-Partner-Event': row.event_key,
        'X-Overflow-Partner-Outbox': row.id,
      },
    }),
  });

  const body = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
  if (!response.ok || !body.id) {
    throw new Error(body.message || body.name || `Resend returned HTTP ${response.status}.`);
  }
  return body.id;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = adminClient();
    const { data, error } = await supabase.rpc('op_claim_notification_batch', { p_limit: 25 });
    if (error) throw new Error(error.message);

    const rows = (data || []) as OutboxRow[];
    const results: Array<{ id: string; status: 'sent' | 'failed'; error?: string }> = [];

    for (const row of rows) {
      try {
        const providerId = await deliver(row);
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
