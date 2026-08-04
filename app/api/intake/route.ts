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

    const notes = [
      payload.pageUrl ? `Submitted from: ${payload.pageUrl}` : '',
      payload.source ? `Campaign source: ${payload.source}` : '',
    ].filter(Boolean).join('\n');

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

    let step2: { created: boolean; emailStatus: string; error?: string } = {
      created: false,
      emailStatus: 'pending',
    };

    try {
      const { data, error } = await supabase.functions.invoke('send-step-2-invitation', {
        body: {
          prospectId: prospect.id,
          organisationId: owner.organisation_id,
          actorUserId: owner.id,
          recipientEmail: payload.work_email,
          recipientName: payload.full_name,
          companyName: payload.company,
          projectType: payload.project_type,
          publicBaseUrl: getPublicBaseUrl(request),
        },
      });
      if (error) throw error;
      step2 = {
        created: Boolean(data?.sessionId),
        emailStatus: String(data?.emailStatus || 'pending'),
      };
    } catch (orchestrationError) {
      const message = orchestrationError instanceof Error ? orchestrationError.message : 'Step 2 orchestration failed.';
      console.error('Step 2 orchestration failed after prospect creation', orchestrationError);
      await supabase.from('prospects').update({
        next_action: 'Create and send Step 2 technical intake invitation manually',
      }).eq('id', prospect.id);
      await supabase.from('activity_events').insert({
        organisation_id: owner.organisation_id,
        user_id: owner.id,
        entity_type: 'prospect',
        entity_id: prospect.id,
        event_type: 'step_2_orchestration_failed',
        event_data: { error: message },
      });
      step2 = { created: false, emailStatus: 'failed', error: message };
    }

    return NextResponse.json({
      success: true,
      submissionId: prospect.id,
      timestamp: prospect.created_at,
      step2,
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
