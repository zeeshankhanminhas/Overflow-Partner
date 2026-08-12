'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertRole, requireUserContext } from '@/lib/auth/context';
import { assertCanCreatePayable } from '@/lib/business/invariants';

const financeRoles = ['owner','admin','commercial'] as const;

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) || '').trim();
  if (!value) throw new Error(`${key.replaceAll('_',' ')} is required.`);
  return value;
}

function numeric(formData: FormData,key:string, fallback=0){
  const value=Number(formData.get(key)??fallback);
  if(!Number.isFinite(value))throw new Error(`${key.replaceAll('_',' ')} must be a valid number.`);
  return value;
}

function destination(params:Record<string,string>){
  return `/workspace/commercial-control?${new URLSearchParams(params).toString()}`;
}

function refresh(projectId:string){
  revalidatePath('/workspace/commercial-control');
  revalidatePath('/workspace/payments');
  revalidatePath('/workspace/approvals');
  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath('/workspace');
}

async function audit(supabase:any, organisationId:string,userId:string,projectId:string,eventType:string,eventData:Record<string,unknown>){
  await supabase.rpc('op_record_activity',{
    p_organisation_id:organisationId,
    p_user_id:userId,
    p_entity_type:'project',
    p_entity_id:projectId,
    p_event_type:eventType,
    p_event_data:eventData,
  });
}

async function governedExecutionBasis(supabase:any, organisationId:string, projectId:string){
  const {data:assignment,error}=await supabase.from('project_execution_assignments')
    .select('id,partner_id,partner_quote_id,execution_cycle')
    .eq('organisation_id',organisationId)
    .eq('project_id',projectId)
    .maybeSingle();
  if(error)throw new Error(`Execution Partner could not be derived: ${error.message}`);
  if(!assignment?.partner_id)throw new Error('Release the Project to its governed Execution Partner before recording a Partner liability.');

  const {data:deliveryItems,error:deliveryError}=await supabase.from('project_delivery_items')
    .select('id,status,client_review_status,completed_at')
    .eq('organisation_id',organisationId)
    .eq('project_id',projectId);
  if(deliveryError)throw new Error(`Delivery evidence could not be derived: ${deliveryError.message}`);

  const items=(deliveryItems||[]) as Array<{id:string;status:string;client_review_status:string|null;completed_at:string|null}>;
  const governedEvidence=items.filter(item=>item.status==='complete'||item.client_review_status==='accepted');
  return {
    partnerId:String(assignment.partner_id),
    partnerQuoteId:assignment.partner_quote_id?String(assignment.partner_quote_id):null,
    executionCycle:Number(assignment.execution_cycle||1),
    evidenceConfirmed:governedEvidence.length>0,
    evidenceCount:governedEvidence.length,
  };
}

export async function createGovernedPartnerPayableAction(formData:FormData){
  const projectId=required(formData,'project_id');
  let url='/workspace/commercial-control';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();
    assertRole(profile.role,[...financeRoles]);
    await assertCanCreatePayable(supabase,organisationId,projectId);

    const basis=await governedExecutionBasis(supabase,organisationId,projectId);
    const subtotal=numeric(formData,'subtotal');
    const vat=numeric(formData,'vat');
    const total=Number((subtotal+vat).toFixed(2));
    if(total<=0)throw new Error('Partner payable total must be greater than zero.');

    const {data:number,error:numberError}=await supabase.rpc('op_next_financial_number',{p_organisation_id:organisationId,p_kind:'payable'});
    if(numberError)throw new Error(numberError.message);

    const {data:payable,error}=await supabase.from('partner_payables').insert({
      organisation_id:organisationId,
      project_id:projectId,
      partner_id:basis.partnerId,
      partner_quote_id:basis.partnerQuoteId,
      payable_number:number,
      invoice_reference:String(formData.get('invoice_reference')||'').trim()||null,
      status:'received',
      description:String(formData.get('description')||'').trim()||null,
      subtotal,
      vat,
      total,
      currency:String(formData.get('currency')||'GBP'),
      due_date:String(formData.get('due_date')||'')||null,
      evidence_confirmed:basis.evidenceConfirmed,
      created_by:user.id,
    }).select('id,payable_number').single();
    if(error||!payable)throw new Error(error?.message||'Partner payable could not be created.');

    await audit(supabase,organisationId,user.id,projectId,'partner_payable_received',{
      payableId:payable.id,
      payableNumber:payable.payable_number,
      total,
      partnerDerivedFrom:'project_execution_assignments',
      executionCycle:basis.executionCycle,
      deliveryEvidenceDerived:true,
      governedDeliveryEvidenceCount:basis.evidenceCount,
      evidenceConfirmed:basis.evidenceConfirmed,
      invariant:'DELIVERY_EVIDENCE_REQUIRED',
    });
    refresh(projectId);
    url=destination({project:projectId,created:`Partner payable ${payable.payable_number} recorded.`,focus:`payable-${payable.id}`});
  }catch(error){
    url=destination({project:projectId,error:error instanceof Error?error.message:'Partner payable could not be recorded.',focus:'payables'});
  }
  redirect(url);
}
