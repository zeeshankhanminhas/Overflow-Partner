import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {OperatorRecord} from '../../OperatorViews';
function money(value:unknown,currency:string){try{return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(Number(value||0))}catch{return currency+' '+String(value)}}
export default async function InvoicePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('invoices')
    .select('id,invoice_number,status,total,amount_paid,currency,due_date,project_id')
    .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(error)throw new Error('Invoice record could not be loaded.');if(!data)notFound();
  const currency=data.currency||'GBP';
  const balance=Number(data.total||0)-Number(data.amount_paid||0);
  return <OperatorRecord eyebrow="FINANCE / CLIENT INVOICE" title={data.invoice_number||'Client invoice'}
    position={balance>0?'Balance outstanding':'Invoice balance recorded as settled'}
    description="Invoice totals and receipt allocations are read from the governed ledger. Payment verification and reconciliation remain controlled."
    fields={[{label:'Total',value:money(data.total,currency)},{label:'Received',value:money(data.amount_paid,currency)},
      {label:'Balance',value:money(balance,currency)},{label:'Ledger state',value:String(data.status||'Unknown')}]}
    previous="/opos-next/finance" governedHref={data.project_id?'/workspace/payments?project='+data.project_id:'/workspace/payments'} />;
}
