import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';

function money(value:unknown){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(value||0));}
function pct(a:unknown,b:unknown){const denominator=Number(b||0);return denominator>0?`${((Number(a||0)/denominator)*100).toFixed(1)}%`:'—';}

export default async function IntelligencePage(){
  const {supabase,organisationId}=await requireUserContext();
  const [snapshotResult,quotesResult,projectsResult,invoicesResult,risksResult]=await Promise.all([
    supabase.rpc('op_executive_snapshot',{p_organisation_id:organisationId}),
    supabase.from('quotes').select('status,total,created_at,accepted_at,issued_at').eq('organisation_id',organisationId),
    supabase.from('projects').select('status,project_stage,created_at,start_date,due_date').eq('organisation_id',organisationId),
    supabase.from('invoices').select('status,total,amount_paid,due_date,created_at').eq('organisation_id',organisationId),
    supabase.from('risk_register').select('likelihood,impact,status,category').eq('organisation_id',organisationId),
  ]);
  const s=(snapshotResult.data||{}) as Record<string,unknown>;
  const quotes=quotesResult.data||[];const projects=projectsResult.data||[];const invoices=invoicesResult.data||[];const risks=risksResult.data||[];
  const issuedQuotes=quotes.filter(q=>['issued','accepted','declined','expired'].includes(q.status));const acceptedQuotes=quotes.filter(q=>q.status==='accepted');
  const liveProjects=projects.filter(p=>!['completed','closed','cancelled'].includes(p.status));
  const dueSoon=liveProjects.filter(p=>p.due_date&&new Date(p.due_date)<=new Date(Date.now()+7*86400000)).length;
  const overdueReceivables=invoices.filter(i=>['issued','part_paid','overdue'].includes(i.status)&&i.due_date&&new Date(i.due_date)<new Date()).reduce((sum,i)=>sum+Math.max(0,Number(i.total)-Number(i.amount_paid)),0);
  const highRisks=risks.filter(r=>!['closed'].includes(r.status)&&Number(r.likelihood)*Number(r.impact)>=12).length;
  return <section className="vp-page">
    <header className="vp-header"><div><p className="vp-kicker">Executive intelligence</p><h1>One operating truth for growth, delivery and cash.</h1><p className="vp-subtitle">CEO, COO and CFO indicators are calculated directly from governed commercial and operational records.</p></div><Link className="button secondary" href="/workspace/commercial-control">Open Commercial Control</Link></header>
    {snapshotResult.error?<div className="vp-callout"><strong>Executive metrics require the Business Operating Layers migration.</strong><p>{snapshotResult.error.message}</p></div>:null}

    <section className="card" style={{width:'100%'}}><p className="vp-label">CEO · Business health</p><div className="vp-compact-metrics"><div className="vp-metric"><span>Pipeline</span><strong>{money(s.pipelineValue)}</strong></div><div className="vp-metric"><span>Accepted value</span><strong>{money(s.acceptedValue)}</strong></div><div className="vp-metric"><span>Quote win rate</span><strong>{pct(acceptedQuotes.length,issuedQuotes.length)}</strong></div><div className="vp-metric"><span>Active projects</span><strong>{Number(s.activeProjects||liveProjects.length)}</strong></div><div className="vp-metric"><span>Critical risks</span><strong>{Number(s.criticalRisks||0)}</strong></div><div className="vp-metric"><span>Compliance exceptions</span><strong>{Number(s.complianceExceptions||0)}</strong></div></div></section>

    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:20}}>
      <section className="card" style={{width:'100%'}}><p className="vp-label">CFO · Cash and margin</p><div className="vp-list"><div className="vp-row"><div><strong>Invoiced value</strong><p>Controlled client invoices issued</p></div><strong>{money(s.invoicedValue)}</strong></div><div className="vp-row"><div><strong>Cash collected</strong><p>Cleared client receipts</p></div><strong>{money(s.cashCollected)}</strong></div><div className="vp-row"><div><strong>Outstanding receivables</strong><p>Issued value not yet collected</p></div><strong>{money(s.receivablesOutstanding)}</strong></div><div className="vp-row"><div><strong>Overdue receivables</strong><p>Past contractual due date</p></div><strong>{money(overdueReceivables)}</strong></div><div className="vp-row"><div><strong>Partner commitments</strong><p>Approved execution-partner liabilities</p></div><strong>{money(s.partnerCommitted)}</strong></div><div className="vp-row"><div><strong>Forecast gross margin</strong><p>Accepted revenue less approved partner commitments</p></div><strong>{money(s.forecastGrossMargin)}</strong></div></div></section>

      <section className="card" style={{width:'100%'}}><p className="vp-label">COO · Delivery health</p><div className="vp-list"><div className="vp-row"><div><strong>Live delivery</strong><p>Projects not completed, closed or cancelled</p></div><strong>{liveProjects.length}</strong></div><div className="vp-row"><div><strong>Due within 7 days</strong><p>Projects approaching committed delivery date</p></div><strong>{dueSoon}</strong></div><div className="vp-row"><div><strong>Open risks</strong><p>Risks requiring mitigation or acceptance</p></div><strong>{Number(s.openRisks||0)}</strong></div><div className="vp-row"><div><strong>High / critical exposure</strong><p>Risk score 12 or above</p></div><strong>{highRisks}</strong></div><div className="vp-row"><div><strong>Overdue invoices</strong><p>Commercial friction affecting cash conversion</p></div><strong>{Number(s.overdueInvoices||0)}</strong></div></div></section>
    </div>

    <section className="card" style={{width:'100%'}}><p className="vp-label">Management interpretation</p><h2>Signals, not decorative charts.</h2><div className="vp-list"><div className="vp-row"><div><strong>Cash conversion</strong><p>{Number(s.invoicedValue||0)>0?`${pct(s.cashCollected,s.invoicedValue)} of invoiced value has been collected.`:'No issued invoices yet.'}</p></div></div><div className="vp-row"><div><strong>Commercial exposure</strong><p>{Number(s.receivablesOutstanding||0)>0?`${money(s.receivablesOutstanding)} remains receivable; ${money(overdueReceivables)} is overdue.`:'No outstanding receivables.'}</p></div></div><div className="vp-row"><div><strong>Delivery exposure</strong><p>{highRisks||dueSoon?`${highRisks} high-risk items and ${dueSoon} projects due within seven days require management attention.`:'No immediate high-risk delivery signal detected.'}</p></div></div></div></section>
  </section>;
}
