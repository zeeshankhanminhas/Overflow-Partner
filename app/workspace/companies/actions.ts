'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { companyInputSchema } from '@/lib/validation/companies';
import { createCompany } from '@/lib/repositories/companies';
import { recordActivity } from '@/lib/repositories/activity';

export async function createCompanyAction(formData: FormData) {
  const { supabase, user, profile, organisationId } = await requireUserContext();
  assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);

  const parsed = companyInputSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    redirect(`/workspace/companies?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid company details')}`);
  }

  try {
    const company = await createCompany(supabase, organisationId, user.id, parsed.data);
    await recordActivity(supabase, {
      organisationId,
      entityType: 'company',
      entityId: company.id,
      userId: user.id,
      eventType: 'company.created',
      newValue: company,
    });
    revalidatePath('/workspace/companies');
    revalidatePath('/workspace');
    redirect('/workspace/companies?created=1');
  } catch (error) {
    redirect(`/workspace/companies?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unable to create company')}`);
  }
}

export async function updateAccountDevelopmentAction(formData:FormData){
  const companyId=String(formData.get('company_id')||'').trim();let destination=`/workspace/companies/${companyId}`;
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,['owner','admin','business_development','operator']);
    const status=String(formData.get('account_status')||'new');if(!['new','active','repeat','retained','dormant'].includes(status))throw new Error('Select a valid account status.');
    const review=String(formData.get('next_account_review_at')||'');
    const updates={account_status:status,account_owner_id:user.id,next_account_review_at:review?new Date(review).toISOString():null,future_workload:String(formData.get('future_workload')||'').trim()||null,preferred_services:String(formData.get('preferred_services')||'').trim()||null,relationship_notes:String(formData.get('relationship_notes')||'').trim()||null,updated_at:new Date().toISOString()};
    const {error}=await supabase.from('companies').update(updates).eq('organisation_id',organisationId).eq('id',companyId);if(error)throw new Error(error.message);
    await recordActivity(supabase,{organisationId,entityType:'company',entityId:companyId,userId:user.id,eventType:'company.account_development_updated',newValue:updates});
    revalidatePath(`/workspace/companies/${companyId}`);revalidatePath('/workspace/companies');revalidatePath('/workspace');destination+=`?updated=${encodeURIComponent('Account development plan saved')}`;
  }catch(error){destination+=`?error=${encodeURIComponent(error instanceof Error?error.message:'Account plan could not be saved.')}`;}redirect(destination);
}
