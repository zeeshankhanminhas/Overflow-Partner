import {randomBytes,createHash} from 'crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {queueLifecycleEmail} from '@/lib/notifications/scenarios';
export type ConfirmedEnquiry={
  full_name:string;work_email:string;company:string;project_type:string;
  brief_requirement:string;source?:string;pageUrl?:string;lead_id?:string;nurture_consent?:'true'|'false';
};
export async function finalizeVerifiedEnquiry(
 supabase:SupabaseClient,payload:ConfirmedEnquiry,
 owner:{id:string;organisation_id:string},publicOrigin:string
):Promise<{prospectId:string;invitationEmailStatus:'queued'|'failed'|'previously_received'}>{
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
      const created=await supabase.from('contacts').insert({organisation_id:owner.organisation_id,created_by:owner.id,company_id:company.id,full_name:payload.full_name,email:payload.work_email,lifecycle_status:'active'}).select('id,full_name').single();
      if(created.error)throw created.error;contact=created.data;
    }

    // Repeated submissions of the same active requirement must not create parallel opportunities.
    const { data: existing, error: existingError } = await supabase.from('prospects')
      .select('id,created_at').eq('organisation_id', owner.organisation_id)
      .eq('company_id', company.id).eq('contact_id', contact.id).eq('source', 'website')
      .eq('project_type', payload.project_type).eq('requirement_summary', payload.brief_requirement)
      .in('status', ['identified','contacted','conversation']).order('created_at', { ascending:false }).limit(1).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return { prospectId: existing.id, invitationEmailStatus: 'previously_received' as const };

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
      next_action: 'Prepare secure Step 2 requirements invitation',
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
        nurture_opt_in: payload.nurture_consent === 'true',
        consent_recorded_at: new Date().toISOString(),
        consent_capture: 'website_form',
      },
    }).throwOnError();

    // Inbound website customers have explicitly asked for engineering support.
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const { data: session, error: sessionError } = await supabase.from('intake_sessions').insert({
      organisation_id: owner.organisation_id, prospect_id: prospect.id,
      token_hash: tokenHash, status: 'invited', expires_at: expiresAt,
      created_by: owner.id, recipient_email: payload.work_email, email_status: 'pending',
    }).select('id').single();
    if (sessionError) throw sessionError;
    const actionUrl = publicOrigin + '/intake/' + token;
    const emailPayload = { company: payload.company, dueDate: new Date(expiresAt).toLocaleDateString('en-GB') };
    let step2EmailStatus: 'queued' | 'failed' = 'failed';
    try {
      const queued = await queueLifecycleEmail(supabase, {
        organisationId: owner.organisation_id, scenario: 'requirements.requested',
        recipientEmail: payload.work_email, recipientName: payload.full_name,
        actionUrl, payload: emailPayload, entityType: 'prospect', entityId: prospect.id,
        idempotencyKey: 'website:step2:' + session.id,
      });
      if (!queued) throw new Error('Step 2 message was not queued');
      step2EmailStatus = 'queued';
      await supabase.from('prospects').update({ next_action: 'Await Step 2 technical intake submission' })
        .eq('organisation_id', owner.organisation_id).eq('id', prospect.id).throwOnError();
      await supabase.from('activity_events').insert({
        organisation_id: owner.organisation_id, user_id: owner.id,
        entity_type: 'prospect', entity_id: prospect.id, event_type: 'technical_intake_invited',
        event_data: { intakeSessionId: session.id, expiresAt, delivery: 'queued_for_email', source: 'website' },
      }).throwOnError();
    } catch (error) {
      console.error('Website Step 2 invitation queue failed', error);
      await supabase.from('prospects').update({ next_action: 'Review and resend Step 2 technical intake invitation' })
        .eq('organisation_id', owner.organisation_id).eq('id', prospect.id);
      await supabase.from('activity_events').insert({
        organisation_id: owner.organisation_id, user_id: owner.id, entity_type: 'prospect',
        entity_id: prospect.id, event_type: 'step_2_invitation_delivery_failed',
        event_data: { intakeSessionId: session.id, retryRequired: true, source: 'website' },
      });
    }

 return {prospectId:prospect.id,invitationEmailStatus:step2EmailStatus};
}
