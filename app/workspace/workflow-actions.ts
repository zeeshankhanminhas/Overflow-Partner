'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { partnerSchema, partnerQuoteSchema, commercialReviewSchema, clientQuoteSchema, taskSchema } from '@/lib/validation/workflow';
import { createPartner, createPartnerQuote, createCommercialReview, createClientQuote, createTask } from '@/lib/repositories/workflow';
import { recordActivity } from '@/lib/repositories/activity';
import { assertCaseIsActive } from '@/lib/business/invariants';

const roles = ['owner', 'admin', 'operator', 'engineering', 'commercial', 'business_development'] as const;
const exceptionRoles = ['owner','admin'] as const;

async function run<T>(formData: FormData, config: { schema: { safeParse: (value: unknown) => any }; create: (ctx: any, input: any) => Promise<T>; entityType: string; eventType: string; path: string }) {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, [...roles]);
    const parsed = config.schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message || 'Invalid form data.' };
    const data = await config.create({ supabase, user, organisationId }, parsed.data);
    await recordActivity(supabase, { organisationId, entityType: config.entityType, entityId: (data as { id: string }).id, userId: user.id, eventType: config.eventType, newValue: data });
    revalidatePath(config.path); revalidatePath('/workspace');
    return { ok: true as const, data };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : 'Operation failed.' }; }
}

async function exceptionalContext(formData:FormData, kind:'partner_quote'|'commercial_review'|'client_quote'|'project'){
  const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...exceptionRoles]);
  const raw=Object.fromEntries(formData.entries());const leadId=String(raw.lead_id||'');if(!leadId)throw new Error('A governed Case is required for this administrative exception.');
  await assertCaseIsActive(supabase,organisationId,leadId);
  const note=String(raw.notes||'').trim();if(kind==='project'&&!note)throw new Error('Administrative Project creation requires an exception reason.');
  return {supabase,user,profile,organisationId,raw,leadId,note};
}

export async function createPartnerFormAction(formData: FormData) {
  const result = await run(formData, { schema: partnerSchema, create: ({ supabase, user, organisationId }, input) => createPartner(supabase, organisationId, user.id, input), entityType: 'partner', eventType: 'partner.created', path: '/workspace/partners' });
  redirect(result.ok ? '/workspace/partners?created=1' : `/workspace/partners?error=${encodeURIComponent(result.error)}`);
}

export async function createPartnerQuoteFormAction(formData: FormData) {
  try{
    const {supabase,user,organisationId,raw,leadId}=await exceptionalContext(formData,'partner_quote');
    const parsed=partnerQuoteSchema.safeParse(raw);if(!parsed.success)throw new Error(parsed.error.issues[0]?.message||'Invalid partner pricing data.');
    const {data:request,error:requestError}=await supabase.from('partner_review_requests').select('id,lead_id,status,partner_id').eq('organisation_id',organisationId).eq('id',parsed.data.partner_review_request_id).single();
    if(requestError||!request||request.lead_id!==leadId||request.partner_id!==parsed.data.partner_id)throw new Error('Partner pricing must belong to the active Case partner review.');
    if(!['submitted','approved','approved_with_conditions'].includes(String(request.status)))throw new Error('Partner pricing cannot be created before the governed partner response is received.');
    const {data:existing,error:existingError}=await supabase.from('partner_quotes').select('id,status').eq('organisation_id',organisationId).eq('lead_id',leadId).in('status',['requested','received','under_review','selected']).limit(1).maybeSingle();if(existingError)throw existingError;if(existing)throw new Error('Active partner pricing already exists for this Case.');
    const data=await createPartnerQuote(supabase,organisationId,user.id,parsed.data);await recordActivity(supabase,{organisationId,entityType:'partner_quote',entityId:data.id,userId:user.id,eventType:'partner_quote.exception_created',newValue:{...data,invariant:'ACTIVE_CASE_PARTNER_PRICING'}});revalidatePath('/workspace/partner-quotes');revalidatePath(`/workspace/leads/${leadId}`);revalidatePath('/workspace');redirect('/workspace/partner-quotes?created=1');
  }catch(error){redirect(`/workspace/partner-quotes?error=${encodeURIComponent(error instanceof Error?error.message:'Partner pricing exception failed.')}`)}
}

export async function createCommercialReviewFormAction(formData: FormData) {
  try{
    const {supabase,user,organisationId,raw,leadId}=await exceptionalContext(formData,'commercial_review');const parsed=commercialReviewSchema.safeParse(raw);if(!parsed.success)throw new Error(parsed.error.issues[0]?.message||'Invalid Commercial Review.');
    if(!parsed.data.partner_quote_id)throw new Error('Commercial Review requires governed partner pricing.');
    const {data:partnerQuote,error:pqError}=await supabase.from('partner_quotes').select('id,lead_id,status').eq('organisation_id',organisationId).eq('id',parsed.data.partner_quote_id).single();if(pqError||!partnerQuote||partnerQuote.lead_id!==leadId)throw new Error('Partner pricing does not belong to this active Case.');if(!['received','selected'].includes(partnerQuote.status))throw new Error('Commercial Review requires received or selected partner pricing.');
    const {data:existing,error:existingError}=await supabase.from('commercial_reviews').select('id').eq('organisation_id',organisationId).eq('lead_id',leadId).in('status',['draft','pending_approval','approved']).limit(1).maybeSingle();if(existingError)throw existingError;if(existing)throw new Error('An active Commercial Review already exists.');
    const data=await createCommercialReview(supabase,organisationId,user.id,parsed.data);await recordActivity(supabase,{organisationId,entityType:'commercial_review',entityId:data.id,userId:user.id,eventType:'commercial_review.exception_created',newValue:{...data,invariant:'PARTNER_PRICING_REQUIRED'}});revalidatePath('/workspace/commercial-reviews');revalidatePath(`/workspace/leads/${leadId}`);revalidatePath('/workspace');redirect('/workspace/commercial-reviews?created=1');
  }catch(error){redirect(`/workspace/commercial-reviews?error=${encodeURIComponent(error instanceof Error?error.message:'Commercial Review exception failed.')}`)}
}

export async function createClientQuoteFormAction(formData: FormData) {
  try{
    const {supabase,user,organisationId,raw,leadId}=await exceptionalContext(formData,'client_quote');const parsed=clientQuoteSchema.safeParse(raw);if(!parsed.success)throw new Error(parsed.error.issues[0]?.message||'Invalid Client Quote.');
    if(!parsed.data.commercial_review_id)throw new Error('Client Quote requires an approved Commercial Review.');
    const {data:review,error:reviewError}=await supabase.from('commercial_reviews').select('id,lead_id,status').eq('organisation_id',organisationId).eq('id',parsed.data.commercial_review_id).single();if(reviewError||!review||review.lead_id!==leadId)throw new Error('Commercial Review does not belong to this active Case.');if(review.status!=='approved')throw new Error('Client Quote requires an approved Commercial Review.');
    const {data:existing,error:existingError}=await supabase.from('quotes').select('id').eq('organisation_id',organisationId).eq('lead_id',leadId).in('status',['draft','internal_review','issued','accepted']).limit(1).maybeSingle();if(existingError)throw existingError;if(existing)throw new Error('An active Client Quote already exists. Revise it instead.');
    const safeInput={...parsed.data,status:'draft' as const};const data=await createClientQuote(supabase,organisationId,user.id,safeInput);await recordActivity(supabase,{organisationId,entityType:'quote',entityId:data.id,userId:user.id,eventType:'quote.exception_created',newValue:{...data,invariant:'APPROVED_COMMERCIAL_REVIEW_REQUIRED'}});revalidatePath('/workspace/quotes');revalidatePath(`/workspace/leads/${leadId}`);revalidatePath('/workspace');redirect('/workspace/quotes?created=1');
  }catch(error){redirect(`/workspace/quotes?error=${encodeURIComponent(error instanceof Error?error.message:'Client Quote exception failed.')}`)}
}

export async function createProjectFormAction() {
  redirect('/workspace/projects?error=' + encodeURIComponent('Project 360 can only be created from Case 360 after written client acceptance and confirmed opening payment.'));
}

export async function createTaskFormAction(formData: FormData) {
  const result = await run(formData, { schema: taskSchema, create: ({ supabase, user, organisationId }, input) => createTask(supabase, organisationId, user.id, input), entityType: 'task', eventType: 'task.created', path: '/workspace/tasks' });
  redirect(result.ok ? '/workspace/tasks?created=1' : `/workspace/tasks?error=${encodeURIComponent(result.error)}`);
}
