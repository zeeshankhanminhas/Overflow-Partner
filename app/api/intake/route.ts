import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const intakeSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  work_email: z.string().trim().email().max(254),
  company: z.string().trim().min(2).max(180),
  project_type: z.string().trim().min(2).max(180),
  brief_requirement: z.string().trim().min(10).max(4000),
  source: z.string().trim().max(80).optional().default('Website'),
  pageUrl: z.string().trim().url().optional().or(z.literal('')),
  lead_id: z.string().trim().max(160).optional().or(z.literal('')),
});

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) throw new Error('Supabase server credentials are not configured.');
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getPublicBaseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, '');
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionHost) return `https://${productionHost.replace(/\/$/, '')}`;
  return new URL(request.url).origin;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character);
}

async function sendStep2Email(input: {
  recipientName: string;
  recipientEmail: string;
  company: string;
  intakeUrl: string;
  expiresAt: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Overflow Partner';
  const replyTo = process.env.BREVO_REPLY_TO_EMAIL || senderEmail;

  if (!apiKey || !senderEmail) {
    return { status: 'not_configured' as const, messageId: null, error: 'Brevo sender credentials are not configured.' };
  }

  const expiry = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/London',
  }).format(new Date(input.expiresAt));
  const safeName = escapeHtml(input.recipientName);
  const safeCompany = escapeHtml(input.company);

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      replyTo: replyTo ? { email: replyTo, name: senderName } : undefined,
      to: [{ email: input.recipientEmail, name: input.recipientName }],
      subject: 'Complete your engineering requirement — Step 2',
      htmlContent: `
        <div style="margin:0;background:#f3f1eb;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#171717">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d8d4ca">
            <div style="padding:26px 30px;border-bottom:3px solid #d94b37">
              <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em">Overflow Partner</div>
              <div style="margin-top:5px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6f6b63">Engineering capacity, controlled</div>
            </div>
            <div style="padding:34px 30px">
              <p style="margin:0 0 18px">Hello ${safeName},</p>
              <h1 style="margin:0 0 18px;font-size:28px;line-height:1.15;letter-spacing:-0.03em">Help us understand the engineering scope.</h1>
              <p style="margin:0 0 16px;line-height:1.65">Thank you for submitting the initial requirement for <strong>${safeCompany}</strong>.</p>
              <p style="margin:0 0 26px;line-height:1.65">The next step captures the technical details, expected deliverables, formats, standards and deadline so we can review the work accurately.</p>
              <a href="${input.intakeUrl}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:15px 22px;font-weight:700">Complete technical intake →</a>
              <p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#6f6b63">This secure link expires on ${expiry}. It is intended only for the recipient of this email.</p>
            </div>
            <div style="padding:20px 30px;border-top:1px solid #e5e1d8;font-size:12px;line-height:1.6;color:#77736b">Overflow Partner · UK engineering overflow support</div>
          </div>
        </div>`,
      textContent: `Hello ${input.recipientName},\n\nThank you for submitting the initial requirement for ${input.company}.\n\nPlease complete the secure technical intake here:\n${input.intakeUrl}\n\nThis link expires on ${expiry}.\n\nOverflow Partner`,
    }),
  });

  const responseBody = await response.json().catch(() => ({})) as { messageId?: string; message?: string; code?: string };
  if (!response.ok) {
    return {
      status: 'failed' as const,
      messageId: null,
      error: responseBody.message || responseBody.code || `Brevo request failed with status ${response.status}.`,
    };
  }
  return { status: 'sent' as const, messageId: responseBody.messageId || null, error: null };
}

export async function POST(request: Request) {
  try {
    const payload = intakeSchema.parse(await request.json());
    const supabase = getAdminClient();
    const { data: owners, error: ownerError } = await supabase.from('profiles')
      .select('id, organisation_id, role').in('role', ['owner', 'admin']).eq('is_active', true).limit(2);
    if (ownerError) throw ownerError;
    const owner = owners?.[0];
    if (!owner?.id || !owner.organisation_id) {
      return NextResponse.json({ success: false, message: 'Workspace ownership is not configured.' }, { status: 503 });
    }

    const notes = [payload.pageUrl ? `Submitted from: ${payload.pageUrl}` : '',
      payload.source ? `Campaign source: ${payload.source}` : ''].filter(Boolean).join('\n');

    const { data: prospect, error: prospectError } = await supabase.from('prospects').insert({
      organisation_id: owner.organisation_id,
      created_by: owner.id,
      assigned_to: owner.id,
      source: 'website',
      company_name: payload.company,
      contact_name: payload.full_name,
      email: payload.work_email,
      project_type: payload.project_type,
      requirement_summary: payload.brief_requirement,
      website_submission_id: payload.lead_id || null,
      status: 'identified',
      next_action: 'Step 2 technical intake invitation pending',
      notes: notes || null,
    }).select('id, created_at').single();
    if (prospectError) throw prospectError;

    await supabase.from('activity_events').insert({
      organisation_id: owner.organisation_id,
      user_id: owner.id,
      entity_type: 'prospect',
      entity_id: prospect.id,
      event_type: 'website_intake_created',
      event_data: {
        company: payload.company,
        contact_name: payload.full_name,
        project_type: payload.project_type,
        source: payload.source,
        structured: true,
      },
    }).throwOnError();

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: session, error: sessionError } = await supabase.from('intake_sessions').insert({
      organisation_id: owner.organisation_id,
      prospect_id: prospect.id,
      token_hash: tokenHash,
      status: 'invited',
      expires_at: expiresAt,
      created_by: owner.id,
      recipient_email: payload.work_email,
      email_status: 'pending',
    }).select('id').single();
    if (sessionError) throw sessionError;

    const intakeUrl = `${getPublicBaseUrl(request)}/intake/${rawToken}`;
    const delivery = await sendStep2Email({
      recipientName: payload.full_name,
      recipientEmail: payload.work_email,
      company: payload.company,
      intakeUrl,
      expiresAt,
    });

    const sentAt = delivery.status === 'sent' ? new Date().toISOString() : null;
    await supabase.from('intake_sessions').update({
      email_status: delivery.status,
      email_message_id: delivery.messageId,
      email_error: delivery.error,
      last_email_attempt_at: new Date().toISOString(),
      sent_at: sentAt,
    }).eq('id', session.id).throwOnError();

    const nextAction = delivery.status === 'sent'
      ? 'Await Step 2 technical intake submission'
      : 'Review and resend Step 2 technical intake invitation';
    await supabase.from('prospects').update({ next_action: nextAction }).eq('id', prospect.id).throwOnError();

    await supabase.from('activity_events').insert({
      organisation_id: owner.organisation_id,
      user_id: owner.id,
      entity_type: 'prospect',
      entity_id: prospect.id,
      event_type: delivery.status === 'sent' ? 'step_2_invitation_sent' : 'step_2_invitation_delivery_failed',
      event_data: {
        intakeSessionId: session.id,
        recipient: payload.work_email,
        emailStatus: delivery.status,
        messageId: delivery.messageId,
        error: delivery.error,
        expiresAt,
      },
    }).throwOnError();

    return NextResponse.json({
      success: true,
      submissionId: prospect.id,
      timestamp: prospect.created_at,
      step2: { created: true, emailStatus: delivery.status },
    });
  } catch (error) {
    console.error('Website intake failed', error);
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      const field = String(firstIssue?.path?.[0] || '');
      const messageByField: Record<string, string> = {
        full_name: 'Please enter your full name.',
        work_email: 'Please enter a valid work email address.',
        company: 'Please enter your company name.',
        project_type: 'Please select a project type.',
        brief_requirement: 'Brief requirement must contain at least 10 characters.',
        pageUrl: 'The submission page address is invalid. Please refresh and try again.',
      };
      return NextResponse.json({
        success: false,
        message: messageByField[field] || 'Please check the submitted details and try again.',
        field,
      }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'The requirement could not be submitted. Please try again shortly.' }, { status: 500 });
  }
}
