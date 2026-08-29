'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertRole, requireUserContext } from '@/lib/auth/context';
import { cancelEntityReminders } from '@/lib/notifications/queue';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { assertCanApprovePayable, assertCanCreateInvoice, assertCanCreatePayable, assertCanIssueInvoice, assertCanPayPartner } from '@/lib/business/invariants';
import type { BillingInvoiceType } from '@/lib/finance/state';

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
function appUrl(){return (process.env.NEXT_PUBLIC_APP_URL||'https://overflow-partner.vercel.app').replace(/\/$/,'');}
function money(amount:unknown,currency='GBP'){try{return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(Number(amount||0));}catch{return `${currency} ${Number(amount||0).toFixed(2)}`;}}
function scheduleAt(dateValue:string,days=0){const date=new Date(`${dateValue}T09:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString();}
async function audit(supabase:any, organisationId:string,userId:string,entityType:string,entityId:string,eventType:string,eventData:Record<string,unknown>){await supabase.rpc('op_record_activity',{p_organisation_id:organisationId,p_user_id:userId,p_entity_type:entityType,p_entity_id:entityId,p_event_type:eventType,p_event_data:eventData});}
async function clientForLead(supabase:any,organisationId:string,leadId:string|null){if(!leadId)return null;const {data}=await supabase.from('leads').select('id,company_name,contact_name,contact_email').eq('organisation_id',organisationId).eq('id',leadId).maybeSingle();return data||null;}
async function partnerForId(supabase:any,organisationId:string,partnerId:string|null){if(!partnerId)return null;const {data}=await supabase.from('partners').select('id,company_name,contact_name,email').eq('organisation_id',organisationId).eq('id',partnerId).maybeSingle();return data||null;}

export async function setCommercialTermsAction(formData:FormData){
  const projectId=required(formData,'project_id');let destination='/workspace/commercial-control';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...financeRoles]);
    const {data:project,error:projectError}=await supabase.from('projects').select('id,status,project_stage').eq('organisation_id',organisationId).eq('id',projectId).single();
    if(projectError||!project)throw new Error(projectError?.message||'Project not found.');
    if(String(project.project_stage||'mobilisation')!=='mobilisation')throw new Error('Commercial mobilisation terms are locked once the Project leaves Mobilisation.');
    if(['completed','closed','cancelled'].includes(String(project.status)))throw new Error('Commercial terms cannot be changed for a non-operational Project.');
    const basis=required(formData,'authorisation_basis');const depositPercent=numeric(formData,'deposit_percent');const requiredAmount=numeric(formData,'deposit_required_amount');const overrideReason=String(formData.get('override_reason')||'').trim()||null;
    if(basis==='manual'&&!overrideReason)throw new Error('Manual financial authorisation requires a reason.');
    const payload={organisation_id:organisationId,project_id:projectId,quote_id:String(formData.get('quote_id')||'')||null,authorisation_basis:basis,payment_terms_days:numeric(formData,'payment_terms_days',30),deposit_percent:depositPercent,deposit_required_amount:requiredAmount,po_number:String(formData.get('po_number')||'').trim()||null,credit_approved:formData.get('credit_approved')==='on',override_reason:overrideReason,authorised_by:['manual','none'].includes(basis)?user.id:null,authorised_at:['manual','none'].includes(basis)?new Date().toISOString():null,created_by:user.id,updated_at:new Date().toISOString()};
    const {error}=await supabase.from('commercial_terms').upsert(payload,{onConflict:'organisation_id,project_id'});if(error)throw new Error(error.message);
    await audit(supabase,organisationId,user.id,'project',projectId,'commercial_terms_updated',{basis,requiredAmount,paymentTermsDays:payload.payment_terms_days,invariant:'PROJECT_MOBILISATION_TERMS'});refresh(projectId);destination=url({project:projectId,updated:'Commercial terms saved.',focus:'financial-gate'});
  }catch(error){destination=url({project:projectId,error:error instanceof Error?error.message:'Commercial terms could not be saved.',focus:'financial-gate'});}redirect(destination);
}

export async function createInvoiceAction(formData:FormData){
  const projectId=required(formData,'project_id');let destination='/workspace/commercial-control';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...financeRoles]);
    const invoiceType=String(formData.get('invoice_type')||'milestone') as BillingInvoiceType;
    if(!['deposit','milestone','final','credit_note'].includes(invoiceType))throw new Error('Invalid invoice type.');
    await assertCanCreateInvoice(supabase,organisationId,projectId,invoiceType);
    const subtotal=numeric(formData,'subtotal');if(subtotal<=0)throw new Error('Invoice subtotal must be greater than zero.');
    const vatRate=numeric(formData,'vat_rate',20);const vat=Number((subtotal*vatRate/100).toFixed(2));const total=Number((subtotal+vat).toFixed(2));
    const {data:project,error:projectError}=await supabase.from('projects').select('id,lead_id,quote_id').eq('organisation_id',organisationId).eq('id',projectId).single();if(projectError||!project)throw new Error(projectError?.message||'Project not found.');
    const {data:number,error:numberError}=await supabase.rpc('op_next_financial_number',{p_organisation_id:organisationId,p_kind:'invoice'});if(numberError)throw new Error(numberError.message);
    const {data:invoice,error}=await supabase.from('invoices').insert({organisation_id:organisationId,project_id:projectId,lead_id:project.lead_id,quote_id:project.quote_id,invoice_number:number,invoice_type:invoiceType,description:String(formData.get('description')||'').trim()||null,subtotal,vat_rate:vatRate,vat,total,currency:String(formData.get('currency')||'GBP'),due_date:String(formData.get('due_date')||'')||null,created_by:user.id}).select('id,invoice_number').single();if(error||!invoice)throw new Error(error?.message||'Invoice could not be created.');
    await audit(supabase,organisationId,user.id,'project',projectId,'invoice_created',{invoiceId:invoice.id,invoiceNumber:invoice.invoice_number,total,invoiceType,invariant:'BILLING_ELIGIBILITY'});refresh(projectId);destination=url({project:projectId,created:`Invoice ${invoice.invoice_number} created.`,focus:`invoice-${invoice.id}`});
  }catch(error){destination=url({project:projectId,error:error instanceof Error?error.message:'Invoice could not be created.',focus:'receivables'});}redirect(destination);
}

export async function issueInvoiceAction(formData:FormData){
  const invoiceId=required(formData,'invoice_id');let destination='/workspace/commercial-control';let projectId='';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...financeRoles]);
    const guarded=await assertCanIssueInvoice(supabase,organisationId,invoiceId);projectId=guarded.project_id;
    const {data:invoice,error:readError}=await supabase.from('invoices').select('id,project_id,lead_id,invoice_number,status,due_date,total,currency,public_token').eq('organisation_id',organisationId).eq('id',invoiceId).single();if(readError||!invoice)throw new Error(readError?.message||'Invoice not found.');
    const client=await clientForLead(supabase,organisationId,invoice.lead_id);if(!client?.contact_email)throw new Error('Client email is required before an invoice can be issued.');
    const issuedAt=new Date().toISOString();const {error}=await supabase.from('invoices').update({status:'issued',issued_at:issuedAt,updated_at:issuedAt}).eq('organisation_id',organisationId).eq('id',invoiceId);if(error)throw new Error(error.message);
    const actionUrl=`${appUrl()}/invoice/${invoice.public_token}`;const amount=money(invoice.total,invoice.currency);const dueDate=invoice.due_date?new Date(`${invoice.due_date}T00:00:00Z`).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}):'';const payload={company:client.company_name,reference:invoice.invoice_number,amount,dueDate};
    await queueLifecycleEmail(supabase,{organisationId,scenario:'payment.requested',recipientEmail:client.contact_email,recipientName:client.contact_name,actionUrl,payload,entityType:'invoice',entityId:invoice.id,idempotencyKey:`invoice-issued:${invoice.id}`,subject:`Invoice ${invoice.invoice_number} from Overflow Partner`});
    if(invoice.due_date){
      await queueLifecycleEmail(supabase,{organisationId,scenario:'payment.due',recipientEmail:client.contact_email,recipientName:client.contact_name,actionUrl,payload,entityType:'invoice',entityId:invoice.id,scheduledFor:scheduleAt(invoice.due_date,0),idempotencyKey:`invoice-due:${invoice.id}:${invoice.due_date}`,subject:`Reminder · Invoice ${invoice.invoice_number}`});
      await queueLifecycleEmail(supabase,{organisationId,scenario:'payment.overdue',recipientEmail:client.contact_email,recipientName:client.contact_name,actionUrl,payload,entityType:'invoice',entityId:invoice.id,scheduledFor:scheduleAt(invoice.due_date,3),idempotencyKey:`invoice-overdue:${invoice.id}:${invoice.due_date}:3`,subject:`Invoice ${invoice.invoice_number} · payment overdue`});
    }
    await audit(supabase,organisationId,user.id,'project',invoice.project_id,'invoice_issued',{invoiceId,invoiceNumber:invoice.invoice_number,dueDate:invoice.due_date,notificationQueued:true,invariant:'BILLING_ELIGIBILITY'});refresh(invoice.project_id);destination=url({project:projectId,updated:`Invoice ${invoice.invoice_number} issued and client delivery queued.`,focus:`invoice-${invoice.id}`});
  }catch(error){destination=url({...projectId?{project:projectId}:{},error:error instanceof Error?error.message:'Invoice could not be issued.',focus:`invoice-${invoiceId}`});}redirect(destination);
}

export async function recordClientPaymentAction(formData:FormData){
  const invoiceId=required(formData,'invoice_id');let destination='/workspace/commercial-control';let projectId='';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...paymentRoles]);
    const {data:invoice,error:invoiceError}=await supabase.from('invoices').select('id,project_id,lead_id,invoice_number,currency,status,total,amount_paid,public_token').eq('organisation_id',organisationId).eq('id',invoiceId).single();if(invoiceError||!invoice)throw new Error(invoiceError?.message||'Invoice not found.');if(['draft','cancelled','refunded'].includes(invoice.status))throw new Error('Payment cannot be recorded against this invoice state.');projectId=invoice.project_id;
    const amount=numeric(formData,'amount');if(amount<=0)throw new Error('Payment amount must be greater than zero.');
    const remainingBefore=Math.max(0,Number(invoice.total||0)-Number(invoice.amount_paid||0));if(amount>remainingBefore)throw new Error(`Payment exceeds the outstanding invoice balance of ${money(remainingBefore,invoice.currency)}.`);
    const {error}=await supabase.from('payments').insert({organisation_id:organisationId,invoice_id:invoiceId,project_id:invoice.project_id,amount,currency:invoice.currency,payment_method:String(formData.get('payment_method')||'bank_transfer'),status:'cleared',reference:String(formData.get('reference')||'').trim()||null,paid_at:String(formData.get('paid_at')||'')||new Date().toISOString(),recorded_by:user.id});if(error)throw new Error(error.message);
    const {data:updated}=await supabase.from('invoices').select('amount_paid,total,status').eq('organisation_id',organisationId).eq('id',invoiceId).single();const remaining=Math.max(0,Number(updated?.total||invoice.total)-Number(updated?.amount_paid||0));
    const client=await clientForLead(supabase,organisationId,invoice.lead_id);if(client?.contact_email){const actionUrl=`${appUrl()}/invoice/${invoice.public_token}`;await queueLifecycleEmail(supabase,{organisationId,scenario:'payment.received',recipientEmail:client.contact_email,recipientName:client.contact_name,actionUrl,payload:{company:client.company_name,reference:invoice.invoice_number,amount:money(amount,invoice.currency),balance:money(remaining,invoice.currency)},entityType:'invoice',entityId:invoice.id,idempotencyKey:`payment-received:${invoice.id}:${updated?.amount_paid||amount}`,subject:`Payment received · ${invoice.invoice_number}`});}
    if(remaining<=0)await cancelEntityReminders(supabase,{organisationId,entityType:'invoice',entityId:invoice.id,categories:['reminder']});
    await audit(supabase,organisationId,user.id,'project',invoice.project_id,'client_payment_recorded',{invoiceId,invoiceNumber:invoice.invoice_number,amount,remainingBalance:remaining,invariant:'RECEIVABLE_BALANCE'});refresh(invoice.project_id);destination=url({project:projectId,updated:`Payment recorded against ${invoice.invoice_number}.`,focus:`invoice-${invoice.id}`});
  }catch(error){destination=url({...projectId?{project:projectId}:{},error:error instanceof Error?error.message:'Payment could not be recorded.',focus:`invoice-${invoiceId}`});}redirect(destination);
}

export async function createPartnerPayableAction(formData:FormData){
  const projectId=required(formData,'project_id');let destination='/workspace/commercial-control';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...financeRoles]);
    await assertCanCreatePayable(supabase,organisationId,projectId);
    const subtotal=numeric(formData,'subtotal');const vat=numeric(formData,'vat');const total=Number((subtotal+vat).toFixed(2));if(total<=0)throw new Error('Partner payable total must be greater than zero.');
    const {data:number,error:numberError}=await supabase.rpc('op_next_financial_number',{p_organisation_id:organisationId,p_kind:'payable'});if(numberError)throw new Error(numberError.message);
    const {data:payable,error}=await supabase.from('partner_payables').insert({organisation_id:organisationId,project_id:projectId,partner_id:required(formData,'partner_id'),partner_quote_id:String(formData.get('partner_quote_id')||'')||null,payable_number:number,invoice_reference:String(formData.get('invoice_reference')||'').trim()||null,status:'received',description:String(formData.get('description')||'').trim()||null,subtotal,vat,total,currency:String(formData.get('currency')||'GBP'),due_date:String(formData.get('due_date')||'')||null,evidence_confirmed:formData.get('evidence_confirmed')==='on',created_by:user.id}).select('id,payable_number').single();if(error||!payable)throw new Error(error?.message||'Partner payable could not be created.');
    await audit(supabase,organisationId,user.id,'project',projectId,'partner_payable_received',{payableId:payable.id,payableNumber:payable.payable_number,total,invariant:'DELIVERY_EVIDENCE_REQUIRED'});refresh(projectId);destination=url({project:projectId,created:`Partner payable ${payable.payable_number} recorded.`,focus:`payable-${payable.id}`});
  }catch(error){destination=url({project:projectId,error:error instanceof Error?error.message:'Partner payable could not be recorded.',focus:'payables'});}redirect(destination);
}

export async function approvePartnerPayableAction(formData:FormData){
  const payableId=required(formData,'payable_id');let destination='/workspace/commercial-control';let projectId='';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...financeRoles]);
    const guarded=await assertCanApprovePayable(supabase,organisationId,payableId);projectId=guarded.project_id;
    const {data:payable,error:readError}=await supabase.from('partner_payables').select('id,project_id,payable_number,total').eq('organisation_id',organisationId).eq('id',payableId).single();if(readError||!payable)throw new Error(readError?.message||'Partner payable not found.');
    const {error}=await supabase.from('partner_payables').update({status:'approved',approved_by:user.id,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('organisation_id',organisationId).eq('id',payableId);if(error)throw new Error(error.message);
    await audit(supabase,organisationId,user.id,'project',payable.project_id,'partner_payable_approved',{payableId,payableNumber:payable.payable_number,total:payable.total,invariant:'DELIVERY_EVIDENCE_REQUIRED'});refresh(payable.project_id);destination=url({project:projectId,updated:`${payable.payable_number} approved for payment.`,focus:`payable-${payable.id}`});
  }catch(error){destination=url({...projectId?{project:projectId}:{},error:error instanceof Error?error.message:'Partner payable could not be approved.',focus:`payable-${payableId}`});}redirect(destination);
}

export async function recordPartnerPaymentAction(formData:FormData){
  const payableId=required(formData,'payable_id');let destination='/workspace/commercial-control';let projectId='';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();assertRole(profile.role,[...financeRoles]);
    const guarded=await assertCanPayPartner(supabase,organisationId,payableId);projectId=guarded.project_id;
    const {data:payable,error:readError}=await supabase.from('partner_payables').select('id,project_id,partner_id,payable_number,currency,status,total,amount_paid').eq('organisation_id',organisationId).eq('id',payableId).single();if(readError||!payable)throw new Error(readError?.message||'Partner payable not found.');
    const amount=numeric(formData,'amount');if(amount<=0)throw new Error('Payment amount must be greater than zero.');
    const remaining=Math.max(0,Number(payable.total||0)-Number(payable.amount_paid||0));if(amount>remaining)throw new Error(`Payment exceeds the outstanding partner balance of ${money(remaining,payable.currency)}.`);
    const reference=String(formData.get('reference')||'').trim()||null;
    const {error}=await supabase.from('partner_payments').insert({organisation_id:organisationId,payable_id:payableId,project_id:payable.project_id,amount,currency:payable.currency,payment_method:String(formData.get('payment_method')||'bank_transfer'),status:'cleared',reference,paid_at:String(formData.get('paid_at')||'')||new Date().toISOString(),recorded_by:user.id});if(error)throw new Error(error.message);
    const partner=await partnerForId(supabase,organisationId,payable.partner_id);if(partner?.email)await queueLifecycleEmail(supabase,{organisationId,scenario:'partner_payment.sent',recipientEmail:partner.email,recipientName:partner.contact_name||partner.company_name,actionUrl:appUrl(),payload:{company:partner.company_name,reference:reference||payable.payable_number,amount:money(amount,payable.currency)},entityType:'project',entityId:payable.project_id,idempotencyKey:`partner-payment:${payableId}:${amount}:${reference||'cleared'}`}).catch(()=>null);
    await audit(supabase,organisationId,user.id,'project',payable.project_id,'partner_payment_recorded',{payableId,payableNumber:payable.payable_number,amount,invariant:'APPROVED_PAYABLE_REQUIRED'});refresh(payable.project_id);destination=url({project:projectId,updated:`Payment recorded against ${payable.payable_number}.`,focus:`payable-${payable.id}`});
  }catch(error){destination=url({...projectId?{project:projectId}:{},error:error instanceof Error?error.message:'Partner payment could not be recorded.',focus:`payable-${payableId}`});}redirect(destination);
}
