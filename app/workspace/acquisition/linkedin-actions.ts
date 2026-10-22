'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { createCompany } from '@/lib/repositories/companies';
import { createContact } from '@/lib/repositories/contacts';
import { createProspectAction } from './actions';
import { recordActivity } from '@/lib/repositories/activity';

function safeLinkedInUrl(value: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['linkedin.com', 'www.linkedin.com'].includes(url.hostname)
      || url.username || url.password) throw new Error();
    return url.toString();
  } catch { throw new Error('Use a valid https://www.linkedin.com profile URL.'); }
}

function returnError(message: string) {
  return '/workspace/acquisition/funnel?error=' + encodeURIComponent(message) + '#add-prospect';
}

/** Single operator action; existing CRM Company and Contact remain authoritative. */
export async function quickAddLinkedInProspectAction(formData: FormData) {
  let destination = '/workspace/acquisition/funnel';
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    const companyName = String(formData.get('company_name') || '').trim();
    const contactName = String(formData.get('contact_name') || '').trim();
    const jobTitle = String(formData.get('job_title') || '').trim();
    const url = safeLinkedInUrl(String(formData.get('linkedin_url') || '').trim());
    if (companyName.length < 2 || companyName.length > 180 || contactName.length < 2 || contactName.length > 180)
      throw new Error('Enter a company and contact name (2–180 characters).');
    if (jobTitle.length > 180) throw new Error('Job title is too long.');

    const { data: existingCompany, error: companyLookupError } = await supabase.from('companies')
      .select('id,name').eq('organisation_id',organisationId).ilike('name',companyName).limit(1).maybeSingle();
    if (companyLookupError) throw new Error(companyLookupError.message);
    const company = existingCompany ?? await createCompany(supabase,organisationId,user.id,{
      name:companyName,website:'',industry:'',country:'United Kingdom',notes:'',lifecycle_status:'active',
    });

    // Reuse an existing contact by LinkedIn URL or exact name in this company.
    // An existing do-not-contact record must never be silently overridden.
    let match = null;
    if (url) {
      const { data, error } = await supabase.from('contacts').select('id,full_name,company_id,linkedin_url,communication_status')
        .eq('organisation_id',organisationId).eq('linkedin_url',url).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      if (data && data.company_id !== company.id) throw new Error('This LinkedIn contact belongs to another company. Review their existing record.');
      match = data;
    }
    if (!match) {
      const { data, error } = await supabase.from('contacts').select('id,full_name,company_id,linkedin_url,communication_status')
        .eq('organisation_id',organisationId).eq('company_id',company.id).ilike('full_name',contactName).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      match = data;
    }
    if (match?.communication_status === 'do_not_contact')
      throw new Error('This contact is marked Do not contact. Their existing preference has not been changed.');
    if (match?.linkedin_url && url && match.linkedin_url !== url)
      throw new Error('A matching contact has a different LinkedIn profile. Review the existing contact first.');
    const contact = match ?? await createContact(supabase,organisationId,user.id,{
      company_id:company.id,full_name:contactName,job_title:jobTitle,
      email:'',phone:'',linkedin_url:url,notes:'',lifecycle_status:'active',is_primary:false,communication_status:'marketable',
    });

    const {data:duplicate,error:duplicateError} = await supabase.from('prospects')
      .select('id').eq('organisation_id',organisationId).eq('contact_id',contact.id)
      .not('status','in','(converted,not_a_fit)').limit(1).maybeSingle();
    if (duplicateError) throw new Error(duplicateError.message);
    if (duplicate?.id) {
      destination = '/workspace/acquisition/' + duplicate.id + '?updated='
        + encodeURIComponent('This prospect already exists; continue the existing conversation.');
    } else {
      const data = new FormData();
      data.set('company_id',company.id);
      data.set('contact_id',contact.id);
      data.set('source','linkedin');
      data.set('status','identified');
      data.set('notes','');
      const result = await createProspectAction(data);
      if (!result.ok) throw new Error(result.error);
      destination = '/workspace/acquisition/' + result.data.id + '?created=Prospect%20added';
    }
    revalidatePath('/workspace/acquisition/funnel');
  } catch (error) {
    destination = returnError(error instanceof Error ? error.message : 'Unable to add this prospect.');
  }
  redirect(destination);
}

const decisions = new Set(['waiting','followup','interested','closed']);
export async function recordLinkedInDecisionAction(formData: FormData) {
  const id = String(formData.get('prospect_id') || '').trim();
  const decision = String(formData.get('decision') || '').trim();
  const note = String(formData.get('note') || '').trim();
  const followUp = String(formData.get('next_follow_up_at_iso') || '').trim();
  let destination = '/workspace/acquisition/funnel';
  try {
    const {supabase,user,profile,organisationId} = await requireUserContext();
    assertRole(profile.role,['owner','admin','business_development','operator']);
    if (!id || !decisions.has(decision)) throw new Error('Select an outcome.');
    if (note.length > 4000) throw new Error('Keep notes under 4,000 characters.');
    const {data:prospect,error} = await supabase.from('prospects')
      .select('id,source,status,outreach_status,response_outcome,next_follow_up_at,converted_lead_id')
      .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
    if(error || !prospect || prospect.source !== 'linkedin')throw new Error('LinkedIn prospect not found.');
    if (prospect.converted_lead_id || ['qualified','converted','not_a_fit'].includes(String(prospect.status)))
      throw new Error('This opportunity is no longer in active LinkedIn outreach.');
    const {count:sessionCount,error:sessionError}=await supabase.from('intake_sessions')
      .select('id',{head:true,count:'exact'}).eq('organisation_id',organisationId).eq('prospect_id',id);
    if(sessionError)throw new Error(sessionError.message);
    if(sessionCount)throw new Error('This prospect has already entered the governed requirements process.');
    let nextAt: string | null = null;
    if(decision === 'followup') {
      if (!followUp) throw new Error('Choose a follow-up date and time.');
      const timestamp = new Date(followUp);
      if (!Number.isFinite(timestamp.getTime())) throw new Error('Choose a valid follow-up date.');
      nextAt = timestamp.toISOString();
    }
    if(decision === 'closed' && note.length < 5) throw new Error('Record a short reason for closing.');
    const previous = { outreach_status:prospect.outreach_status, response_outcome:prospect.response_outcome, next_follow_up_at:prospect.next_follow_up_at };
    const next = {
      outreach_status: decision === 'interested' || decision === 'closed' ? 'replied'
        : decision === 'followup' ? (prospect.outreach_status === 'replied' ? 'replied' : 'follow_up_due') : 'message_sent',
      response_outcome: decision === 'interested' ? 'interested'
        : decision === 'closed' ? 'not_interested'
        : decision === 'followup' && prospect.outreach_status === 'replied' ? 'later' : null,
      next_follow_up_at:nextAt,
      updated_at:new Date().toISOString(),
      ...(decision === 'closed' ? {status:'not_a_fit',next_action:'Closed as not a fit'}
        : {next_action: decision === 'interested' ? 'Prepare secure requirements invitation' : decision === 'followup' ? 'Follow up on LinkedIn' : 'Wait for LinkedIn reply'}),
      ...(decision === 'interested' || decision === 'closed' ? {last_reply_at:new Date().toISOString()} : {}),
      ...(decision === 'waiting' ? {last_contacted_at:new Date().toISOString()} : {}),
    };
    const {error:updateError}=await supabase.from('prospects').update(next).eq('organisation_id',organisationId).eq('id',id);
    if(updateError)throw new Error(updateError.message);
    await recordActivity(supabase,{organisationId,entityType:'prospect',entityId:id,userId:user.id,
      eventType:'prospect.outreach_updated',eventData:{note:note||null,channel:'linkedin',decision},
      oldValue:previous,newValue:{...next}});
    revalidatePath('/workspace/acquisition/funnel');
    revalidatePath('/workspace/acquisition');
    revalidatePath('/workspace/acquisition/' + id);
    destination = '/workspace/acquisition/' + id + '?updated=' + encodeURIComponent('Next action saved.');
  } catch(error) {
    destination = '/workspace/acquisition/' + encodeURIComponent(id) + '?error='
      + encodeURIComponent(error instanceof Error ? error.message : 'Unable to update this prospect.');
  }
  redirect(destination);
}
