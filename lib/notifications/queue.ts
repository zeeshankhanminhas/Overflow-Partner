import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveCaseOwnership, resolveProspectOwnership, resolveLifecycleOwnership } from '@/lib/lifecycle/ownership';

export type NotificationCategory = 'transactional' | 'reminder' | 'nurture' | 'system';

export type QueueNotificationInput = {
  organisationId: string;
  eventKey: string;
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
  templateKey: string;
  payload?: Record<string, unknown>;
  entityType?: string | null;
  entityId?: string | null;
  category?: NotificationCategory;
  scheduledFor?: string;
  idempotencyKey?: string;
};

async function stillOwnsScheduledCommunication(supabase:SupabaseClient,input:QueueNotificationInput){
  const category=input.category||'transactional';
  if(!['reminder','nurture'].includes(category)||!input.entityType||!input.entityId)return true;
  const type=String(input.entityType).toLowerCase();
  if(type==='prospect'){
    const ownership=await resolveProspectOwnership(supabase,input.organisationId,input.entityId);
    return ownership.owner==='prospect';
  }
  if(type==='lead'||type==='case'){
    const ownership=await resolveCaseOwnership(supabase,input.organisationId,input.entityId);
    return ownership.owner==='case';
  }
  if(type==='quote'){
    const {data,error}=await supabase.from('quotes').select('lead_id').eq('organisation_id',input.organisationId).eq('id',input.entityId).maybeSingle();
    if(error)throw new Error(error.message);if(!data?.lead_id)return false;
    const ownership=await resolveCaseOwnership(supabase,input.organisationId,data.lead_id);
    return ownership.owner==='case';
  }
  if(type==='project'){
    const {data,error}=await supabase.from('projects').select('id,lead_id,status,project_stage').eq('organisation_id',input.organisationId).eq('id',input.entityId).maybeSingle();
    if(error)throw new Error(error.message);if(!data)return false;
    const ownership=resolveLifecycleOwnership({caseId:data.lead_id,projectId:data.id,projectStatus:data.status,projectStage:data.project_stage});
    return ownership.owner==='project';
  }
  return true;
}

export async function queueNotification(supabase: SupabaseClient, input: QueueNotificationInput) {
  if(!(await stillOwnsScheduledCommunication(supabase,input))) return null;
  const { data, error } = await supabase.rpc('op_enqueue_notification', {
    p_organisation_id: input.organisationId,
    p_event_key: input.eventKey,
    p_recipient_email: input.recipientEmail,
    p_recipient_name: input.recipientName || null,
    p_subject: input.subject,
    p_template_key: input.templateKey,
    p_payload: input.payload || {},
    p_entity_type: input.entityType || null,
    p_entity_id: input.entityId || null,
    p_category: input.category || 'transactional',
    p_scheduled_for: input.scheduledFor || new Date().toISOString(),
    p_idempotency_key: input.idempotencyKey || null,
  });
  if (error) throw new Error(`Notification could not be queued: ${error.message}`);
  return data as string | null;
}

export async function scheduleLeadNurture(supabase: SupabaseClient, input: {
  organisationId: string;
  leadId: string;
  email: string;
  name?: string | null;
  company?: string | null;
  actionUrl: string;
}) {
  const ownership=await resolveProspectOwnership(supabase,input.organisationId,input.leadId);
  if(ownership.owner!=='prospect')return 0;
  const { data, error } = await supabase.rpc('op_schedule_lead_nurture', {
    p_organisation_id: input.organisationId,
    p_lead_id: input.leadId,
    p_email: input.email,
    p_name: input.name || null,
    p_company: input.company || null,
    p_action_url: input.actionUrl,
  });
  if (error) throw new Error(`Nurture sequence could not be scheduled: ${error.message}`);
  return Number(data || 0);
}

export async function cancelEntityReminders(supabase: SupabaseClient, input: {
  organisationId: string;
  entityType: string;
  entityId: string;
  categories?: NotificationCategory[];
}) {
  const { data, error } = await supabase.rpc('op_cancel_notifications_for_entity', {
    p_organisation_id: input.organisationId,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_categories: input.categories || ['reminder', 'nurture'],
  });
  if (error) throw new Error(`Scheduled notifications could not be cancelled: ${error.message}`);
  return Number(data || 0);
}
