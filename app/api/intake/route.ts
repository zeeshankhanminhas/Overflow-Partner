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

  if (!url || !serviceKey) {
    throw new Error('Supabase server credentials are not configured.');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  try {
    const payload = intakeSchema.parse(await request.json());
    const supabase = getAdminClient();

    const { data: owners, error: ownerError } = await supabase
      .from('profiles')
      .select('id, organisation_id, role')
      .in('role', ['owner', 'admin'])
      .limit(2);

    if (ownerError) throw ownerError;

    const owner = owners?.[0];
    if (!owner?.id || !owner.organisation_id) {
      return NextResponse.json(
        { success: false, message: 'Workspace ownership is not configured.' },
        { status: 503 },
      );
    }

    const notes = [
      `Project type: ${payload.project_type}`,
      payload.brief_requirement,
      payload.pageUrl ? `Submitted from: ${payload.pageUrl}` : '',
      payload.lead_id ? `Website submission ID: ${payload.lead_id}` : '',
    ].filter(Boolean).join('\n\n');

    const { data: prospect, error: prospectError } = await supabase
      .from('prospects')
      .insert({
        organisation_id: owner.organisation_id,
        created_by: owner.id,
        assigned_to: owner.id,
        source: 'website',
        company_name: payload.company,
        contact_name: payload.full_name,
        email: payload.work_email,
        status: 'identified',
        next_action: 'Review website requirement',
        notes,
      })
      .select('id, created_at')
      .single();

    if (prospectError) throw prospectError;

    await supabase.from('activity_log').insert({
      organisation_id: owner.organisation_id,
      actor_id: owner.id,
      entity_type: 'prospect',
      entity_id: prospect.id,
      action: 'website_intake_created',
      metadata: {
        company: payload.company,
        contact_name: payload.full_name,
        project_type: payload.project_type,
        source: payload.source,
      },
    });

    return NextResponse.json({
      success: true,
      submissionId: prospect.id,
      timestamp: prospect.created_at,
    });
  } catch (error) {
    console.error('Website intake failed', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Please check the submitted details and try again.' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: false, message: 'The requirement could not be submitted. Please try again shortly.' },
      { status: 500 },
    );
  }
}
