import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { scheduleInitialEnquiryNurture } from '@/lib/notifications/schedules';

const intakeSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  work_email: z.string().trim().email().max(254),
  company: z.string().trim().min(2).max(180),
  project_type: z.string().trim().min(2).max(180),
  brief_requirement: z.string().trim().min(10).max(4000),
  source: z.string().trim().max(80).optional().default('Website'),
  pageUrl: z.string().trim().url().optional().or(z.literal('')),
  lead_id: z.string().trim().max(160).optional().or(z.literal('')),
  nurture_consent: z.enum(['true','false']).optional().default('false'),
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

    const {data:matchedCompany,error:companyLookupError}=await supabase.from('companies').select('id,name').eq('organisation_id',owner.organisation_id).ilike('name',payload.company).limit(1).maybeSingle();
    if(companyLookupError)throw companyLookupError;
    let company=matchedCompany;
    if(!company){
      const created=await supabase.from('companies').insert({organisation_id:owner.organisation_id,created_by:owner.id,name:payload.company,lifecycle_status:'active'}).select('id,name').single();
      if(created.error)throw created.error;company=created.data;
    }
    const {data:matchedContact,error:contactLookupError}=await supabase.from('contacts').select('id,full_name').eq('organisation_id',owner.organisation_id).eq('company_id',company.id).ilike('email',payload.work_email).limit(1).maybeSingle();
    if(contactLookupError)throw contactLookupError;
    let contact=matchedContact;
    if(!contact){
      const created=await supabase.from('contacts').insert({organisation_id:owner.organisation_id,created_by:owner.id,company_id:company.id,full_name:payload.full_name,email:payload.work_email,lifecycle_status:'active',communication_status:'marketable'}).select('id,full_name').single();
      if(created.error)throw created.error;contact=created.data;
    }

    // Repeated submissions of the same active requirement must not create parallel opportunities.
    const { data: existing, error: existingError } = await supabase.from('prospects')
      .select('id,created_at').eq('organisation_id', owner.organisation_id)
      .eq('company_id', company.id).eq('contact_id', contact.id).eq('source', 'website')
      .eq('project_type', payload.project_type).eq('requirement_summary', payload.brief_requirement)
      .in('status', ['identified','contacted','conversation']).order('created_at', { ascending:false }).limit(1).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return NextResponse.json({ success:true, submissionId:existing.id, timestamp:existing.created_at, reused:true });

    const { data: prospect, error: prospectError } = await supabase.from('prospects').insert({
      organisation_id: owner.organisation_id,
      created_by: owner.id,
      assigned_to: owner.id,
      source: 'website',
      company_id: company.id,
      contact_id: contact.id,
      company_name: company.name,
      contact_name: contact.full_name,
      email: payload.work_email,
      project_type: payload.project_type,
      requirement_summary: payload.brief_requirement,
      website_submission_id: payload.lead_id || null,
      status: 'identified',
      next_action: 'Await customer interest before sending secure requirements form',
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

    // Website Step 1 is not yet permission to request detailed technical intake.
    // Send an acknowledgement. Schedule up to five nurture messages only on explicit opt-in.
    let acknowledgement = 'pending';
    const actionUrl = getPublicBaseUrl(request) + '/';
    try {
      await queueLifecycleEmail(supabase, {
        organisationId:owner.organisation_id,scenario:'enquiry.received',
        recipientEmail:payload.work_email,recipientName:payload.full_name,actionUrl,
        entityType:'prospect',entityId:prospect.id,
        payload:{company:payload.company},idempotencyKey:'website:ack:' + prospect.id,
      });
      acknowledgement = 'queued';
    } catch (notificationError) {
      acknowledgement = 'failed';
      console.error('Website enquiry acknowledgement queue failed', notificationError);
      await supabase.from('activity_events').insert({
        organisation_id:owner.organisation_id,user_id:owner.id,
        entity_type:'prospect',entity_id:prospect.id,event_type:'website_acknowledgement_failed',
        event_data:{retryRequired:true},
      });
    }
    if (payload.nurture_consent === 'true') {
      try {
        await scheduleInitialEnquiryNurture(supabase, {
          organisationId:owner.organisation_id,prospectId:prospect.id,email:payload.work_email,
          name:payload.full_name,company:payload.company,actionUrl,
        });
      } catch (notificationError) {
        console.error('Website nurture scheduling failed', notificationError);
      }
    }
    return NextResponse.json({
      success:true,submissionId:prospect.id,timestamp:prospect.created_at,
      acknowledgement,nurtureScheduled:payload.nurture_consent === 'true',
      step2:{created:false,emailStatus:'awaiting_interest'},
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
