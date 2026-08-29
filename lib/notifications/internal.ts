import type { SupabaseClient } from '@supabase/supabase-js';
import { queueInternalLifecycleAlert } from '@/lib/notifications/scenarios';

function recipients() {
  return String(process.env.OVERFLOW_PARTNER_OPERATIONS_EMAILS || '')
    .split(',').map((value)=>value.trim().toLowerCase()).filter(Boolean);
}

export async function queueOperationsAlert(supabase:SupabaseClient,input:{
  organisationId:string; eventKey:string; subject:string; heading:string; message:string; actionUrl?:string;
  entityType?:string|null; entityId?:string|null; payload?:Record<string,unknown>; idempotencyKey?:string;
}) {
  const emails=recipients();
  const results=[];
  for(const email of emails){
    results.push(await queueInternalLifecycleAlert(supabase,{
      organisationId:input.organisationId,eventKey:input.eventKey,recipientEmail:email,subject:input.subject,
      heading:input.heading,message:input.message,actionUrl:input.actionUrl,entityType:input.entityType,entityId:input.entityId,
      payload:input.payload,idempotencyKey:input.idempotencyKey?`${input.idempotencyKey}:${email}`:undefined,
    }).catch(()=>null));
  }
  return results.filter(Boolean).length;
}
