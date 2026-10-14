'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { assertRole, requireUserContext } from '@/lib/auth/context';
import { cancelEntityReminders } from '@/lib/notifications/queue';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { renderNotificationEmail } from '@/lib/notifications/templates';
import { scheduleDormantOpportunityNurture } from '@/lib/notifications/schedules';
import { createClientQuotePdf } from '@/lib/quotes/clientQuotePdf';
import { createClientPortalToken } from '@/lib/quotes/clientPortalToken';
import { createClientResponseToken, type ClientQuoteResponse } from '@/lib/quotes/clientResponseToken';
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
function publicSiteUrl(path='') {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://overflow-partner.vercel.app';
  const root = base.startsWith('http') ? base.replace(/\/$/, '') : `https://${base.replace(/\/$/, '')}`;
  return `${root}${path}`;
}

async function leadRecipient(supabase: Awaited<ReturnType<typeof requireUserContext>>['supabase'], organisationId: string, leadId: string) {
  const { data } = await supabase.from('leads').select('contact_name,contact_email,company_name,reference').eq('organisation_id', organisationId).eq('id', leadId).maybeSingle();
  return data as { contact_name?: string | null; contact_email?: string | null; company_name?: string | null; reference?:string|null } | null;
}

function notificationAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server notification credentials are not configured.');
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function quoteMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value || 0));
}

async function sendClientQuoteEmail({ supabase, organisationId, quoteId, leadId, recipientEmail, recipientName, companyName, deliveryKind = 'issue', resendRequestId }:{
  supabase: Awaited<ReturnType<typeof requireUserContext>>['supabase']; organisationId: string; quoteId: string; leadId: string;
  recipientEmail: string; recipientName: string; companyName: string | null; deliveryKind?: 'issue' | 'resend'; resendRequestId?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Quotation email is unavailable because the email sender is not configured.');

  const [quoteResult, documentResult, intakeResult, lineItemsResult] = await Promise.all([
    supabase.from('quotes').select('id,lead_id,commercial_review_id,quote_number,revision,status,subtotal,vat,total,currency,valid_until').eq('organisation_id', organisationId).eq('id', quoteId).eq('lead_id', leadId).maybeSingle(),
    supabase.from('documents').select('id,status,is_current_revision').eq('organisation_id', organisationId).eq('quote_id', quoteId).eq('document_type', 'client-quote').eq('is_current_revision', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('technical_intakes').select('description,deliverables,deadline').eq('organisation_id', organisationId).eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('quote_line_items').select('sequence_no,description,quantity,unit,unit_price,net_total').eq('organisation_id', organisationId).eq('quote_id', quoteId).order('sequence_no', { ascending: true }),
  ]);
  const { data: quote, error: quoteError } = quoteResult;
  const { data: document, error: documentError } = documentResult;
  const { data: intake, error: intakeError } = intakeResult;
  const { data: lineItems, error: lineItemsError } = lineItemsResult;
  if (quoteError) throw new Error(quoteError.message);
  if (documentError) throw new Error(documentError.message);
  if (!quote || (deliveryKind === 'issue' && !['draft','internal_review'].includes(String(quote.status))) || (deliveryKind === 'resend' && quote.status !== 'issued')) throw new Error(deliveryKind === 'resend' ? 'Only the current issued Client Quote can be resent.' : 'Only a current draft Client Quote can be sent.');
  if (deliveryKind === 'resend') {
    if (!resendRequestId || !/^[0-9a-f-]{36}$/i.test(resendRequestId)) throw new Error('Refresh the Case before resending this Client Quote.');
    const { data: issue, error: issueError } = await supabase.from('quote_issue_records').select('quote_revision,recipient_email,client_response').eq('organisation_id', organisationId).eq('quote_id', quoteId).eq('lead_id', leadId).maybeSingle();
    if (issueError) throw new Error(issueError.message);
    if (!issue || Number(issue.quote_revision) !== Number(quote.revision)) throw new Error('The current quote revision has no matching issue record and cannot be resent.');
    if (issue.client_response) throw new Error('The client has already responded to this quotation.');
    if (String(issue.recipient_email || '').toLowerCase() !== recipientEmail.toLowerCase()) throw new Error('Resending is limited to the original quotation recipient.');
  }
  if (!document || !['approved','issued','published'].includes(String(document.status))) throw new Error('Approve the current Client Quote document before sending it.');
  if (!quote.valid_until) throw new Error('Record the quotation expiry date before sending the Client Quote.');
  if (deliveryKind === 'resend' && new Date(`${quote.valid_until}T23:59:59Z`).getTime() < Date.now()) throw new Error('This quotation has expired. Create and approve a new revision before sending it again.');
  if (intakeError) throw new Error(intakeError.message);
  if (lineItemsError) throw new Error(lineItemsError.message);

  let clientTerms: {commercial_assumptions?:string|null;exclusions?:string|null;payment_terms?:string|null;delivery_commitment?:string|null}|null = null;
  if (quote.commercial_review_id) {
    const {data:review,error:reviewError}=await supabase.from('commercial_reviews').select('partner_quote_id').eq('organisation_id',organisationId).eq('id',quote.commercial_review_id).maybeSingle();
    if(reviewError)throw new Error(reviewError.message);
    if(review?.partner_quote_id){const {data:terms,error:termsError}=await supabase.from('partner_quotes').select('commercial_assumptions,exclusions,payment_terms,delivery_commitment').eq('organisation_id',organisationId).eq('id',review.partner_quote_id).maybeSingle();if(termsError)throw new Error(termsError.message);clientTerms=terms;}
  }

  const currency = String(quote.currency || 'GBP').trim().toUpperCase();
  const facts: Array<{label:string;value:string}> = [
    { label: 'Quotation reference', value: `${quote.quote_number} · Revision ${quote.revision}` },
    ...(companyName ? [{ label: 'Client', value: companyName }] : []),
    ...(intake?.description ? [{ label: 'Scope', value: String(intake.description) }] : []),
    ...(intake?.deliverables ? [{ label: 'Deliverables', value: String(intake.deliverables) }] : []),
    ...(intake?.deadline ? [{ label: 'Required by', value: new Date(`${intake.deadline}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC' }) }] : []),
    ...(clientTerms?.commercial_assumptions ? [{label:'Assumptions',value:String(clientTerms.commercial_assumptions)}] : []),
    ...(clientTerms?.exclusions ? [{label:'Exclusions',value:String(clientTerms.exclusions)}] : []),
    ...(clientTerms?.delivery_commitment ? [{label:'Delivery commitment',value:String(clientTerms.delivery_commitment)}] : []),
    ...(clientTerms?.payment_terms ? [{label:'Payment terms',value:String(clientTerms.payment_terms)}] : []),
    ...((lineItems || []).map((item, index) => ({
      label: `Price item ${index + 1}`,
      value: `${item.description} · ${item.quantity} ${item.unit} · ${quoteMoney(item.net_total, currency)} net`,
    }))),
    { label: 'Subtotal', value: quoteMoney(quote.subtotal, currency) },
    { label: 'VAT', value: quoteMoney(quote.vat, currency) },
    { label: 'Total', value: quoteMoney(quote.total, currency) },
    { label: 'Valid until', value: new Date(`${quote.valid_until}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC' }) },
  ];
  const pdf = await createClientQuotePdf({
    reference: String(quote.quote_number), revision: Number(quote.revision), clientName: companyName, recipientName,
    validUntil: String(quote.valid_until), scope: intake?.description ? String(intake.description) : null,
    deliverables: intake?.deliverables ? String(intake.deliverables) : null, requiredBy: intake?.deadline ? String(intake.deadline) : null,
    assumptions:clientTerms?.commercial_assumptions, exclusions:clientTerms?.exclusions, paymentTerms:clientTerms?.payment_terms, deliveryCommitment:clientTerms?.delivery_commitment,
    currency, subtotal: Number(quote.subtotal), vat: Number(quote.vat), total: Number(quote.total),
    lineItems: (lineItems || []).map((item) => ({ description: String(item.description), quantity: Number(item.quantity), unit: String(item.unit), netTotal: Number(item.net_total) })),
  });
  const expiry = new Date(`${quote.valid_until}T23:59:59Z`).getTime();
  const responseLinks: { label: string; url: string }[] = [
    { label: 'Accept and proceed', response: 'accepted' },
    { label: 'Decline quote', response: 'declined' },
    { label: 'Need more time', response: 'more_time' },
  ].map(({ label, response }) => {
    const token = createClientResponseToken({ quoteId, revision: Number(quote.revision), response: response as ClientQuoteResponse, exp: expiry });
    return { label, url: publicSiteUrl(`/quote-response?token=${encodeURIComponent(token)}`) };
  });
  const subject = `Client Quote ${quote.quote_number} · Overflow Partner`;
  const message = `This email contains the approved Client Quote for ${companyName || 'your requirement'}. The scope, deliverables, price and validity below form the quotation.\n\nReply to this email with written acceptance before the expiry date, or tell us what you would like changed. We will confirm the agreed payment or purchase-order condition before project setup.`;
  const portalUrl = publicSiteUrl(`/client-portal?token=${encodeURIComponent(createClientPortalToken(quoteId, Number(quote.revision)))}`);
  const payload = { company: companyName, reference: quote.quote_number, validUntil: quote.valid_until, heading: 'Your Client Quote is ready', message: `${message}\n\nYou can return to your private client portal to see the latest quotation and project status: ${portalUrl}`, clientQuoteFacts: facts, actions: [{label:'Open your client portal',url:portalUrl},...responseLinks] };
  const outboxId = await queueLifecycleEmail(supabase, {
    organisationId, scenario: 'quote.issued', recipientEmail, recipientName, subject,
    actionUrl: publicSiteUrl(), payload, entityType: 'quote', entityId: quoteId,
    idempotencyKey: deliveryKind === 'resend' ? `quote:resend:${quoteId}:${quote.revision}:${resendRequestId}` : `quote:issued:${quoteId}:${quote.revision}`,
  });
  if (!outboxId) throw new Error('Transactional email is disabled for this recipient. The quote was not issued.');

  const admin = notificationAdminClient();
  const { data: existing, error: existingError } = await admin.from('notification_outbox').select('status,provider_message_id,attempts,locked_at').eq('id', outboxId).maybeSingle();
  if (existingError || !existing) throw new Error(existingError?.message || 'Quotation delivery record could not be loaded.');
  if (existing.status !== 'sent') {
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    if (existing.status === 'processing' && (!existing.locked_at || new Date(existing.locked_at).getTime() >= Date.now() - 15 * 60 * 1000)) {
      throw new Error('Quotation email delivery is already being processed. Wait briefly and refresh before trying again.');
    }
    let lockQuery = admin.from('notification_outbox').update({ status: 'processing', attempts: Number(existing.attempts || 0) + 1, locked_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null }).eq('id', outboxId);
    lockQuery = existing.status === 'processing'
      ? lockQuery.eq('status', 'processing').lt('locked_at', staleBefore)
      : lockQuery.in('status', ['pending','failed','cancelled']);
    const { data: locked, error: lockError } = await lockQuery.select('id').maybeSingle();
    if (lockError) throw new Error(`Quotation email could not be prepared: ${lockError.message}`);
    if (!locked) throw new Error('Quotation email delivery has already started. Refresh the Case before trying again.');
    const { html, text } = await renderNotificationEmail({
      event_key: 'quote.issued', category: 'transactional', recipient_name: recipientName,
      subject, template_key: 'quote', payload: { actionLabel: 'Reply about this quotation', actionUrl: publicSiteUrl(), ...payload },
    });
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `overflow-partner-${outboxId}` },
        body: JSON.stringify({
          from, to: [recipientEmail], subject, html, text,
          attachments: [{ filename: `${quote.quote_number}-R${quote.revision}-Client-Quote.pdf`, content: pdf.toString('base64'), content_type: 'application/pdf' }],
          ...(process.env.RESEND_REPLY_TO_EMAIL ? { reply_to: process.env.RESEND_REPLY_TO_EMAIL } : {}),
          headers: { 'X-Overflow-Partner-Event': 'quote.issued', 'X-Overflow-Partner-Outbox': outboxId },
        }),
      });
      const body = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
      if (!response.ok || !body.id) throw new Error(body.message || body.name || `Email provider returned HTTP ${response.status}.`);
      const sentAt = new Date().toISOString();
      const { error: completeError } = await admin.from('notification_outbox').update({ status: 'sent', provider_message_id: body.id, sent_at: sentAt, locked_at: null, last_error: null, updated_at: sentAt }).eq('id', outboxId);
      if (completeError) throw new Error(`Email was accepted by the provider, but its delivery record could not be updated: ${completeError.message}`);
      return { quote, providerMessageId: body.id };
    } catch (error) {
      await admin.from('notification_outbox').update({ status: 'cancelled', locked_at: null, last_error: error instanceof Error ? error.message : 'Quotation email could not be delivered.', updated_at: new Date().toISOString() }).eq('id', outboxId);
      throw error;
    }
  }
  return { quote, providerMessageId: existing.provider_message_id || outboxId };
}

export async function createIntakeShellAction(formData: FormData) {
  const leadId = required(formData, 'lead_id'); let destination = `/workspace/leads/${leadId}`;
  try { const { supabase, organisationId, user } = await requireUserContext(); await ensureTechnicalIntakeShell(supabase, organisationId, user.id, leadId); refreshCase(leadId); destination = caseUrl(leadId, { success: 'Technical scope created from inherited case context.', resultStatus: 'Technical scope under review', focus:'record-next-action' }); }
  catch (error) { destination = caseUrl(leadId, { error: message(error), focus:'record-next-action' }); }
  redirect(destination);
}

export async function approveIntakeAction(formData: FormData) {
  const intakeId = required(formData, 'intake_id'); const suppliedLeadId = String(formData.get('lead_id') ?? '').trim(); let destination = suppliedLeadId ? `/workspace/leads/${suppliedLeadId}` : '/workspace/leads';
  try { const { supabase, organisationId, user } = await requireUserContext(); const intake = await approveTechnicalIntake(supabase, organisationId, user.id, intakeId); const leadId = suppliedLeadId || intake.lead_id; await cancelEntityReminders(supabase,{organisationId,entityType:'lead',entityId:leadId}).catch(()=>0); refreshCase(leadId); destination = caseUrl(leadId, { success: 'Technical Scope approved. It and the inherited Partner Assessment are the controlled commercial basis.', resultStatus: 'Control inherited partner evidence', focus:'record-documents' }); }
  catch (error) { destination = suppliedLeadId ? caseUrl(suppliedLeadId, { error: message(error), focus:'record-next-action' }) : `/workspace/leads?error=${encodeURIComponent(message(error))}`; }
  redirect(destination);
}

export async function createCommercialReviewAction(formData: FormData) {
  const partnerQuoteId = required(formData, 'partner_quote_id'); const leadId = required(formData, 'lead_id'); const markupPercent = Number(formData.get('markup_percent') ?? 30); let destination = `/workspace/leads/${leadId}`;
  try { if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 500) throw new Error('Markup must be between 0 and 500.'); const { supabase, organisationId, user } = await requireUserContext(); await createCommercialReviewFromPartnerQuote(supabase, organisationId, user.id, partnerQuoteId, markupPercent); refreshCase(leadId); destination = caseUrl(leadId, { success: 'Commercial position calculated from the governed partner cost.', resultStatus: 'Commercial decision required', focus:'record-next-action' }); }
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
    const recipientName=required(formData,'recipient_name');const deliveryMethod='external_email';
    const suppliedEmail=String(formData.get('recipient_email')||'').trim();const issueNote=String(formData.get('issue_note')||'').trim();
    const {supabase,organisationId,user,profile}=await requireUserContext();
    assertRole(profile.role,['owner','admin','commercial','business_development']);
    const recipient=await leadRecipient(supabase,organisationId,leadId);
    const recipientEmail=suppliedEmail||recipient?.contact_email||'';
    if(!recipientEmail)throw new Error('Enter the client email address before sending the Client Quote.');
    const delivery=await sendClientQuoteEmail({supabase,organisationId,quoteId,leadId,recipientEmail,recipientName,companyName:recipient?.company_name||null});
    const evidenceReference=`Resend message ${delivery.providerMessageId}`;
    const {data:quote,error}=await supabase.rpc('op_issue_quote_with_evidence',{
      p_organisation_id:organisationId,p_user_id:user.id,p_quote_id:quoteId,p_recipient_name:recipientName,p_recipient_email:recipientEmail||null,
      p_delivery_method:deliveryMethod,p_evidence_reference:evidenceReference,p_note:issueNote||null,
    });
    if(error)throw new Error(error.message);if(!quote?.id)throw new Error('Issued Client Quote was not returned.');

    {
      const email=recipientEmail;
      const actionUrl=publicSiteUrl();
      const payload={company:recipient?.company_name,reference:quote.quote_number,validUntil:quote.valid_until};
      await queueLifecycleEmail(supabase,{organisationId,scenario:'quote.followup',recipientEmail:email,recipientName:recipientName||recipient?.contact_name,actionUrl,payload,entityType:'quote',entityId:quote.id,scheduledFor:new Date(Date.now()+3*24*60*60*1000).toISOString(),idempotencyKey:`quote:followup:3d:${quote.id}:${quote.revision}`}).catch(()=>null);
      if(quote.valid_until){
        const validityReminder=new Date(`${quote.valid_until}T09:00:00Z`);validityReminder.setUTCDate(validityReminder.getUTCDate()-3);
        if(validityReminder.getTime()>Date.now()) await queueLifecycleEmail(supabase,{organisationId,scenario:'quote.expiry',recipientEmail:email,recipientName:recipientName||recipient?.contact_name,actionUrl,payload,entityType:'quote',entityId:quote.id,scheduledFor:validityReminder.toISOString(),idempotencyKey:`quote:expiry:${quote.id}:${quote.revision}`}).catch(()=>null);
      }
    }
    await cancelEntityReminders(supabase,{organisationId,entityType:'lead',entityId:leadId,categories:['nurture']}).catch(()=>0);
    refreshCase(leadId);destination=caseUrl(leadId,{success:`Quote ${quote.quote_number} was emailed to ${recipientEmail} and recorded as issued. Written client acceptance is now required before Project 360.`,resultStatus:'Awaiting client decision',quote:quote.id,focus:'record-next-action'});
  }catch(error){destination=caseUrl(leadId,{error:message(error),focus:'record-next-action'});}
  redirect(destination);
}

export async function resendClientQuoteAction(formData: FormData) {
  const quoteId=required(formData,'quote_id');const leadId=required(formData,'lead_id');const resendRequestId=required(formData,'request_id');let destination=`/workspace/leads/${leadId}`;
  try{
    const {supabase,organisationId,user,profile}=await requireUserContext();
    assertRole(profile.role,['owner','admin','commercial','business_development']);
    const {data:issue,error:issueError}=await supabase.from('quote_issue_records').select('quote_revision,recipient_name,recipient_email,client_response').eq('organisation_id',organisationId).eq('quote_id',quoteId).eq('lead_id',leadId).maybeSingle();
    if(issueError)throw new Error(issueError.message);
    if(!issue||!issue.recipient_email)throw new Error('The original quotation recipient is missing from the issue record.');
    if(issue.client_response)throw new Error('The client has already responded to this quotation. Record the next client decision instead of resending.');
    const recipient=await leadRecipient(supabase,organisationId,leadId);
    const delivery=await sendClientQuoteEmail({supabase,organisationId,quoteId,leadId,recipientEmail:String(issue.recipient_email),recipientName:String(issue.recipient_name),companyName:recipient?.company_name||null,deliveryKind:'resend',resendRequestId});
    const {error:auditError}=await supabase.rpc('op_record_activity',{p_organisation_id:organisationId,p_user_id:user.id,p_entity_type:'quote',p_entity_id:quoteId,p_event_type:'client_quote_resent',p_event_data:{quoteRevision:delivery.quote.revision,recipientEmail:issue.recipient_email,providerMessageId:delivery.providerMessageId}});
    if(auditError)throw new Error(`The email provider accepted the resend, but its activity record could not be saved: ${auditError.message}`);
    refreshCase(leadId);destination=caseUrl(leadId,{success:`Quote ${delivery.quote.quote_number} R${delivery.quote.revision} was resent to ${issue.recipient_email} with the PDF and client response actions.`,resultStatus:'Awaiting client decision',quote:quoteId,focus:'record-next-action'});
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
    const releaseBasis = required(formData, 'release_basis');
    if (!['payment', 'purchase_order', 'no_advance_payment'].includes(releaseBasis)) throw new Error('Select the release condition stated in the issued Client Quote.');
    const releaseReference = String(formData.get('release_reference') || '').trim();
    const releaseNote = String(formData.get('release_note') || '').trim();
    const paymentMethod = String(formData.get('payment_method') || '').trim();
    const paymentReference = String(formData.get('payment_reference') || '').trim();
    const paymentConfirmedAt = String(formData.get('payment_confirmed_at') || '').trim();
    if (releaseBasis === 'payment' && (!paymentMethod || !paymentReference || !paymentConfirmedAt)) throw new Error('Enter the cleared opening payment details.');
    if (releaseBasis === 'purchase_order' && !releaseReference) throw new Error('Enter the client purchase order reference.');
    if (releaseBasis === 'no_advance_payment' && (!releaseReference || !releaseNote)) throw new Error('Reference the issued quote terms that state no advance payment is due.');
    const { supabase, organisationId, user } = await requireUserContext();
    const { data: project, error } = await supabase.rpc('op_accept_quote_create_project_with_release_evidence', {
      p_organisation_id: organisationId, p_user_id:user.id, p_quote_id:quoteId, p_acceptance_basis:acceptanceBasis,
      p_evidence_reference:evidenceReference, p_accepted_by_name:acceptedByName, p_accepted_by_email:acceptedByEmail||null, p_notes:acceptanceNotes||null,
      p_release_basis:releaseBasis, p_release_reference:releaseReference||null, p_release_note:releaseNote||null,
      p_payment_method:paymentMethod||null, p_payment_reference:paymentReference||null,
      p_payment_confirmed_at:paymentConfirmedAt?new Date(paymentConfirmedAt).toISOString():null,
    });
    if (error) throw new Error(error.message);
    if (!project?.id) throw new Error('Project 360 was not returned after recording client acceptance.');
    await cancelEntityReminders(supabase,{organisationId,entityType:'quote',entityId:quoteId}).catch(()=>0);
    await cancelEntityReminders(supabase,{organisationId,entityType:'lead',entityId:leadId,categories:['nurture']}).catch(()=>0);
    const recipient=await leadRecipient(supabase,organisationId,leadId);
    const email=acceptedByEmail||recipient?.contact_email||'';
    if(email) await queueLifecycleEmail(supabase,{organisationId,scenario:'quote.accepted',recipientEmail:email,recipientName:acceptedByName||recipient?.contact_name,actionUrl:publicSiteUrl(),payload:{company:recipient?.company_name,reference:project.project_number||recipient?.reference},entityType:'lead',entityId:leadId,idempotencyKey:`quote:accepted:${quoteId}`}).catch(()=>null);
    refreshCase(leadId); revalidatePath(`/workspace/projects/${project.id}`);
    destination = `/workspace/projects/${project.id}?created=${encodeURIComponent(`Project ${project.project_number} created after governed written client acceptance and confirmed payment.`)}&focus=record-next-action`;
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
    const recipient=await leadRecipient(supabase,organisationId,leadId);
    if(recipient?.contact_email && outcome!=='withdrawn') await scheduleDormantOpportunityNurture(supabase,{organisationId,opportunityId:leadId,email:recipient.contact_email,name:recipient.contact_name,company:recipient.company_name,actionUrl:publicSiteUrl(),reference:recipient.reference||String(data?.quote_number||'')}).catch(()=>0);
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
    await cancelEntityReminders(supabase,{organisationId,entityType:'lead',entityId:leadId,categories:['nurture']}).catch(()=>0);
    refreshCase(leadId); destination = caseUrl(leadId, { success: `Quotation revision ${String(data?.revision || '')} opened. Previous controlled publication archived.`, resultStatus: 'Draft revision requires new controlled document', focus:'record-documents' });
  } catch (error) { destination = caseUrl(leadId, { error: message(error), focus:'record-next-action' }); }
  redirect(destination);
}
