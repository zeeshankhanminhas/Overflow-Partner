'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertRole, requireUserContext } from '@/lib/auth/context';
import { cancelEntityReminders, queueNotification } from '@/lib/notifications/queue';
import { assertCanPayPartner } from '@/lib/business/invariants';

const clientPaymentRoles = ['owner','admin','commercial','operator'] as const;
const partnerPaymentRoles = ['owner','admin','commercial'] as const;

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) || '').trim();
  if (!value) throw new Error(`${key.replaceAll('_',' ')} is required.`);
  return value;
}

function numeric(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) throw new Error(`${key.replaceAll('_',' ')} must be a valid number.`);
  return value;
}

function money(amount: unknown, currency = 'GBP') {
  try { return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(Number(amount||0)); }
  catch { return `${currency} ${Number(amount||0).toFixed(2)}`; }
}

function paymentUrl(params: Record<string,string>) {
  return `/workspace/payments?${new URLSearchParams(params).toString()}`;
}

function refresh(projectId?: string) {
  revalidatePath('/workspace/payments');
  revalidatePath('/workspace/commercial-control');
  revalidatePath('/workspace/intelligence');
  revalidatePath('/workspace');
  if (projectId) revalidatePath(`/workspace/projects/${projectId}`);
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://overflow-partner.vercel.app').replace(/\/$/,'');
}

async function audit(supabase:any, organisationId:string, userId:string, entityType:string, entityId:string, eventType:string, eventData:Record<string,unknown>) {
  await supabase.rpc('op_record_activity',{p_organisation_id:organisationId,p_user_id:userId,p_entity_type:entityType,p_entity_id:entityId,p_event_type:eventType,p_event_data:eventData});
}

async function clientForLead(supabase:any, organisationId:string, leadId:string|null) {
  if (!leadId) return null;
  const {data}=await supabase.from('leads').select('id,company_name,contact_name,contact_email').eq('organisation_id',organisationId).eq('id',leadId).maybeSingle();
  return data || null;
}

export async function recordClientPaymentFromLedgerAction(formData: FormData) {
  const invoiceId = required(formData,'invoice_id');
  let projectId = String(formData.get('project_id') || '');
  let destination = paymentUrl(projectId ? {project:projectId} : {});
  try {
    const {supabase,user,profile,organisationId}=await requireUserContext();
    assertRole(profile.role,[...clientPaymentRoles]);
    const {data:invoice,error:invoiceError}=await supabase.from('invoices').select('id,project_id,lead_id,invoice_number,currency,status,total,amount_paid,public_token').eq('organisation_id',organisationId).eq('id',invoiceId).single();
    if(invoiceError||!invoice) throw new Error(invoiceError?.message||'Invoice not found.');
    if(['draft','cancelled','refunded'].includes(String(invoice.status))) throw new Error('Payment cannot be recorded against this invoice state.');
    projectId=invoice.project_id;
    const amount=numeric(formData,'amount');
    if(amount<=0) throw new Error('Payment amount must be greater than zero.');
    const remainingBefore=Math.max(0,Number(invoice.total||0)-Number(invoice.amount_paid||0));
    if(amount>remainingBefore) throw new Error(`Payment exceeds the outstanding invoice balance of ${money(remainingBefore,invoice.currency)}.`);
    const {error}=await supabase.from('payments').insert({organisation_id:organisationId,invoice_id:invoiceId,project_id:invoice.project_id,amount,currency:invoice.currency,payment_method:String(formData.get('payment_method')||'bank_transfer'),status:'cleared',reference:String(formData.get('reference')||'').trim()||null,paid_at:String(formData.get('paid_at')||'')||new Date().toISOString(),recorded_by:user.id});
    if(error) throw new Error(error.message);
    const {data:updated}=await supabase.from('invoices').select('amount_paid,total,status').eq('organisation_id',organisationId).eq('id',invoiceId).single();
    const remaining=Math.max(0,Number(updated?.total||invoice.total)-Number(updated?.amount_paid||0));
    const client=await clientForLead(supabase,organisationId,invoice.lead_id);
    if(client?.contact_email){
      const actionUrl=`${appUrl()}/invoice/${invoice.public_token}`;
      await queueNotification(supabase,{organisationId,eventKey:'invoice.payment_received',recipientEmail:client.contact_email,recipientName:client.contact_name,subject:`Payment received · ${invoice.invoice_number}`,templateKey:'payment_received',payload:{company:client.company_name,reference:invoice.invoice_number,amount:money(amount,invoice.currency),balance:money(remaining,invoice.currency),actionUrl},entityType:'invoice',entityId:invoice.id,category:'transactional',idempotencyKey:`payment-received:${invoice.id}:${updated?.amount_paid||amount}`});
    }
    if(remaining<=0) await cancelEntityReminders(supabase,{organisationId,entityType:'invoice',entityId:invoice.id,categories:['reminder']});
    await audit(supabase,organisationId,user.id,'project',invoice.project_id,'client_payment_recorded',{invoiceId,invoiceNumber:invoice.invoice_number,amount,remainingBalance:remaining,invariant:'RECEIVABLE_BALANCE'});
    refresh(invoice.project_id);
    destination=paymentUrl({project:projectId,updated:`Payment recorded against ${invoice.invoice_number}.`,focus:`invoice-${invoice.id}`});
  } catch(error) {
    destination=paymentUrl({...projectId?{project:projectId}:{},error:error instanceof Error?error.message:'Payment could not be recorded.',focus:`invoice-${invoiceId}`});
  }
  redirect(destination);
}

export async function recordPartnerPaymentFromLedgerAction(formData: FormData) {
  const payableId=required(formData,'payable_id');
  let projectId=String(formData.get('project_id')||'');
  let destination=paymentUrl(projectId?{project:projectId}:{});
  try {
    const {supabase,user,profile,organisationId}=await requireUserContext();
    assertRole(profile.role,[...partnerPaymentRoles]);
    const guarded=await assertCanPayPartner(supabase,organisationId,payableId);
    projectId=guarded.project_id;
    const {data:payable,error:readError}=await supabase.from('partner_payables').select('id,project_id,payable_number,currency,status,total,amount_paid').eq('organisation_id',organisationId).eq('id',payableId).single();
    if(readError||!payable) throw new Error(readError?.message||'Partner payable not found.');
    const amount=numeric(formData,'amount');
    if(amount<=0) throw new Error('Payment amount must be greater than zero.');
    const remaining=Math.max(0,Number(payable.total||0)-Number(payable.amount_paid||0));
    if(amount>remaining) throw new Error(`Payment exceeds the outstanding partner balance of ${money(remaining,payable.currency)}.`);
    const {error}=await supabase.from('partner_payments').insert({organisation_id:organisationId,payable_id:payableId,project_id:payable.project_id,amount,currency:payable.currency,payment_method:String(formData.get('payment_method')||'bank_transfer'),status:'cleared',reference:String(formData.get('reference')||'').trim()||null,paid_at:String(formData.get('paid_at')||'')||new Date().toISOString(),recorded_by:user.id});
    if(error) throw new Error(error.message);
    await audit(supabase,organisationId,user.id,'project',payable.project_id,'partner_payment_recorded',{payableId,payableNumber:payable.payable_number,amount,invariant:'APPROVED_PAYABLE_REQUIRED'});
    refresh(payable.project_id);
    destination=paymentUrl({project:projectId,updated:`Payment recorded against ${payable.payable_number}.`,focus:`payable-${payable.id}`});
  } catch(error) {
    destination=paymentUrl({...projectId?{project:projectId}:{},error:error instanceof Error?error.message:'Partner payment could not be recorded.',focus:`payable-${payableId}`});
  }
  redirect(destination);
}
