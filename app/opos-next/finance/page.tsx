import {requireUserContext} from '@/lib/auth/context';
import {OperatorPageIntro,OperatorRegister,type OperatorRow} from '../OperatorViews';
function currency(n:number,c:string){try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:c}).format(n)}catch{return c+' '+n.toFixed(2)}}
export default async function FinancePage(){
  const {supabase,organisationId}=await requireUserContext();
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
  </section>;
}
