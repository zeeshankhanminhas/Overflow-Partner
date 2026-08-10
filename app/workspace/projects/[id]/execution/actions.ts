'use server';

import { createHash, randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';

const roles = ['owner','admin','operator','engineering','commercial'] as const;
const cadenceValues = ['milestone','daily','every_2_business_days','weekly','on_change'] as const;

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) || '').trim();
  if (!value) throw new Error(`${key.replaceAll('_',' ')} is required.`);
  return value;
}

function executionUrl(projectId: string, params: Record<string,string>) {
  return `/workspace/projects/${projectId}/execution?${new URLSearchParams(params).toString()}`;
}

function refresh(projectId: string) {
  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath(`/workspace/projects/${projectId}/execution`);
  revalidatePath('/workspace/projects');
}

async function audit(supabase:any, organisationId:string, userId:string, projectId:string, eventType:string, eventData:Record<string,unknown>) {
  await supabase.from('activity_events').insert({
    organisation_id: organisationId,
    entity_type: 'project',
    entity_id: projectId,
    user_id: userId,
    event_type: eventType,
    event_data: eventData,
  });
}

export async function saveExecutionAssignmentAction(formData: FormData) {
  const projectId = required(formData, 'project_id');
  let destination = `/workspace/projects/${projectId}/execution`;
  try {
    const partnerId = required(formData, 'partner_id');
    const contactEmail = required(formData, 'partner_contact_email').toLowerCase();
    const cadence = String(formData.get('reporting_cadence') || 'milestone');
    if (!cadenceValues.includes(cadence as (typeof cadenceValues)[number])) throw new Error('Invalid reporting cadence.');

    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, [...roles]);

    const [{ data: project, error: projectError }, { data: partner, error: partnerError }] = await Promise.all([
      supabase.from('projects').select('id,project_number,due_date').eq('organisation_id', organisationId).eq('id', projectId).single(),
      supabase.from('partners').select('id,company_name,status,nda_signed').eq('organisation_id', organisationId).eq('id', partnerId).single(),
    ]);
    if (projectError || !project) throw new Error(projectError?.message || 'Project not found.');
    if (partnerError || !partner) throw new Error(partnerError?.message || 'Execution Partner not found.');
    if (partner.status !== 'approved') throw new Error('Only an approved Execution Partner can be assigned to a Project.');
    if (!partner.nda_signed) throw new Error('The Execution Partner NDA must be confirmed before release.');

    const payload = {
      organisation_id: organisationId,
      project_id: projectId,
      partner_id: partnerId,
      scope_document_id: String(formData.get('scope_document_id') || '') || null,
      partner_contact_name: String(formData.get('partner_contact_name') || '').trim() || null,
      partner_contact_email: contactEmail,
      planned_start_date: String(formData.get('planned_start_date') || '') || null,
      committed_due_date: String(formData.get('committed_due_date') || '') || project.due_date || null,
      reporting_cadence: cadence,
      release_notes: String(formData.get('release_notes') || '').trim() || null,
      created_by: user.id,
    };

    const { data: existing, error: existingError } = await supabase.from('project_execution_assignments')
      .select('id,execution_state').eq('organisation_id', organisationId).eq('project_id', projectId).maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing) {
      if (!['not_released','awaiting_acknowledgement'].includes(String(existing.execution_state))) {
        throw new Error('Execution assignment is already active. Core partner identity cannot be replaced after commencement.');
      }
      const { error } = await supabase.from('project_execution_assignments').update(payload).eq('organisation_id', organisationId).eq('id', existing.id);
      if (error) throw new Error(error.message);
      await audit(supabase, organisationId, user.id, projectId, 'partner_execution.assignment_updated', { assignmentId: existing.id, partnerId, shadowMode: true });
    } else {
      const { data: assignment, error } = await supabase.from('project_execution_assignments').insert(payload).select('id').single();
      if (error || !assignment) throw new Error(error?.message || 'Execution assignment could not be created.');
      await audit(supabase, organisationId, user.id, projectId, 'partner_execution.assignment_created', { assignmentId: assignment.id, partnerId, shadowMode: true });
    }

    refresh(projectId);
    destination = executionUrl(projectId, { success: 'Partner execution assignment saved in shadow mode.' });
  } catch (error) {
    destination = executionUrl(projectId, { error: error instanceof Error ? error.message : 'Execution assignment could not be saved.' });
  }
  redirect(destination);
}

export async function generateExecutionLinkAction(formData: FormData) {
  const projectId = required(formData, 'project_id');
  let destination = `/workspace/projects/${projectId}/execution`;
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, [...roles]);

    const { data: assignment, error: assignmentError } = await supabase.from('project_execution_assignments')
      .select('id,project_id,partner_id,partner_contact_email,execution_state,committed_due_date')
      .eq('organisation_id', organisationId).eq('project_id', projectId).single();
    if (assignmentError || !assignment) throw new Error(assignmentError?.message || 'Create the execution assignment first.');
    if (['closed','cancelled'].includes(String(assignment.execution_state))) throw new Error('This execution assignment is no longer active.');

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const due = assignment.committed_due_date ? new Date(`${assignment.committed_due_date}T23:59:59Z`) : new Date();
    const minimumExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    due.setUTCDate(due.getUTCDate() + 30);
    const expiresAt = due.getTime() > minimumExpiry.getTime() ? due : minimumExpiry;

    await supabase.from('partner_execution_sessions')
      .update({ status: 'revoked' })
      .eq('organisation_id', organisationId)
      .eq('assignment_id', assignment.id)
      .in('status', ['invited','opened','active']);

    const { data: session, error: sessionError } = await supabase.from('partner_execution_sessions').insert({
      organisation_id: organisationId,
      assignment_id: assignment.id,
      project_id: projectId,
      partner_id: assignment.partner_id,
      recipient_email: assignment.partner_contact_email,
      token_hash: tokenHash,
      status: 'invited',
      expires_at: expiresAt.toISOString(),
      created_by: user.id,
    }).select('id').single();
    if (sessionError || !session) throw new Error(sessionError?.message || 'Secure execution session could not be created.');

    const now = new Date().toISOString();
    const { error: releaseError } = await supabase.from('project_execution_assignments').update({
      execution_state: assignment.execution_state === 'not_released' ? 'awaiting_acknowledgement' : assignment.execution_state,
      released_at: now,
    }).eq('organisation_id', organisationId).eq('id', assignment.id);
    if (releaseError) throw new Error(releaseError.message);

    await audit(supabase, organisationId, user.id, projectId, 'partner_execution.secure_link_issued', {
      assignmentId: assignment.id,
      sessionId: session.id,
      recipientEmail: assignment.partner_contact_email,
      expiresAt: expiresAt.toISOString(),
      shadowMode: true,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://overflow-partner.vercel.app';
    const link = `${baseUrl}/execution/${rawToken}`;
    refresh(projectId);
    destination = executionUrl(projectId, { success: 'Secure Partner Execution link generated.', execution_link: link });
  } catch (error) {
    destination = executionUrl(projectId, { error: error instanceof Error ? error.message : 'Execution link could not be generated.' });
  }
  redirect(destination);
}
