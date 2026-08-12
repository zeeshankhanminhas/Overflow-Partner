'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { cancelEntityReminders, queueNotification } from '@/lib/notifications/queue';
import {
  approveCommercialAndGenerateQuote,
  approveTechnicalIntake,
  createCommercialReviewFromPartnerQuote,
  ensureTechnicalIntakeShell,
} from '@/lib/orchestration/service';

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  if (!value) throw new Error(`${key.replaceAll('_', ' ')} is required.`);
  return value;
}
function message(error: unknown) { return error instanceof Error ? error.message : 'Workflow action failed.'; }
function refreshCase(leadId: string) {
  revalidatePath('/workspace'); revalidatePath('/workspace/leads'); revalidatePath(`/workspace/leads/${leadId}`);
  revalidatePath('/workspace/projects'); revalidatePath('/workspace/quotes'); revalidatePath('/workspace/documents');
}
function caseUrl(leadId: string, params: Record<string, string>) { return `/workspace/leads/${leadId}?${new URLSearchParams(params).toString()}`; }
function publicSiteUrl() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://overflow-partner.vercel.app';
  return base.startsWith('http') ? base.replace(/\/$/, '') : `https://${base.replace(/\/$/, '')}`;
}

async function leadRecipient(supabase: Awaited<ReturnType<typeof requireUserContext>>['supabase'], organisationId: string, leadId: string) {
  const { data } = await supabase.from('leads').select('contact_name,contact_email,company_name').eq('organisation_id', organisationId).eq('id', leadId).maybeSingle();
  return data as { contact_name?: string | null; contact_email?: string | null; company_name?: string | null } | null;
}

export async function createIntakeShellAction(formData: FormData) {
  const leadId = required(formData, 'lead_id'); let destination = `/workspace/leads/${leadId}`;
  try { const { supabase, organisationId, user } = await requireUserContext(); await ensureTechnicalIntakeShell(supabase, organisationId, user.id, leadId); refreshCase(leadId); destination = caseUrl(leadId, { success: 'Technical scope created from inherited case context.', resultStatus: 'Technical scope under review', focus:'record-next-action' }); }
  catch (error) { destination = caseUrl(leadId, { error: message(error), focus:'record-next-action' }); }
  redirect(destination);
}

export async function approveIntakeAction(formData: FormData) {
  const intakeId = required(formData, 'intake_id'); const suppliedLeadId = String(formData.get('lead_id') ?? '').trim(); let destination = suppliedLeadId ? `/workspace/leads/${suppliedLeadId}` : '/workspace/leads';
  try { const { supabase, organisationId, user } = await requireUserContext(); const intake = await approveTechnicalIntake(supabase, organisationId, user.id, intakeId); const leadId = suppliedLeadId || intake.lead_id; await cancelEntityReminders(supabase,{organisationId,entityType:'lead',entityId:leadId}).catch(()=>0); refreshCase(leadId); destination = caseUrl(leadId, { success: 'Technical scope approved. Scope of Work and Partner Technical Assessment are now the controlled commercial basis.', resultStatus: 'Control inherited partner evidence', focus:'record-documents' }); }
  catch (error) { destination = suppliedLeadId ? caseUrl(suppliedLeadId, { error: message(error), focus:'record-next-action' }) : `/workspace/leads?error=${encodeURIComponent(message(error))}`; }
  redirect(destination);
}

export async function createCommercialReviewAction(formData: FormData) {
  const partnerQuoteId = required(formData, 'partner_quote_id');
  const leadId = required(formData, 'lead_id');
  const markupPercent = Number(formData.get('markup_percent') ?? 30);
  const startPaymentPercent = Number(formData.get('start_payment_percent'));
  const paymentTermsDays = Number(formData.get('payment_terms_days') ?? 30);
  let destination = `/workspace/leads/${leadId}`;
  try {
    if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 500) throw new Error('Markup must be between 0 and 500.');
    if (!Number.isFinite(startPaymentPercent) || startPaymentPercent <= 0 || startPaymentPercent > 100) throw new Error('Client start payment must be greater than 0% and no more than 100%.');
    if (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365) throw new Error('Payment terms must be between 0 and 365 days.');
    const { supabase, organisationId, user } = await requireUserContext();
    await createCommercialReviewFromPartnerQuote(supabase, organisationId, user.id, partnerQuoteId, markupPercent, startPaymentPercent, paymentTermsDays);
    refreshCase(leadId);
    destination = caseUrl(leadId, { success: 'Commercial position and client start-payment terms recorded from the governed Partner cost.', resultStatus: 'Commercial decision required', focus:'record-next-action' });
  }
  catch (error) { destination = caseUrl(leadId, { error: message(error), focus:'record-next-action' }); }
  redirect(destination);
}

export async function approveCommercialAction(formData: FormData) {
  const reviewId = required(formData, 'commercial_review_id'); const leadId = required(formData, 'lead_id'); let destination = `/workspace/leads/${leadId}`;
  try { const { supabase, organisationId, user } = await requireUserContext(); const quote = await approveCommercialAndGenerateQuote(supabase, organisationId, user.id, reviewId, 'GBP', 20); refreshCase(leadId); destination = caseUrl(leadId, { success: `Draft quote ${quote.quote_number} generated with its canonical controlled Client Quote document. Approve that document before commercial issue.`, resultStatus: 'Controlled quotation required', quote: quote.id, focus:'record-documents' }); }
  catch (error) { destination = caseUrl(leadId, { error: message(error), focus:'record-next-action' }); }
  redirect(destination);
}

export async function issueQuoteAction(formData: FormData) {
  const quoteId=required(formData,'quote_id');const leadId=required(formData,'lead_id');let destination=`/workspace/leads/${leadId}`;
  try{
    const recipientName=required(formData,'recipient_name');const deliveryMethod=required(formData,'delivery_method');const evidenceReference=required(formData,'issue_evidence_reference');
    const recipientEmail=String(formData.get('recipient_email')||'').trim();const issueNote=String(formData.get('issue_note')||'').trim();
    const {supabase,organisationId,user}=await requireUserContext();
    const {data:quote,error}=await supabase.rpc('op_issue_quote_with_evidence',{
      p_organisation_id:organisationId,p_user_id:user.id,p_quote_id:quoteId,p_recipient_name:recipientName,p_recipient_email:recipientEmail||null,
      p_delivery_method:deliveryMethod,p_evidence_reference:evidenceReference,p_note:issueNote||null,
    });
    if(error)throw new Error(error.message);if(!quote?.id)throw new Error('Issued Client Quote was not returned.');

    const recipient=await leadRecipient(supabase,organisationId,leadId);
    if(recipient?.contact_email){
      // The Quote Issue Record proves transmission. Automated messages here are
      // follow-ups only; they are not treated as the commercial transmittal itself.
      const actionUrl=publicSiteUrl();const payload={name:recipient.contact_name,company:recipient.company_name,reference:quote.quote_number,validUntil:quote.valid_until,actionUrl};
      await queueNotification(supabase,{organisationId,eventKey:'quote.reminder.followup',recipientEmail:recipient.contact_email,recipientName:recipient.contact_name,subject:`A polite follow-up on quotation ${quote.quote_number}`,templateKey:'quote_reminder',payload,entityType:'quote',entityId:quote.id,category:'reminder',scheduledFor:new Date(Date.now()+3*24*60*60*1000).toISOString(),idempotencyKey:`quote:reminder:3d:${quote.id}:${quote.revision}`}).catch(()=>null);
      if(quote.valid_until){const validityReminder=new Date(`${quote.valid_until}T09:00:00Z`);validityReminder.setUTCDate(validityReminder.getUTCDate()-3);if(validityReminder.getTime()>Date.now())await queueNotification(supabase,{organisationId,eventKey:'quote.reminder.expiry',recipientEmail:recipient.contact_email,recipientName:recipient.contact_name,subject:`Quotation ${quote.quote_number} validity reminder`,templateKey:'quote_reminder',payload,entityType:'quote',entityId:quote.id,category:'reminder',scheduledFor:validityReminder.toISOString(),idempotencyKey:`quote:reminder:expiry:${quote.id}:${quote.revision}`}).catch(()=>null);}
    }
    refreshCase(leadId);destination=caseUrl(leadId,{success:`Quote ${quote.quote_number} issued with recorded transmission evidence. Written client acceptance is now required before Project 360.`,resultStatus:'Awaiting client decision',quote:quote.id,focus:'record-next-action'});
  }catch(error){destination=caseUrl(leadId,{error:message(error),focus:'record-next-action'});}
  redirect(destination);
}

export async function acceptQuoteAction(formData: FormData) {
  const quoteId = required(formData, 'quote_id');
  const leadId = required(formData, 'lead_id');
  let destination = `/workspace/leads/${leadId}`;
  try {
    const acceptanceBasis = required(formData, 'acceptance_basis');
    const evidenceReference = required(formData, 'evidence_reference');
    const acceptedByName = required(formData, 'accepted_by_name');
    const acceptedByEmail = String(formData.get('accepted_by_email') || '').trim();
    const acceptanceNotes = String(formData.get('acceptance_notes') || '').trim();
    const { supabase, organisationId, user } = await requireUserContext();
    const { data: project, error } = await supabase.rpc('op_accept_quote_create_project_with_acceptance', {
      p_organisation_id: organisationId,
      p_user_id: user.id,
      p_quote_id: quoteId,
      p_acceptance_basis: acceptanceBasis,
      p_evidence_reference: evidenceReference,
      p_accepted_by_name: acceptedByName,
      p_accepted_by_email: acceptedByEmail || null,
      p_notes: acceptanceNotes || null,
    });
    if (error) throw new Error(error.message);
    if (!project?.id) throw new Error('Project 360 was not returned after recording client acceptance.');
    await cancelEntityReminders(supabase,{organisationId,entityType:'quote',entityId:quoteId}).catch(()=>0);
    refreshCase(leadId);
    revalidatePath(`/workspace/projects/${project.id}`);
    destination = `/workspace/projects/${project.id}?created=${encodeURIComponent(`Project ${project.project_number} created from governed written client acceptance.`)}&focus=record-next-action`;
  }
  catch (error) { destination = caseUrl(leadId, { error: message(error), focus:'record-next-action' }); }
  redirect(destination);
}

export async function recordQuoteOutcomeAction(formData: FormData) {
  const quoteId = required(formData, 'quote_id'); const leadId = required(formData, 'lead_id'); const outcome = required(formData, 'outcome'); const note = String(formData.get('note') ?? '').trim(); let destination = `/workspace/leads/${leadId}`;
  try {
    if (!['rejected', 'expired', 'withdrawn'].includes(outcome)) throw new Error('Invalid quotation outcome.');
    const { supabase, organisationId, user } = await requireUserContext();
    const { data, error } = await supabase.rpc('op_record_quote_outcome', { p_organisation_id: organisationId, p_user_id: user.id, p_quote_id: quoteId, p_outcome: outcome, p_note: note || null });
    if (error) throw new Error(error.message);
    await cancelEntityReminders(supabase,{organisationId,entityType:'quote',entityId:quoteId}).catch(()=>0);
    refreshCase(leadId); destination = caseUrl(leadId, { success: `Quotation ${String(data?.quote_number || '')} marked ${outcome}.`, resultStatus: `Quote ${outcome}`, focus:'record-next-action' });
  } catch (error) { destination = caseUrl(leadId, { error: message(error), focus:'record-next-action' }); }
  redirect(destination);
}

export async function reviseQuoteAction(formData: FormData) {
  const quoteId = required(formData, 'quote_id'); const leadId = required(formData, 'lead_id'); const note = String(formData.get('note') ?? '').trim(); let destination = `/workspace/leads/${leadId}`;
  try {
    const { supabase, organisationId, user } = await requireUserContext();
    const { data, error } = await supabase.rpc('op_revise_quote', { p_organisation_id: organisationId, p_user_id: user.id, p_quote_id: quoteId, p_note: note || null });
    if (error) throw new Error(error.message);
    await cancelEntityReminders(supabase,{organisationId,entityType:'quote',entityId:quoteId}).catch(()=>0);
    refreshCase(leadId); destination = caseUrl(leadId, { success: `Quotation revision ${String(data?.revision || '')} opened. Previous controlled publication archived.`, resultStatus: 'Draft revision requires new controlled document', focus:'record-documents' });
  } catch (error) { destination = caseUrl(leadId, { error: message(error), focus:'record-next-action' }); }
  redirect(destination);
}
