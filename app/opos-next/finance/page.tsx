import {requireUserContext} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import Link from 'next/link';
import {OperatorPageIntro,OperatorRegister,type OperatorRow} from '../OperatorViews';
function currency(n:number,c:string){try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:c}).format(n)}catch{return c+' '+n.toFixed(2)}}
export default async function FinancePage(){
  const {supabase,organisationId}=await requireUserContext();
  const qa=isKnownIsolatedQaBackend();
  const project='b447f586-bf79-4839-be5e-1af607d9ca43';
  const [{data:qaPayables},{data:qaPartnerPayments}]=qa?await Promise.all([
    supabase.from('partner_payables').select('payable_number,status,total,amount_paid,currency')
     .eq('organisation_id',organisationId).eq('project_id',project),
    supabase.from('partner_payments').select('payment_method,reference,status,amount')
     .eq('organisation_id',organisationId).eq('project_id',project)
  ]):[{data:[]},{data:[]}];
  const {data,error}=await supabase.from('invoices').select('id,invoice_number,invoice_type,status,total,amount_paid,currency,due_date,project_id')
    .eq('organisation_id',organisationId).order('created_at',{ascending:false}).limit(100);
  if(error)throw new Error('Financial register could not be loaded.');
  const rows:OperatorRow[]=(data||[]).map(item=>{
    const total=Number(item.total||0),paid=Number(item.amount_paid||0);
    const balance=total-paid;
    return {id:item.id,title:item.invoice_number||'Client invoice',subtitle:currency(total,item.currency||'GBP'),
      state:String(item.status||'Recorded').replaceAll('_',' '),
      next:balance>0?currency(balance,item.currency||'GBP')+' outstanding':'Payment position recorded',
      href:'/opos-next/finance/'+item.id};
  });
  return <section><OperatorPageIntro eyebrow="FINANCE / CUSTOMER INVOICES" title="Finance" subtitle="Invoice obligations and balances backed by the existing financial ledger. No payment action is available in this preview." count={rows.length}/>
    <OperatorRegister rows={rows} heading="Invoice register" empty="No client invoices have been issued."/>
    {qa?<section style={{marginTop:24,padding:20,border:'1px solid #666',borderRadius:12,display:'grid',gap:10}}>
      <h2 style={{fontSize:19,margin:0}}>Northfield · Execution Partner liability</h2>
      <p>QA synthetic bank settlement is NOT an actual transfer. It must never be entered into real-world cash records.</p>
      <p>Payable: {qaPayables?.[0]?.payable_number||'Not yet recorded'} · {qaPayables?.[0]?.status||'Pending'} · {currency(Number(qaPayables?.[0]?.total||1200),'GBP')}</p>
      <p>Transfer evidence: {qaPartnerPayments?.find(p=>p.payment_method==='qa_simulated_bank_transfer')?'QA-SIM ONLY · no money moved':'No QA simulated transfer recorded'}</p>
      <Link href={'/opos-next/projects/'+project+'/partner-settlement'}>Open governed Partner Settlement QA →</Link>
    </section>:null}
  </section>;
}
