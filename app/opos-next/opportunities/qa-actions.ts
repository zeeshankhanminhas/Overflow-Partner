'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { assertIsolatedQaFixtureBackend } from '@/lib/qa/isolation';
import { qaAllowedRecipientAddresses } from '@/lib/qa/email-guard';
import { companyInputSchema } from '@/lib/validation/companies';
import { contactInputSchema } from '@/lib/validation/contacts';
import { prospectInputSchema } from '@/lib/validation/prospects';
import { createCompany, getCompanyById } from '@/lib/repositories/companies';
import { createContact, getContactById } from '@/lib/repositories/contacts';
import { createProspect } from '@/lib/repositories/prospects';
import { recordActivity } from '@/lib/repositories/activity';

const base = '/opos-next/opportunities/new';
const roles = ['admin', 'owner', 'operator'] as const;
function failure(error: unknown) {
  return base + '?error=' + encodeURIComponent(error instanceof Error ? error.message : 'Unable to save QA fixture');
}
function expectQaName(value: string) {
  const name = value.trim();
  if (name.length < 2 || name.length > 170) throw new Error('Enter a fictional company name (2–170 characters).');
  return name.startsWith('QA - ') ? name : 'QA - ' + name;
}
async function authorise() {
  assertIsolatedQaFixtureBackend();
  const context = await requireUserContext('/opos-next');
  assertRole(context.profile.role, [...roles]);
  return context;
}

export async function createQaCompanyAction(formData: FormData) {
  let destination = base;
  try {
    const {supabase,user,organisationId} = await authorise();
    const companyName = expectQaName(String(formData.get('company_name') || ''));
    const parsed = companyInputSchema.parse({
      name: companyName, industry: 'Engineering and manufacturing',
      country: 'United Kingdom', notes: 'FICTIONAL OPOS-QA FIXTURE. Not a real client.',
      lifecycle_status: 'active',
    });
    const company = await createCompany(supabase,organisationId,user.id,parsed);
    await recordActivity(supabase,{organisationId,userId:user.id,entityType:'company',entityId:company.id,
      eventType:'qa.fixture_company_created',eventData:{synthetic:true}});
    destination = base + '?company_id=' + encodeURIComponent(company.id) + '&company_created=1';
    revalidatePath('/opos-next/opportunities');
  } catch (error) { destination = failure(error); }
  redirect(destination);
}

export async function createQaContactAction(formData: FormData) {
  let destination = base;
  const companyId = String(formData.get('company_id') || '');
  try {
    const {supabase,user,organisationId} = await authorise();
    const company = await getCompanyById(supabase,organisationId,companyId);
    if (!company.name.startsWith('QA - ')) throw new Error('Only fictional QA companies can be used.');
    const recipient = [...qaAllowedRecipientAddresses()].find(email => email.endsWith('+client@gmail.com'));
    if (!recipient) throw new Error('The QA client test inbox is not configured.');
    const parsed = contactInputSchema.parse({
      company_id:company.id, full_name:String(formData.get('contact_name')||'QA Client Contact'),
      job_title:'Engineering Manager', email:recipient, communication_status:'marketable',
      lifecycle_status:'active',is_primary:true,
      notes:'FICTIONAL OPOS-QA CONTACT. Uses dedicated Gmail +client alias.',
    });
    const contact = await createContact(supabase,organisationId,user.id,parsed);
    await recordActivity(supabase,{organisationId,userId:user.id,entityType:'contact',entityId:contact.id,
      eventType:'qa.fixture_contact_created',eventData:{synthetic:true}});
    destination = base + '?company_id=' + encodeURIComponent(company.id) +
      '&contact_id=' + encodeURIComponent(contact.id) + '&contact_created=1';
  } catch(error) {
    destination=base + '?company_id=' + encodeURIComponent(companyId) +
      '&error=' + encodeURIComponent(error instanceof Error?error.message:'Unable to add QA contact');
  }
  redirect(destination);
}

export async function createQaOpportunityAction(formData: FormData) {
  let destination = base;
  const companyId = String(formData.get('company_id')||'');
  const contactId = String(formData.get('contact_id')||'');
  try {
    const {supabase,user,organisationId} = await authorise();
    const [company,contact] = await Promise.all([
      getCompanyById(supabase,organisationId,companyId),
      getContactById(supabase,organisationId,contactId),
    ]);
    if (!company.name.startsWith('QA - ') || contact.company_id !== company.id)
      throw new Error('QA contact must belong to the fictional QA company.');
    if (!qaAllowedRecipientAddresses().has(String(contact.email||'').toLowerCase()))
      throw new Error('The QA contact must use the dedicated test mailbox.');
    const {data:duplicate,error:dupeError}=await supabase.from('prospects')
      .select('id').eq('organisation_id',organisationId).eq('company_id',companyId)
      .eq('contact_id',contactId).not('status','in','(converted,not_a_fit)').limit(1).maybeSingle();
    if(dupeError)throw new Error(dupeError.message);
    if(duplicate)throw new Error('This QA company/contact already has an active opportunity. Open it rather than duplicating.');
    const scope=String(formData.get('scope')||'').trim();
    if(scope.length<12||scope.length>1000)throw new Error('Describe the demonstration requirement in 12–1000 characters.');
    const parsed=prospectInputSchema.parse({
      source:'manual',status:'identified',company_id:company.id,contact_id:contact.id,
      company_name:company.name,contact_name:contact.full_name,email:contact.email,
      job_title:contact.job_title||'',industry:company.industry||'',
      next_action:'Await QA email enablement before issuing secure Step 2 requirements invitation',
      notes:'FICTIONAL OPOS-QA OPPORTUNITY — no real client. Demonstration scope: '+scope,
    });
    const prospect=await createProspect(supabase,organisationId,user.id,parsed);
    await recordActivity(supabase,{organisationId,userId:user.id,entityType:'prospect',entityId:prospect.id,
      eventType:'qa.fixture_opportunity_created',eventData:{synthetic:true,scope}});
    revalidatePath('/opos-next/opportunities'); revalidatePath('/opos-next');
    destination='/opos-next/opportunities/'+prospect.id+'?updated=1';
  }catch(error){
    destination=base+'?company_id='+encodeURIComponent(companyId)+'&contact_id='+encodeURIComponent(contactId)+
      '&error='+encodeURIComponent(error instanceof Error?error.message:'Unable to create QA opportunity');
  }
  redirect(destination);
}
