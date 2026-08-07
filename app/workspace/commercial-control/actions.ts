'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertRole, requireUserContext } from '@/lib/auth/context';

const financeRoles = ['owner','admin','commercial'] as const;
const paymentRoles = ['owner','admin','commercial','operator'] as const;

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) || '').trim();
  if (!value) throw new Error(`${key.replaceAll('_',' ')} is required.`);
  return value;
}
function numeric(formData: FormData,key:string, fallback=0){const value=Number(formData.get(key)??fallback);if(!Number.isFinite(value))throw new Error(`${key.replaceAll('_',' ')} must be a valid number.`);return value;}
function url(params:Record<string,string>){return `/workspace/commercial-control?${new URLSearchParams(params).toString()}`;}
function refresh(projectId?:string){revalidatePath('/workspace/commercial-control');revalidatePath('/workspace/intelligence');revalidatePath('/workspace');if(projectId)revalidatePath(`/workspace/projects/${projectId}`);}
async function audit(supabase:any, organisationId:string,userId:string,entityType:string,entityId:string,eventType:string,eventData:Record<string,unknown>){
  await supabase.rpc('op_record_activity',{p_organisation_id:organisationId,p_user_id:userId,p_entity_type:entityType,p_entity_id:entityId,p_event_type:eventType,p_event_data:eventData});
}

export async function setCommercialTermsAction(formData:FormData){
  const projectId=required(formData,'project_id');let destination='/workspace/commercial-control';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...financeRoles]);
    const basis=required(formData,'authorisation_basis');
    const depositPercent=numeric(formData,'deposit_percent');
    const requiredAmount=numeric(formData,'deposit_required_amount');
    const overrideReason=String(formData.get('override_reason')||'').trim()||null;
    if(basis==='manual'&&!overrideReason)throw new Error('Manual financial authorisation requires a reason.');
    const payload={organisation_id:organisationId,project_id:projectId,quote_id:String(formData.get('quote_id')||'')||null,authorisation_basis:basis,payment_terms_days:numeric(formData,'payment_terms_days',30),deposit_percent:depositPercent,deposit_required_amount:requiredAmount,po_number:String(formData.get('po_number')||'').trim()||null,credit_approved:formData.get('credit_approved')==='on',override_reason:overrideReason,authorised_by:['manual','none'].includes(basis)?user.id:null,authorised_at:['manual','none'].includes(basis)?new Date().toISOString():null,created_by:user.id,updated_at:new Date().toISOString()};
    const {error}=await supabase.from('commercial_terms').upsert(payload,{onConflict:'organisation_id,project_id'});if(error)throw new Error(error.message);
    await audit(supabase,organisationId,user.id,'project',projectId,'commercial_terms_updated',{basis,requiredAmount,paymentTermsDays:payload.payment_terms_days});refresh(projectId);destination=url({updated:'Commercial terms saved.'});
  }catch(error){destination=url({error:error instanceof Error?error.message:'Commercial terms could not be saved.'});}redirect(destination);
}

export async function createInvoiceAction(formData:FormData){
  const projectId=required(formData,'project_id');let destination='/workspace/commercial-control';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...financeRoles]);
    const subtotal=numeric(formData,'subtotal');const vatRate=numeric(formData,'vat_rate',20);const vat=Number((subtotal*vatRate/100).toFixed(2));const total=Number((subtotal+vat).toFixed(2));
    const {data:project,error:projectError}=await supabase.from('projects').select('id,lead_id,quote_id').eq('organisation_id',organisationId).eq('id',projectId).single();if(projectError||!project)throw new Error(projectError?.message||'Project not found.');
    const {data:number,error:numberError}=await supabase.rpc('op_next_financial_number',{p_organisation_id:organisationId,p_kind:'invoice'});if(numberError)throw new Error(numberError.message);
    const {data:invoice,error}=await supabase.from('invoices').insert({organisation_id:organisationId,project_id:projectId,lead_id:project.lead_id,quote_id:project.quote_id,invoice_number:number,invoice_type:String(formData.get('invoice_type')||'milestone'),description:String(formData.get('description')||'').trim()||null,subtotal,vat_rate:vatRate,vat,total,currency:String(formData.get('currency')||'GBP'),due_date:String(formData.get('due_date')||'')||null,created_by:user.id}).select('id,invoice_number').single();if(error||!invoice)throw new Error(error?.message||'Invoice could not be created.');
    await audit(supabase,organisationId,user.id,'project',projectId,'invoice_created',{invoiceId:invoice.id,invoiceNumber:invoice.invoice_number,total});refresh(projectId);destination=url({created:`Invoice ${invoice.invoice_number} created.`});
  }catch(error){destination=url({error:error instanceof Error?error.message:'Invoice could not be created.'});}redirect(destination);
}

export async function issueInvoiceAction(formData:FormData){
  const invoiceId=required(formData,'invoice_id');let destination='/workspace/commercial-control';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...financeRoles]);
    const {data:invoice,error:readError}=await supabase.from('invoices').select('id,project_id,invoice_number,status,due_date').eq('organisation_id',organisationId).eq('id',invoiceId).single();if(readError||!invoice)throw new Error(readError?.message||'Invoice not found.');if(invoice.status!=='draft')throw new Error('Only a draft invoice can be issued.');
    const {error}=await supabase.from('invoices').update({status:'issued',issued_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('organisation_id',organisationId).eq('id',invoiceId);if(error)throw new Error(error.message);
    await audit(supabase,organisationId,user.id,'project',invoice.project_id,'invoice_issued',{invoiceId,invoiceNumber:invoice.invoice_number,dueDate:invoice.due_date});refresh(invoice.project_id);destination=url({updated:`Invoice ${invoice.invoice_number} issued.`});
  }catch(error){destination=url({error:error instanceof Error?error.message:'Invoice could not be issued.'});}redirect(destination);
}

export async function recordClientPaymentAction(formData:FormData){
  const invoiceId=required(formData,'invoice_id');let destination='/workspace/commercial-control';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...paymentRoles]);
    const {data:invoice,error:invoiceError}=await supabase.from('invoices').select('id,project_id,invoice_number,currency,status,total,amount_paid').eq('organisation_id',organisationId).eq('id',invoiceId).single();if(invoiceError||!invoice)throw new Error(invoiceError?.message||'Invoice not found.');if(['draft','cancelled','refunded'].includes(invoice.status))throw new Error('Payment cannot be recorded against this invoice state.');
    const amount=numeric(formData,'amount');if(amount<=0)throw new Error('Payment amount must be greater than zero.');
    const {error}=await supabase.from('payments').insert({organisation_id:organisationId,invoice_id:invoiceId,project_id:invoice.project_id,amount,currency:invoice.currency,payment_method:String(formData.get('payment_method')||'bank_transfer'),status:'cleared',reference:String(formData.get('reference')||'').trim()||null,paid_at:String(formData.get('paid_at')||'')||new Date().toISOString(),recorded_by:user.id});if(error)throw new Error(error.message);
    await audit(supabase,organisationId,user.id,'project',invoice.project_id,'client_payment_recorded',{invoiceId,invoiceNumber:invoice.invoice_number,amount});refresh(invoice.project_id);destination=url({updated:`Payment recorded against ${invoice.invoice_number}.`});
  }catch(error){destination=url({error:error instanceof Error?error.message:'Payment could not be recorded.'});}redirect(destination);
}

export async function createPartnerPayableAction(formData:FormData){
  const projectId=required(formData,'project_id');let destination='/workspace/commercial-control';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...financeRoles]);
    const subtotal=numeric(formData,'subtotal');const vat=numeric(formData,'vat');const total=Number((subtotal+vat).toFixed(2));
    const {data:number,error:numberError}=await supabase.rpc('op_next_financial_number',{p_organisation_id:organisationId,p_kind:'payable'});if(numberError)throw new Error(numberError.message);
    const {data:payable,error}=await supabase.from('partner_payables').insert({organisation_id:organisationId,project_id:projectId,partner_id:required(formData,'partner_id'),partner_quote_id:String(formData.get('partner_quote_id')||'')||null,payable_number:number,invoice_reference:String(formData.get('invoice_reference')||'').trim()||null,status:'received',description:String(formData.get('description')||'').trim()||null,subtotal,vat,total,currency:String(formData.get('currency')||'GBP'),due_date:String(formData.get('due_date')||'')||null,evidence_confirmed:formData.get('evidence_confirmed')==='on',created_by:user.id}).select('id,payable_number').single();if(error||!payable)throw new Error(error?.message||'Partner payable could not be created.');
    await audit(supabase,organisationId,user.id,'project',projectId,'partner_payable_received',{payableId:payable.id,payableNumber:payable.payable_number,total});refresh(projectId);destination=url({created:`Partner payable ${payable.payable_number} recorded.`});
  }catch(error){destination=url({error:error instanceof Error?error.message:'Partner payable could not be recorded.'});}redirect(destination);
}

export async function approvePartnerPayableAction(formData:FormData){
  const payableId=required(formData,'payable_id');let destination='/workspace/commercial-control';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...financeRoles]);
    const {data:payable,error:readError}=await supabase.from('partner_payables').select('id,project_id,payable_number,evidence_confirmed,status,total').eq('organisation_id',organisationId).eq('id',payableId).single();if(readError||!payable)throw new Error(readError?.message||'Partner payable not found.');if(!payable.evidence_confirmed)throw new Error('Delivery evidence must be confirmed before a partner payable is approved.');if(!['received','matched'].includes(payable.status))throw new Error('This payable is not in an approvable state.');
    const {error}=await supabase.from('partner_payables').update({status:'approved',approved_by:user.id,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('organisation_id',organisationId).eq('id',payableId);if(error)throw new Error(error.message);
    await audit(supabase,organisationId,user.id,'project',payable.project_id,'partner_payable_approved',{payableId,payableNumber:payable.payable_number,total:payable.total});refresh(payable.project_id);destination=url({updated:`${payable.payable_number} approved for payment.`});
  }catch(error){destination=url({error:error instanceof Error?error.message:'Partner payable could not be approved.'});}redirect(destination);
}

export async function recordPartnerPaymentAction(formData:FormData){
  const payableId=required(formData,'payable_id');let destination='/workspace/commercial-control';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...financeRoles]);
    const {data:payable,error:readError}=await supabase.from('partner_payables').select('id,project_id,payable_number,currency,status,total,amount_paid').eq('organisation_id',organisationId).eq('id',payableId).single();if(readError||!payable)throw new Error(readError?.message||'Partner payable not found.');if(!['approved','scheduled','paid'].includes(payable.status))throw new Error('Partner payment requires an approved payable.');
    const amount=numeric(formData,'amount');if(amount<=0)throw new Error('Payment amount must be greater than zero.');
    const {error}=await supabase.from('partner_payments').insert({organisation_id:organisationId,payable_id:payableId,project_id:payable.project_id,amount,currency:payable.currency,payment_method:String(formData.get('payment_method')||'bank_transfer'),status:'cleared',reference:String(formData.get('reference')||'').trim()||null,paid_at:String(formData.get('paid_at')||'')||new Date().toISOString(),recorded_by:user.id});if(error)throw new Error(error.message);
    await audit(supabase,organisationId,user.id,'project',payable.project_id,'partner_payment_recorded',{payableId,payableNumber:payable.payable_number,amount});refresh(payable.project_id);destination=url({updated:`Payment recorded against ${payable.payable_number}.`});
  }catch(error){destination=url({error:error instanceof Error?error.message:'Partner payment could not be recorded.'});}redirect(destination);
}
