import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function money(value:unknown,currency='GBP'){const amount=Number(value||0);try{return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(amount)}catch{return `${currency} ${amount.toFixed(2)}`}}
function date(value:unknown){if(!value)return '—';const d=new Date(String(value));return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});}

export default async function PublicInvoicePage({params}:{params:Promise<{token:string}>}){
  const {token}=await params;const supabase=await createClient();
  const {data,error}=await supabase.rpc('op_public_invoice_by_token',{p_token:token});
  const invoice=Array.isArray(data)?data[0]:data;
  if(error||!invoice)notFound();
  const balance=Math.max(0,Number(invoice.total||0)-Number(invoice.amount_paid||0));
  return <main style={{minHeight:'100vh',background:'#f3f1ec',padding:'32px 16px',color:'#171717',fontFamily:'Arial,Helvetica,sans-serif'}}>
    <article style={{maxWidth:900,margin:'0 auto',background:'#fff',border:'1px solid #d9d5cc',padding:'clamp(24px,6vw,56px)'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:30,flexWrap:'wrap',borderTop:'5px solid #e95d2a',paddingTop:24,paddingBottom:28,borderBottom:'1px solid #ddd'}}><div><p style={{fontSize:12,letterSpacing:'.16em',textTransform:'uppercase',color:'#6f6a61'}}>Overflow Partner</p><h1 style={{fontSize:'clamp(34px,7vw,54px)',margin:'10px 0'}}>Invoice</h1><strong>{invoice.invoice_number}</strong></div><div style={{textAlign:'right'}}><strong>{String(invoice.status).replaceAll('_',' ').toUpperCase()}</strong><p>Issued {date(invoice.issued_at)}</p><p>Due {date(invoice.due_date)}</p></div></header>
      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:32,padding:'30px 0'}}><div><small style={{letterSpacing:'.12em'}}>BILL TO</small><h2>{invoice.client_company||'Client'}</h2><p>{invoice.client_contact||''}</p></div><div><small style={{letterSpacing:'.12em'}}>PROJECT</small><h2>{invoice.project_number}</h2><p>{invoice.project_title}</p></div></section>
      <div style={{borderTop:'1px solid #171717',borderBottom:'1px solid #ddd',padding:'20px 0',display:'flex',justifyContent:'space-between',gap:20}}><span>{invoice.description||String(invoice.invoice_type).replaceAll('_',' ')}</span><strong>{money(invoice.subtotal,invoice.currency)}</strong></div>
      <section style={{marginLeft:'auto',width:'min(390px,100%)',paddingTop:24}}><div style={{display:'flex',justifyContent:'space-between',padding:'8px 0'}}><span>Subtotal</span><strong>{money(invoice.subtotal,invoice.currency)}</strong></div><div style={{display:'flex',justifyContent:'space-between',padding:'8px 0'}}><span>VAT ({invoice.vat_rate}%)</span><strong>{money(invoice.vat,invoice.currency)}</strong></div><div style={{display:'flex',justifyContent:'space-between',padding:'15px 0',borderTop:'2px solid #171717',fontSize:22}}><span>Total</span><strong>{money(invoice.total,invoice.currency)}</strong></div><div style={{display:'flex',justifyContent:'space-between',padding:'8px 0'}}><span>Received</span><strong>{money(invoice.amount_paid,invoice.currency)}</strong></div><div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',fontSize:18}}><span>Balance due</span><strong>{money(balance,invoice.currency)}</strong></div></section>
      <footer style={{marginTop:44,borderTop:'1px solid #ddd',paddingTop:22,fontSize:13,color:'#666'}}><p>This is a secure invoice view issued by Overflow Partner. Please use the invoice number as your payment reference. If anything on the invoice needs clarification, reply to the email through which it was issued.</p></footer>
    </article>
  </main>;
}
