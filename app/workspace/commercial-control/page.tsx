import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { operatorErrorMessage } from '@/lib/workspace/operatorErrors';
import { resolveFinancialGate, resolveInvoiceState, resolvePayableState } from '@/lib/finance/state';
import { approvePartnerPayableAction, createInvoiceAction, issueInvoiceAction } from './actions';
import { createGovernedPartnerPayableAction } from './payable-actions';
import { ActionDialog } from '@/components/workspace/InteractionPrimitives';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

function money(value:unknown,currency='GBP'){const amount=Number(value||0);try{return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(amount)}catch{return `${currency} ${amount.toFixed(2)}`}}
function date(value:unknown){if(!value)return '—';const d=new Date(String(value));return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
function positivePage(value:unknown){const n=Number(value||1);return Number.isInteger(n)&&n>0?n:1;}
function pageHref(params:Record<string,string|string[]|undefined>,key:string,value:number){const next=new URLSearchParams();for(const [k,v] of Object.entries(params)){if(v!==undefined&&k!==key){const item=Array.isArray(v)?v[0]:v;if(item)next.set(k,item);}}next.set(key,String(value));return `/workspace/commercial-control?${next.toString()}`;}
function invoiceTone(state:any):ProductTone{if(state.overdue)return 'blocked';if(state.settled)return 'complete';if(state.canRecordPayment)return 'waiting';return 'active'}
function payableTone(state:any):ProductTone{if(state.settled)return 'complete';if(state.approvalBlockedReason)return 'attention';if(['received','matched'].includes(state.status))return 'attention';if(state.canRecordPayment)return 'waiting';return 'active'}

export default async function CommercialControlPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const params=searchParams?await searchParams:{};
  const selectedProject=String(Array.isArray(params.project)?params.project[0]:params.project||'');
  const invoicePage=positivePage(params.invoicePage);const payablePage=positivePage(params.payablePage);const pageSize=25;
  const {supabase,organisationId}=await requireUserContext();

  let invoiceQuery=supabase.from('invoices').select('*',{count:'exact'}).eq('organisation_id',organisationId).order('created_at',{ascending:false});
  let payableQuery=supabase.from('partner_payables').select('*,partners(company_name)',{count:'exact'}).eq('organisation_id',organisationId).order('created_at',{ascending:false});
  if(selectedProject){invoiceQuery=invoiceQuery.eq('project_id',selectedProject);payableQuery=payableQuery.eq('project_id',selectedProject);}

  const [projectsResult,invoicesResult,payablesResult,snapshotResult]=await Promise.all([
    supabase.from('projects').select('id,project_number,title,status,project_stage,lead_id,quote_id').eq('organisation_id',organisationId).order('created_at',{ascending:false}).limit(100),
    invoiceQuery.range((invoicePage-1)*pageSize,invoicePage*pageSize-1),
    payableQuery.range((payablePage-1)*pageSize,payablePage*pageSize-1),
    supabase.rpc('op_executive_snapshot',{p_organisation_id:organisationId}),
  ]);

  let projects=projectsResult.data||[];const invoices=invoicesResult.data||[];const payables=payablesResult.data||[];const snapshot=(snapshotResult.data||{}) as Record<string,unknown>;
  if(selectedProject&&!projects.some((p:any)=>p.id===selectedProject)){const targeted=await supabase.from('projects').select('id,project_number,title,status,project_stage,lead_id,quote_id').eq('organisation_id',organisationId).eq('id',selectedProject).maybeSingle();if(targeted.data)projects=[targeted.data,...projects];}
  const projectId=selectedProject||String((projects[0] as any)?.id||'');const project=(projects as any[]).find(p=>p.id===projectId);
  let projectTerms:any=null;let gateRaw:any=null;
  if(projectId){const [termsResult,gateResult]=await Promise.all([supabase.from('commercial_terms').select('*').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle(),supabase.rpc('op_project_financial_gate',{p_project_id:projectId})]);projectTerms=termsResult.data;gateRaw=gateResult.data;}
  const gate=resolveFinancialGate(gateRaw);
  const invoiceCount=invoicesResult.count||0;const payableCount=payablesResult.count||0;const invoicePages=Math.max(1,Math.ceil(invoiceCount/pageSize));const payablePages=Math.max(1,Math.ceil(payableCount/pageSize));
  const scoped=Boolean(selectedProject&&project);

  const createInvoiceDialog=<ActionDialog title="Create client invoice" description="Create the commercial receivable record. Actual settlement remains owned by Payments." triggerLabel="Create invoice"><form action={createInvoiceAction} className="stack"><label>Project<select name="project_id" required defaultValue={projectId}><option value="">Select project</option>{(projects as any[]).map(p=><option value={p.id} key={p.id}>{p.project_number} · {p.title}</option>)}</select></label><div className="grid gap-4 md:grid-cols-2"><label>Type<select name="invoice_type" defaultValue="milestone"><option value="deposit">Deposit</option><option value="milestone">Milestone</option><option value="final">Final</option><option value="credit_note">Credit note</option></select></label><label>Subtotal<input type="number" step="0.01" min="0" name="subtotal" required/></label><label>VAT rate<input type="number" step="0.01" min="0" name="vat_rate" defaultValue="20"/></label><label>Due date<input type="date" name="due_date" required/></label></div><label>Description<textarea name="description" rows={2}/></label><input type="hidden" name="currency" value="GBP"/><button className="button">Create invoice</button></form></ActionDialog>;
  const createPayableDialog=<ActionDialog title="Record Partner invoice" description="Record the governed Partner liability. Partner and delivery evidence remain derived from Project lineage; settlement remains owned by Payments." triggerLabel="Record Partner invoice"><form action={createGovernedPartnerPayableAction} className="stack"><label>Project<select name="project_id" required defaultValue={projectId}><option value="">Select project</option>{(projects as any[]).map(p=><option value={p.id} key={p.id}>{p.project_number} · {p.title}</option>)}</select></label><div className="vp-callout"><strong>Partner and delivery evidence are derived</strong><p>The payable inherits the Project&apos;s governed Execution Partner and linked Partner quote. Completed delivery evidence is resolved automatically.</p></div><div className="grid gap-4 md:grid-cols-2"><label>Partner invoice ref<input name="invoice_reference"/></label><label>Subtotal<input type="number" step="0.01" min="0" name="subtotal" required/></label><label>VAT<input type="number" step="0.01" min="0" name="vat" defaultValue="0"/></label><label>Due date<input type="date" name="due_date"/></label></div><label>Description<textarea name="description" rows={2}/></label><input type="hidden" name="currency" value="GBP"/><button className="button">Record Partner payable</button></form></ActionDialog>;

  return <section className="vp-page commercial-workspace">
    <ProductPageHeader
      eyebrow="Commercial · Control"
      title={scoped?`${project.project_number} · Finance`:'Commercial control'}
      description={scoped?'Accepted commercial terms, client invoices and Execution Partner liabilities for this project. Settlement is recorded only in Payments.':'Control pricing authority, client invoicing, Partner liabilities and management commercial position across the business.'}
      backHref={scoped?`/workspace/projects/${project.id}?focus=record-next-action`:undefined}
      backLabel="Back to Project 360"
      actions={<>{scoped?<Link className="button secondary" href="/workspace/commercial-control">Full ledger</Link>:null}<Link className="button secondary" href="/workspace/payments">Payments</Link><Link className="button secondary" href="/workspace/intelligence">Executive Intelligence</Link></>}
    />

    {params.updated||params.created?<ProductNotice title="Commercial control updated" tone="complete"><p>{String(params.updated||params.created)}</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Action could not be completed" tone="blocked"><p>{operatorErrorMessage(String(params.error))}</p></ProductNotice>:null}
    {snapshotResult.error?<ProductNotice title="Financial data layer is not active yet" tone="attention"><p>{operatorErrorMessage(snapshotResult.error.message)}</p></ProductNotice>:null}

    {!scoped?<ProductMetrics label="Financial position">
      <ProductMetric label="Invoiced" value={money(snapshot.invoicedValue)} detail={`${Number(snapshot.overdueInvoices||0)} overdue invoices`} />
      <ProductMetric label="Collected" value={money(snapshot.cashCollected)} detail="Settlement state from Payments" tone="complete" />
      <ProductMetric label="Receivables" value={money(snapshot.receivablesOutstanding)} detail="Outstanding client balance" tone={Number(snapshot.receivablesOutstanding||0)>0?'waiting':'complete'} />
      <ProductMetric label="Partner committed" value={money(snapshot.partnerCommitted)} detail={`${money(snapshot.partnerPaid)} settled through Payments`} />
    </ProductMetrics>:null}

    <section id="financial-gate" className="product-panel">
      <ProductSectionHeader eyebrow="Project commercial basis" title="Client start payment" actions={scoped?null:<form method="get" className="product-toolbar__group"><select name="project" defaultValue={projectId}><option value="">Select project</option>{(projects as any[]).map(p=><option value={p.id} key={p.id}>{p.project_number} · {p.title}</option>)}</select><button className="button secondary">Open</button></form>} />
      {project?<div className="product-split">
        <div className="product-stack">
          <div><p className="product-eyebrow">{project.project_number}</p><h3>{project.title}</h3></div>
          <ProductMetrics label="Accepted start-payment gate">
            <ProductMetric label="State" value={gate.authorised?'Start payment received':'Awaiting client payment'} detail={gate.reason} tone={gate.authorised?'complete':'waiting'} />
            <ProductMetric label="Accepted term" value={projectTerms?`${Number(projectTerms.deposit_percent||0).toFixed(2).replace(/\.00$/,'')}% of Client Quote`:'Not recorded'} detail={projectTerms?`Payment terms · ${Number(projectTerms.payment_terms_days||0)} days`:'Revise and re-accept the Client Quote; do not create a Project override.'} tone={projectTerms?'active':'attention'} />
            <ProductMetric label="Required" value={money(gate.required)} detail="Derived from the accepted Client Quote" />
            <ProductMetric label="Received" value={money(gate.received)} detail={gate.shortfall>0?`${money(gate.shortfall)} still to clear`:'Requirement satisfied'} tone={gate.shortfall>0?'waiting':'complete'} />
          </ProductMetrics>
          <div className="product-row-actions"><Link href={`/workspace/projects/${project.id}?focus=record-next-action`}>Return to Project 360 →</Link>{!gate.authorised?<Link href={`/workspace/payments?project=${project.id}&action=record-payment`}>Record payment in Payments →</Link>:null}</div>
        </div>
        <div className="vp-callout"><strong>Accepted commercial evidence</strong><p>Start-payment terms are set with the Case commercial position and carried by the accepted Client Quote. They are read-only here. Payments owns received/cleared settlement evidence.</p></div>
      </div>:<ProductEmptyState title="Select a project" description="Choose a project to inspect its accepted start-payment term and commercial ledger." />}
    </section>

    <div className="product-split commercial-ledgers">
      <section id="receivables" className="product-panel">
        <ProductSectionHeader eyebrow="Receivables" title={scoped?'Project invoices':'Client invoices'} actions={createInvoiceDialog} />
        {(invoices as any[]).length===0?<ProductEmptyState title={scoped?'No invoices for this project':'No invoices recorded'} description="Create a controlled client invoice when the commercial milestone is ready." />:<ProductRegister>
          {(invoices as any[]).map(i=>{const state=resolveInvoiceState(i);return <ProductRegisterRow id={`invoice-${i.id}`} key={i.id}>
            <div><strong>{i.invoice_number}</strong><p>{String(i.invoice_type||'invoice').replaceAll('_',' ')} · due {date(i.due_date)}</p></div>
            <ProductStatus tone={invoiceTone(state)}>{state.displayStatus}</ProductStatus>
            <div><strong>{money(i.total,i.currency)}</strong><small style={{display:'block'}}>{money(i.amount_paid,i.currency)} paid · {money(state.balance,i.currency)} outstanding</small></div>
            <div className="product-row-actions"><Link className="button secondary" href={`/workspace/commercial-control/invoices/${i.id}`}>Open</Link>{state.canIssue?<ActionDialog title={`Issue invoice · ${i.invoice_number}`} description="Issue this controlled receivable. Recording actual client money remains a Payments action." triggerLabel="Issue"><form action={issueInvoiceAction}><input type="hidden" name="invoice_id" value={i.id}/><button className="button">Issue invoice</button></form></ActionDialog>:null}{state.canRecordPayment?<Link className="button secondary" href={`/workspace/payments?project=${i.project_id}&action=record-payment`}>Record in Payments</Link>:null}</div>
          </ProductRegisterRow>})}
        </ProductRegister>}
        {invoicePages>1?<nav className="vp-pagination" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginTop:16}}><span>Page {invoicePage} of {invoicePages} · {invoiceCount} invoices</span><div className="product-row-actions">{invoicePage>1?<Link className="button secondary" href={pageHref(params,'invoicePage',invoicePage-1)}>Previous</Link>:null}{invoicePage<invoicePages?<Link className="button secondary" href={pageHref(params,'invoicePage',invoicePage+1)}>Next</Link>:null}</div></nav>:null}
      </section>

      <section id="payables" className="product-panel">
        <ProductSectionHeader eyebrow="Payables" title={scoped?'Project partner liabilities':'Execution partner liabilities'} actions={createPayableDialog} />
        {(payables as any[]).length===0?<ProductEmptyState title={scoped?'No partner liabilities for this project':'No partner liabilities recorded'} description="Record a controlled Partner payable when a governed Execution Partner exists and invoice data is available." />:<ProductRegister>
          {(payables as any[]).map(p=>{const state=resolvePayableState(p);return <ProductRegisterRow id={`payable-${p.id}`} key={p.id}>
            <div><strong>{p.payable_number}</strong><p>{p.partners?.company_name||'Partner'} · {p.invoice_reference||'No invoice reference'}</p>{state.approvalBlockedReason?<small>{state.approvalBlockedReason}</small>:null}</div>
            <ProductStatus tone={payableTone(state)}>{state.displayStatus}</ProductStatus>
            <div><strong>{money(p.total,p.currency)}</strong><small style={{display:'block'}}>{money(p.amount_paid,p.currency)} paid · {money(state.balance,p.currency)} outstanding</small></div>
            <div className="product-row-actions">{['received','matched'].includes(state.status)?<ActionDialog title={`Approve Partner payable · ${p.payable_number}`} description="Approve this governed Partner liability only when its derived delivery and commercial evidence permits approval." triggerLabel="Approve" disabled={!state.canApprove}><form action={approvePartnerPayableAction}><input type="hidden" name="payable_id" value={p.id}/><button className="button">Approve Partner payable</button></form></ActionDialog>:null}{state.canRecordPayment?<Link className="button secondary" href={`/workspace/payments?project=${p.project_id}`}>Pay in Payments</Link>:null}</div>
          </ProductRegisterRow>})}
        </ProductRegister>}
        {payablePages>1?<nav className="vp-pagination" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginTop:16}}><span>Page {payablePage} of {payablePages} · {payableCount} payables</span><div className="product-row-actions">{payablePage>1?<Link className="button secondary" href={pageHref(params,'payablePage',payablePage-1)}>Previous</Link>:null}{payablePage<payablePages?<Link className="button secondary" href={pageHref(params,'payablePage',payablePage+1)}>Next</Link>:null}</div></nav>:null}
      </section>
    </div>
  </section>;
}
