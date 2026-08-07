import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';

function money(value:unknown,currency='GBP'){const amount=Number(value||0);try{return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(amount)}catch{return `${currency} ${amount.toFixed(2)}`}}
function date(value:unknown){if(!value)return '—';return new Date(String(value)).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});}

export default async function InvoicePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {supabase,organisationId}=await requireUserContext();
  const {data:invoice,error}=await supabase.from('invoices').select('*,projects(project_number,title,lead_id,leads(company_name,contact_name,contact_email))').eq('organisation_id',organisationId).eq('id',id).single();
  if(error||!invoice)notFound();
  const project=invoice.projects as any;const lead=project?.leads as any;
  return <section className="vp-page">
    <div className="print-hide" style={{display:'flex',justifyContent:'space-between',gap:12,marginBottom:20}}><Link href="/workspace/commercial-control">← Commercial Control</Link><span>Use browser Print → Save as PDF for the controlled client copy.</span></div>
    <article style={{background:'#fff',color:'#111',padding:'48px',maxWidth:980,margin:'0 auto',border:'1px solid #ddd'}}>
      <header style={{display:'flex',justifyContent:'space-between',gap:40,borderBottom:'2px solid #111',paddingBottom:28}}><div><p style={{textTransform:'uppercase',letterSpacing:'.14em',fontSize:12}}>Overflow Partner</p><h1 style={{fontSize:46,margin:'12px 0'}}>Invoice</h1><p>{invoice.invoice_number}</p></div><div style={{textAlign:'right'}}><strong>{invoice.status.replaceAll('_',' ').toUpperCase()}</strong><p>Issued: {date(invoice.issued_at||invoice.created_at)}</p><p>Due: {date(invoice.due_date)}</p></div></header>
      <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:40,padding:'32px 0'}}><div><small>BILL TO</small><h2>{lead?.company_name||'Client'}</h2><p>{lead?.contact_name||''}</p><p>{lead?.contact_email||''}</p></div><div><small>PROJECT</small><h2>{project?.project_number||'—'}</h2><p>{project?.title||''}</p><p>Currency: {invoice.currency}</p></div></section>
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{borderBottom:'1px solid #111'}}><th style={{textAlign:'left',padding:'12px 0'}}>Description</th><th style={{textAlign:'right'}}>Amount</th></tr></thead><tbody><tr style={{borderBottom:'1px solid #ddd'}}><td style={{padding:'22px 0'}}>{invoice.description||invoice.invoice_type.replaceAll('_',' ')}</td><td style={{textAlign:'right'}}>{money(invoice.subtotal,invoice.currency)}</td></tr></tbody></table>
      <section style={{marginLeft:'auto',width:'min(380px,100%)',paddingTop:24}}><div style={{display:'flex',justifyContent:'space-between',padding:'8px 0'}}><span>Subtotal</span><strong>{money(invoice.subtotal,invoice.currency)}</strong></div><div style={{display:'flex',justifyContent:'space-between',padding:'8px 0'}}><span>VAT ({invoice.vat_rate}%)</span><strong>{money(invoice.vat,invoice.currency)}</strong></div><div style={{display:'flex',justifyContent:'space-between',padding:'16px 0',borderTop:'2px solid #111',fontSize:22}}><span>Total</span><strong>{money(invoice.total,invoice.currency)}</strong></div><div style={{display:'flex',justifyContent:'space-between',padding:'8px 0'}}><span>Received</span><strong>{money(invoice.amount_paid,invoice.currency)}</strong></div><div style={{display:'flex',justifyContent:'space-between',padding:'8px 0'}}><span>Balance</span><strong>{money(Math.max(0,Number(invoice.total)-Number(invoice.amount_paid)),invoice.currency)}</strong></div></section>
      <footer style={{marginTop:48,paddingTop:24,borderTop:'1px solid #ddd'}}><p>Reference this invoice number with payment. Payment status and settlement are governed in Overflow Partner Commercial Control.</p></footer>
    </article>
  </section>;
}
