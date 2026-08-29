import type { SupabaseClient } from '@supabase/supabase-js';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { nurtureUnsubscribeUrl } from '@/lib/notifications/unsubscribe';

const daysFromNow = (days:number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

export async function scheduleInitialEnquiryNurture(supabase:SupabaseClient,input:{
  organisationId:string; prospectId:string; email:string; name?:string|null; company?:string|null; actionUrl:string;
}) {
  const unsubscribeUrl=nurtureUnsubscribeUrl(input.organisationId,input.email);
  const schedule=[
    ['enquiry.nurture.day2',2],['enquiry.nurture.day5',5],['enquiry.nurture.day10',10],['enquiry.nurture.day18',18],['enquiry.nurture.day30',30],
  ] as const;
  const results=[];
  for(const [scenario,days] of schedule){
    results.push(await queueLifecycleEmail(supabase,{
      organisationId:input.organisationId,scenario,recipientEmail:input.email,recipientName:input.name,
      entityType:'prospect',entityId:input.prospectId,actionUrl:input.actionUrl,
      payload:{company:input.company,unsubscribeUrl},scheduledFor:daysFromNow(days),idempotencyKey:`prospect:${scenario}:${input.prospectId}`,
    }));
  }
  return results.filter(Boolean).length;
}

export async function scheduleDormantOpportunityNurture(supabase:SupabaseClient,input:{
  organisationId:string; opportunityId:string; email:string; name?:string|null; company?:string|null; actionUrl:string; reference?:string|null;
}) {
  const unsubscribeUrl=nurtureUnsubscribeUrl(input.organisationId,input.email);
  const schedule=[
    ['dormant_opportunity.day30',30],['dormant_opportunity.day60',60],['dormant_opportunity.day90',90],['dormant_opportunity.day180',180],
  ] as const;
  const results=[];
  for(const [scenario,days] of schedule){
    results.push(await queueLifecycleEmail(supabase,{
      organisationId:input.organisationId,scenario,recipientEmail:input.email,recipientName:input.name,
      entityType:'lead',entityId:input.opportunityId,actionUrl:input.actionUrl,
      payload:{company:input.company,reference:input.reference,unsubscribeUrl},scheduledFor:daysFromNow(days),idempotencyKey:`opportunity:${scenario}:${input.opportunityId}`,
    }));
  }
  return results.filter(Boolean).length;
}
