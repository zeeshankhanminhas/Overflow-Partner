import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const submissionSchema = z.object({
  description: z.string().trim().min(20).max(8000),
  deliverables: z.string().trim().min(5).max(4000),
  project_type: z.string().trim().min(2).max(180),
  discipline: z.string().trim().max(180).optional().default(''),
  software: z.string().trim().max(180).optional().default(''),
  drawing_count: z.coerce.number().int().min(0).max(100000).optional(),
  source_file_format: z.string().trim().max(180).optional().default(''),
  required_output_format: z.string().trim().max(180).optional().default(''),
  deadline: z.string().trim().optional().default(''),
  standards: z.string().trim().max(2000).optional().default(''),
  tolerances: z.string().trim().max(2000).optional().default(''),
  revision_status: z.string().trim().max(500).optional().default(''),
  special_instructions: z.string().trim().max(4000).optional().default(''),
});

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase server credentials are not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }

async function sessionForToken(token: string) {
  const supabase = admin();
  const { data, error } = await supabase.from('intake_sessions')
    .select('*, prospects(company_name,contact_name,email,project_type,requirement_summary)')
    .eq('token_hash', hashToken(token)).single();
  if (error || !data) return { supabase, session: null };
  if (new Date(data.expires_at).getTime() < Date.now() && !['submitted','converted'].includes(data.status)) {
    await supabase.from('intake_sessions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', data.id);
    return { supabase, session: null };
  }
  return { supabase, session: data };
}

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const { supabase, session } = await sessionForToken(token);
  if (!session) return NextResponse.json({ message: 'This technical intake link is invalid or has expired.' }, { status: 404 });
  if (session.status === 'invited') await supabase.from('intake_sessions').update({ status: 'opened', opened_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', session.id);
  const { data: submission } = await supabase.from('intake_submissions').select('*').eq('intake_session_id', session.id).maybeSingle();
  const { data: files } = await supabase.from('intake_files').select('id,original_filename,size_bytes,file_category,uploaded_at').eq('intake_session_id', session.id).order('uploaded_at');
  return NextResponse.json({ session: { id: session.id, status: session.status, expires_at: session.expires_at, prospect: session.prospects }, submission, files: files || [] });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const payload = submissionSchema.parse(await request.json());
    const { supabase, session } = await sessionForToken(token);
    if (!session) return NextResponse.json({ message: 'This technical intake link is invalid or has expired.' }, { status: 404 });
    if (['submitted','converted','cancelled'].includes(session.status)) return NextResponse.json({ message: 'This technical intake can no longer be changed.' }, { status: 409 });
    const now = new Date().toISOString();
    const record = {
      organisation_id: session.organisation_id, intake_session_id: session.id, prospect_id: session.prospect_id,
      description: payload.description, deliverables: payload.deliverables, project_type: payload.project_type,
      discipline: payload.discipline || null, software: payload.software || null, drawing_count: payload.drawing_count ?? null,
      source_file_format: payload.source_file_format || null, required_output_format: payload.required_output_format || null,
      deadline: payload.deadline || null, standards: payload.standards || null, tolerances: payload.tolerances || null,
      revision_status: payload.revision_status || null, special_instructions: payload.special_instructions || null,
      completion_percent: 100, submitted_at: now, updated_at: now,
    };
    const { error } = await supabase.from('intake_submissions').upsert(record, { onConflict: 'intake_session_id' });
    if (error) throw error;
    await supabase.from('intake_sessions').update({ status: 'submitted', started_at: session.started_at || now, submitted_at: now, updated_at: now }).eq('id', session.id);
    await supabase.from('prospects').update({ next_action: 'Review submitted technical intake and qualify prospect' }).eq('id', session.prospect_id);
    await supabase.from('activity_events').insert({ organisation_id: session.organisation_id, user_id: session.created_by,
      entity_type: 'prospect', entity_id: session.prospect_id, event_type: 'technical_intake_submitted',
      event_data: { intakeSessionId: session.id, drawingCount: payload.drawing_count ?? null, deadline: payload.deadline || null } });
    return NextResponse.json({ success: true, submitted_at: now });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: error.issues[0]?.message || 'Please check the technical intake.' }, { status: 400 });
    console.error('Step 2 intake submission failed', error);
    return NextResponse.json({ message: 'The technical intake could not be submitted.' }, { status: 500 });
  }
}
