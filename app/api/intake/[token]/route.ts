import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { autoReferSubmittedIntake } from '@/lib/acquisition/autoPartnerReferral';

const submissionSchema = z.object({
  description: z.string().trim().min(20).max(8000),
  deliverables: z.string().trim().min(5).max(4000),
  project_type: z.string().trim().min(2).max(180),
  discipline: z.string().trim().max(180).optional().default(''),
  software: z.string().trim().max(180).optional().default(''),
  drawing_count: z.coerce.number().int().min(0).max(100000).optional(),
  source_file_format: z.string().trim().max(180).optional().default(''),
  required_output_format: z.string().trim().max(180).optional().default(''),
  timeline: z.string().trim().max(120).optional().default(''),
  complexity: z.string().trim().max(120).optional().default(''),
  files_availability: z.string().trim().max(120).optional().default(''),
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
  if(process.env.VERCEL_ENV==='preview' && process.env.OP_ISOLATED_QA_BACKEND!=='true') return NextResponse.json({message:'Preview intake cannot access the shared production database.'},{status:503});
  if (session.status === 'invited') await supabase.from('intake_sessions').update({ status: 'opened', opened_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', session.id);
  const { data: submission } = await supabase.from('intake_submissions').select('*').eq('intake_session_id', session.id).maybeSingle();
  const { data: files } = await supabase.from('intake_files').select('id,original_filename,size_bytes,file_category,uploaded_at').eq('intake_session_id', session.id).order('uploaded_at');
  return NextResponse.json({ session: { id: session.id, status: session.status, expires_at: session.expires_at, prospect: session.prospects }, submission, files: files || [] });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if(process.env.VERCEL_ENV==='preview' && process.env.OP_ISOLATED_QA_BACKEND!=='true') return NextResponse.json({message:'Preview intake is disabled until an isolated QA database is configured.'},{status:503});
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
      timeline: payload.timeline || null, complexity: payload.complexity || null,
      files_availability: payload.files_availability || null,
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
      event_data: { intakeSessionId: session.id, drawingCount: payload.drawing_count ?? null, deadline: payload.deadline || null, timeline: payload.timeline || null, complexity: payload.complexity || null, filesAvailability: payload.files_availability || null } });

    await supabase.rpc('op_cancel_notifications_for_entity', { p_organisation_id: session.organisation_id, p_entity_type: 'prospect', p_entity_id: session.prospect_id, p_categories: ['reminder','nurture'] });
    // The two acquisition routes converge on the same customer receipt after Step 2.
    const recipientEmail = session.recipient_email || session.prospects?.email;
    if (recipientEmail) {
      try {
        await queueLifecycleEmail(supabase, {
          organisationId:session.organisation_id,scenario:'requirements.received',
          recipientEmail,recipientName:session.prospects?.contact_name || null,
          entityType:'prospect',entityId:session.prospect_id,
          payload:{company:session.prospects?.company_name || ''},
          idempotencyKey:'intake:received:client:' + session.id,
        });
      } catch (notificationError) {
        console.error('Technical intake customer receipt could not be queued', notificationError);
        await supabase.from('activity_events').insert({
          organisation_id:session.organisation_id,user_id:session.created_by,
          entity_type:'prospect',entity_id:session.prospect_id,event_type:'intake_customer_receipt_queue_failed',
          event_data:{intakeSessionId:session.id,retryRequired:true},
        });
      }
    }
    let partnerReferral: 'queued' | 'already_issued' | 'manual_required' | 'failed' = 'failed';
    let partnerReferralReason = '';
    try {
      const result = await autoReferSubmittedIntake(supabase, {
        organisationId:session.organisation_id,prospectId:session.prospect_id,sessionId:session.id,
        actorUserId:session.created_by,scopeSummary:payload.description,projectType:payload.project_type,
      });
      partnerReferral = result.status;
      partnerReferralReason = result.reason || '';
    } catch (referralError) {
      partnerReferralReason = referralError instanceof Error ? referralError.message : 'Unexpected handoff error';
      console.error('Automatic partner referral failed',referralError);
    }
    if (partnerReferral === 'manual_required' || partnerReferral === 'failed') {
      await supabase.from('prospects').update({
        next_action:'Partner review needs attention — select eligible partner or retry notification',
      }).eq('organisation_id',session.organisation_id).eq('id',session.prospect_id);
      await supabase.from('activity_events').insert({
        organisation_id:session.organisation_id,user_id:session.created_by,
        entity_type:'prospect',entity_id:session.prospect_id,
        event_type:'partner_referral_action_required',
        event_data:{intakeSessionId:session.id,reason:partnerReferralReason,referralStatus:partnerReferral},
      });
    }
    const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
    if (ownerEmail) {
      await supabase.rpc('op_enqueue_notification', {
        p_organisation_id: session.organisation_id,
        p_event_key: 'client.intake_submitted',
        p_recipient_email: ownerEmail,
        p_recipient_name: 'Overflow Partner',
        p_subject: `Technical assessment ${partnerReferral === 'queued' ? 'sent' : 'needs attention'} — ${session.prospects?.company_name || 'prospect'}`,
        p_template_key: 'internal_alert',
        p_payload: {
          heading:partnerReferral === 'queued' ? 'Partner assessment issued' : 'Partner assessment requires attention',
          message:partnerReferral === 'queued'
            ? 'Step 2 is complete and the approved execution partner has been invited through the secure partner portal.'
            : 'Step 2 is complete, but automatic partner referral requires operator attention. Check Opportunity 360 before moving forward.',
          actionLabel:'Open opportunity',actionUrl:(process.env.NEXT_PUBLIC_APP_URL || 'https://overflow-partner.vercel.app')+'/workspace/acquisition/'+session.prospect_id,
        },
        p_entity_type: 'prospect', p_entity_id: session.prospect_id, p_category: 'transactional',
        p_scheduled_for: now, p_idempotency_key: `intake:submitted:owner:${session.id}`,
      });
    }
    return NextResponse.json({ success: true, submitted_at: now, partner_referral: partnerReferral });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: error.issues[0]?.message || 'Please check the technical intake.' }, { status: 400 });
    console.error('Step 2 intake submission failed', error);
    return NextResponse.json({ message: 'The technical intake could not be submitted.' }, { status: 500 });
  }
}
