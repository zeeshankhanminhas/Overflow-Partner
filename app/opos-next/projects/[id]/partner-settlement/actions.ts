'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {getQaScenario,PROJECT,ORG,QUOTE,PARTNER,PAYABLE,INVOICE,TRANSFER,BASE} from '@/lib/qa/northfieldPartnerSettlement';

function refresh(){
 revalidatePath(BASE);
 revalidatePath('/opos-next/projects/'+PROJECT);
 revalidatePath('/opos-next/finance');
 revalidatePath('/workspace/payments');
}
async function execute(step:'create'|'approve'|'simulate'|'close',formData:FormData){
 let result='';
 try{
  const id=String(formData.get('project_id')||'');
  if(id!==PROJECT)throw new Error('Unrecognised QA project.');
  const x=await getQaScenario(id);
  const {supabase,organisationId,user,payable,payments,project}=x;
  if(step==='create'){
   if(payable)throw new Error('QA payable already exists: '+payable.payable_number);
   const {error}=await supabase.from('partner_payables').insert({
    organisation_id:organisationId,project_id:PROJECT,partner_id:PARTNER,partner_quote_id:QUOTE,
    payable_number:PAYABLE,invoice_reference:INVOICE,status:'received',
    description:'QA synthetic supplier invoice fixture for selected Work Order. NOT a real invoice.',
    subtotal:1200,vat:0,total:1200,amount_paid:0,currency:'GBP',
    evidence_confirmed:false,created_by:user.id
   });
   if(error)throw new Error(error.message);
   result='QA fixture payable recorded as RECEIVED. No supplier invoice or payment was created outside QA.';
  }else if(step==='approve'){
   if(!payable||payable.status!=='received')throw new Error('Received QA payable required.');
   if(formData.get('confirm_evidence')!=='yes')throw new Error('Explicit evidence review confirmation required.');
   const {data,error}=await supabase.from('partner_payables').update({
     status:'approved',evidence_confirmed:true,approved_by:user.id,approved_at:new Date().toISOString()
   }).eq('organisation_id',organisationId).eq('id',payable.id).eq('status','received')
    .select('id').maybeSingle();
   if(error||!data)throw new Error('Partner payable approval failed: '+(error?.message||'state changed'));
   result='QA payable approved against the accepted R01 delivery and Work Order. No bank transfer made.';
  }else if(step==='simulate'){
   if(!payable||payable.status!=='approved'||payable.evidence_confirmed!==true||
      Number(payable.amount_paid)!==0||payments.length)
     throw new Error('Approved unpaid QA payable and no prior payment evidence required.');
   if(formData.get('confirm_simulation')!=='yes'||
      String(formData.get('confirmation')||'').trim()!=='SIMULATE')
     throw new Error('Confirm that this is a synthetic settlement with NO real money sent.');
   const {error}=await supabase.from('partner_payments').insert({
    organisation_id:organisationId,payable_id:payable.id,project_id:PROJECT,
    amount:1200,currency:'GBP',payment_method:'qa_simulated_bank_transfer',
    status:'cleared',reference:TRANSFER,paid_at:new Date().toISOString(),recorded_by:user.id
   });
   if(error)throw new Error('QA simulation rejected: '+error.message);
   result='QA-SIM settlement recorded. The QA ledger exercises the real reconciliation triggers; NO bank payment was sent.';
  }else{
   if(project.project_stage!=='completion')throw new Error('Project is not at the completion gate.');
   if(payments.length!==1||payments[0].payment_method!=='qa_simulated_bank_transfer'||
      payable?.status!=='paid'||Number(payable.amount_paid)!==1200)
     throw new Error('QA simulated settlement must reconcile before closure.');
   if(formData.get('confirm_closure')!=='yes')throw new Error('Explicit QA project closure confirmation required.');
   const {data:ready,error:readyError}=await supabase.rpc('op_project_stage_readiness',{p_project_id:PROJECT});
   if(readyError||ready?.ready!==true)
      throw new Error('Project closure is blocked: '+String(ready?.reasons?.join('; ')||readyError?.message||'Governed checks incomplete.'));
   const {error}=await supabase.rpc('op_advance_project_stage',{
     p_project_id:PROJECT,p_target_stage:'closed',p_actor_id:user.id,
     p_note:'Northfield QA-only lifecycle closure. Partner settlement is QA-SIM and is not a real bank transfer.'
   });
   if(error)throw new Error('Canonical closure rejected: '+error.message);
   result='Northfield QA project closed through the governed transition. Partner transfer was simulated, not real.';
  }
 }catch(e){const err=e instanceof Error?e.message:'QA settlement was not saved';redirect(BASE+'?error='+encodeURIComponent(err));}
 refresh();redirect(BASE+'?updated='+encodeURIComponent(result));
}
export async function createQaPartnerPayable(formData:FormData){return execute('create',formData);}
export async function approveQaPartnerPayable(formData:FormData){return execute('approve',formData);}
export async function simulateQaPartnerPayment(formData:FormData){return execute('simulate',formData);}
export async function closeQaNorthfieldProject(formData:FormData){return execute('close',formData);}
