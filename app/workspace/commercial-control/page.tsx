import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { operatorErrorMessage } from '@/lib/workspace/operatorErrors';
import { resolveFinancialGate, resolveInvoiceState, resolvePayableState } from '@/lib/finance/state';
import { approvePartnerPayableAction, createInvoiceAction, createPartnerPayableAction, issueInvoiceAction, recordClientPaymentAction, recordPartnerPaymentAction, setCommercialTermsAction } from './actions';
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

  const [projectsResult,invoicesResult,payablesResult,partnersResult,snapshotResult]=await Promise.all([
    supabase.from('projects').select('id,project_number,title,status,project_stage,lead_id,quote_id').eq('organisation_id',organisationId).order('created_at',{ascending:false}).limit(100),
    invoiceQuery.range((invoicePage-1)*pageSize,invoicePage*pageSize-1),
    payableQuery.range((payablePage-1)*pageSize,payablePage*pageSize-1),
    supabase.from('partners').select('id,company_name,status').eq('organisation_id',organisationId).order('company_name'),
    supabase.rpc('op_executive_snapshot',{p_organisation_id:organisationId}),
  ]);

  let projects=projectsResult.data||[];const invoices=invoicesResult.data||[];const payables=payablesResult.data||[];const partners=partnersResult.data||[];const snapshot=(snapshotResult.data||{}) as Record<string,unknown>;
  if(selectedProject&&!projects.some((p:any)=>p.id===selectedProject)){const targeted=await supabase.from('projects').select('id,project_number,title,status,project_stage,lead_id,quote_id').eq('organisation_id',organisationId).eq('id',selectedProject).maybeSingle();if(targeted.data)projects=[targeted.data,...projects];}
  const projectId=selectedProject||String((projects[0] as any)?.id||'');const project=(projects as any[]).find(p=>p.id===projectId);
  let projectTerms:any=null;let gateRaw:any=null;
  if(projectId){const [termsResult,gateResult]=await Promise.all([supabase.from('commercial_terms').select('*').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle(),supabase.rpc('op_project_financial_gate',{p_project_id:projectId})]);projectTerms=termsResult.data;gateRaw=gateResult.data;}
  const gate=resolveFinancialGate(gateRaw);
  const invoiceCount=invoicesResult.count||0;const payableCount=payablesResult.count||0;const invoicePages=Math.max(1,Math.ceil(invoiceCount/pageSize));const payablePages=Math.max(1,Math.ceil(payableCount/pageSize));
  const scoped=Boolean(selectedProject&&project);

  return <section className="vp-page commercial-workspace">
    <ProductPageHeader
      eyebrow="Commercial · Control"
      title={scoped?`${project.project_number} · Finance`:'Commercial control'}
      description={scoped?'Financial authorisation, client invoices and partner liabilities for this project.':'Control client receivables, partner liabilities and mobilisation authority across the business.'}
      backHref={scoped?`/workspace/projects/${project.id}?focus=record-next-action`:undefined}
      backLabel="Back to Project 360"
      actions={<>{scoped?<Link className="button secondary" href="/workspace/commercial-control">Full ledger</Link>:null}<Link className="button secondary" href="/workspace/payments">Payments</Link><Link className="button secondary" href="/workspace/intelligence">Executive Intelligence</Link></>}
    />

    {params.updated||params.created?<ProductNotice title="Commercial control updated" tone="complete"><p>{String(params.updated||params.created)}</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Action could not be completed" tone="blocked"><p>{operatorErrorMessage(String(params.error))}</p></ProductNotice>:null}
    {snapshotResult.error?<ProductNotice title="Financial data layer is not active yet" tone="attention"><p>{operatorErrorMessage(snapshotResult.error.message)}</p></ProductNotice>:null}

    {!scoped?<ProductMetrics label="Financial position">
      <ProductMetric label="Invoiced" value={money(snapshot.invoicedValue)} detail={`${Number(snapshot.overdueInvoices||0)} overdue invoices`} />
      <ProductMetric label="Collected" value={money(snapshot.cashCollected)} detail="Client cash received" tone="complete" />
      <ProductMetric label="Receivables" value={money(snapshot.receivablesOutstanding)} detail="Outstanding client balance" tone={Number(snapshot.receivablesOutstanding||0)>0?'waiting':'complete'} />
      <ProductMetric label="Partner committed" value={money(snapshot.partnerCommitted)} detail={`${money(snapshot.partnerPaid)} already paid`} />
    </ProductMetrics>:null}

    <section id="financial-gate" className="product-panel">
      <ProductSectionHeader
        eyebrow="Project financial control"
        title="Financial authorisation"
        actions={<form method="get" className="product-toolbar__group"><select name="project" defaultValue={projectId}><option value="">Select project</option>{(projects as any[]).map(p=><option value={p.id} key={p.id}>{p.project_number} · {p.title}</option>)}</select><button className="button secondary">Open</button></form>}
      />
      {project?<div className="product-split">
        <div className="product-stack">
          <div><p className="product-eyebrow">{project.project_number}</p><h3>{project.title}</h3></div>
          <ProductMetrics label="Project financial gate">
            <ProductMetric label="Gate" value={gate.displayState} detail={gate.reason} tone={gate.authorised?'complete':'blocked'} />
            <ProductMetric label="Basis" value={gate.basis} detail="Authorisation basis" />
            <ProductMetric label="Required" value={money(gate.required)} detail="Required before mobilisation" />
            <ProductMetric label="Received" value={money(gate.received)} detail={gate.shortfall>0?`${money(gate.shortfall)} shortfall`:'Requirement satisfied'} tone={gate.shortfall>0?'attention':'complete'} />
          </ProductMetrics>
          <Link href={`/workspace/projects/${project.id}?focus=record-next-action`}>Return to Project 360 →</Link>
        </div>
        <details className="vp-disclosure" open={!gate.authorised}><summary>Configure commercial terms</summary><form action={setCommercialTermsAction} className="stack" style={{paddingTop:16}}><input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="quote_id" value={String(project.quote_id||'')}/><label>Authorisation basis<select name="authorisation_basis" defaultValue={projectTerms?.authorisation_basis||'deposit'}><option value="deposit">Deposit received</option><option value="po">Purchase order</option><option value="credit">Approved credit terms</option><option value="manual">Manual finance override</option><option value="none">No pre-mobilisation payment condition</option></select></label><div className="grid gap-4 md:grid-cols-2"><label>Payment terms (days)<input type="number" min="0" name="payment_terms_days" defaultValue={projectTerms?.payment_terms_days??30}/></label><label>Deposit %<input type="number" min="0" max="100" step="0.01" name="deposit_percent" defaultValue={projectTerms?.deposit_percent??0}/></label><label>Required deposit amount<input type="number" min="0" step="0.01" name="deposit_required_amount" defaultValue={projectTerms?.deposit_required_amount??0}/></label><label>PO number<input name="po_number" defaultValue={projectTerms?.po_number||''}/></label></div><label><input style={{width:'auto'}} type="checkbox" name="credit_approved" defaultChecked={Boolean(projectTerms?.credit_approved)}/> Credit approved</label><label>Override / authorisation reason<textarea name="override_reason" rows={3} defaultValue={projectTerms?.override_reason||''}/></label><button className="button">Save commercial terms</button></form></details>
      </div>:<ProductEmptyState title="Select a project" description="Choose a project to inspect and configure its financial authorisation gate." />}
    </section>

    <div className="product-split commercial-ledgers">
      <section id="receivables" className="product-panel">
        <ProductSectionHeader eyebrow="Receivables" title={scoped?'Project invoices':'Client invoices'} actions={<details className="vp-disclosure"><summary>Create invoice</summary><form action={createInvoiceAction} className="stack" style={{paddingTop:16}}><label>Project<select name="project_id" required defaultValue={projectId}><option value="">Select project</option>{(projects as any[]).map(p=><option value={p.id} key={p.id}>{p.project_number} · {p.title}</option>)}</select></label><div className="grid gap-4 md:grid-cols-2"><label>Type<select name="invoice_type" defaultValue="milestone"><option value="deposit">Deposit</option><option value="milestone">Milestone</option><option value="final">Final</option><option value="credit_note">Credit note</option></select></label><label>Subtotal<input type="number" step="0.01" min="0" name="subtotal" required/></label><label>VAT rate<input type="number" step="0.01" min="0" name="vat_rate" defaultValue="20"/></label><label>Due date<input type="date" name="due_date" required/></label></div><label>Description<textarea name="description" rows={2}/></label><input type="hidden" name="currency" value="GBP"/><button className="button">Create invoice</button></form></details>} />
        {(invoices as any[]).length===0?<ProductEmptyState title={scoped?'No invoices for this project':'No invoices recorded'} description="Create a controlled client invoice when the commercial milestone is ready." />:<ProductRegister>
          {(invoices as any[]).map(i=>{const state=resolveInvoiceState(i);return <ProductRegisterRow id={`invoice-${i.id}`} key={i.id}>
            <div><strong>{i.invoice_number}</strong><p>{String(i.invoice_type||'invoice').replaceAll('_',' ')} · due {date(i.due_date)}</p></div>
            <ProductStatus tone={invoiceTone(state)}>{state.displayStatus}</ProductStatus>
            <div><strong>{money(i.total,i.currency)}</strong><small style={{display:'block'}}>{money(i.amount_paid,i.currency)} paid · {money(state.balance,i.currency)} outstanding</small></div>
            <div className="product-row-actions"><Link className="button secondary" href={`/workspace/commercial-control/invoices/${i.id}`}>Open</Link>{state.canIssue?<form action={issueInvoiceAction}><input type="hidden" name="invoice_id" value={i.id}/><button className="button">Issue</button></form>:null}{state.canRecordPayment?<details><summary>Record payment</summary><form action={recordClientPaymentAction} className="stack"><input type="hidden" name="invoice_id" value={i.id}/><input name="amount" type="number" step="0.01" min="0.01" max={state.balance||undefined} placeholder="Amount" required/><select name="payment_method" defaultValue="bank_transfer"><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="cash">Cash</option><option value="other">Other</option></select><input name="reference" placeholder="Payment reference"/><button className="button">Record</button></form></details>:null}</div>
          </ProductRegisterRow>})}
        </ProductRegister>}
        {invoicePages>1?<nav className="vp-pagination" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginTop:16}}><span>Page {invoicePage} of {invoicePages} · {invoiceCount} invoices</span><div className="product-row-actions">{invoicePage>1?<Link className="button secondary" href={pageHref(params,'invoicePage',invoicePage-1)}>Previous</Link>:null}{invoicePage<invoicePages?<Link className="button secondary" href={pageHref(params,'invoicePage',invoicePage+1)}>Next</Link>:null}</div></nav>:null}
      </section>

      <section id="payables" className="product-panel">
        <ProductSectionHeader eyebrow="Payables" title={scoped?'Project partner liabilities':'Execution partner liabilities'} actions={<details className="vp-disclosure"><summary>Record partner invoice</summary><form action={createPartnerPayableAction} className="stack" style={{paddingTop:16}}><label>Project<select name="project_id" required defaultValue={projectId}><option value="">Select project</option>{(projects as any[]).map(p=><option value={p.id} key={p.id}>{p.project_number} · {p.title}</option>)}</select></label><label>Partner<select name="partner_id" required><option value="">Select partner</option>{(partners as any[]).map(p=><option value={p.id} key={p.id}>{p.company_name}</option>)}</select></label><div className="grid gap-4 md:grid-cols-2"><label>Partner invoice ref<input name="invoice_reference"/></label><label>Subtotal<input type="number" step="0.01" min="0" name="subtotal" required/></label><label>VAT<input type="number" step="0.01" min="0" name="vat" defaultValue="0"/></label><label>Due date<input type="date" name="due_date"/></label></div><label><input style={{width:'auto'}} type="checkbox" name="evidence_confirmed"/> Delivery evidence confirmed</label><label>Description<textarea name="description" rows={2}/></label><input type="hidden" name="currency" value="GBP"/><button className="button">Record partner payable</button></form></details>} />
        {(payables as any[]).length===0?<ProductEmptyState title={scoped?'No partner liabilities for this project':'No partner liabilities recorded'} description="Record a controlled partner payable when delivery evidence and invoice data are available." />:<ProductRegister>
          {(payables as any[]).map(p=>{const state=resolvePayableState(p);return <ProductRegisterRow id={`payable-${p.id}`} key={p.id}>
            <div><strong>{p.payable_number}</strong><p>{p.partners?.company_name||'Partner'} · {p.invoice_reference||'No invoice reference'}</p>{state.approvalBlockedReason?<small>{state.approvalBlockedReason}</small>:null}</div>
            <ProductStatus tone={payableTone(state)}>{state.displayStatus}</ProductStatus>
            <div><strong>{money(p.total,p.currency)}</strong><small style={{display:'block'}}>{money(p.amount_paid,p.currency)} paid · {money(state.balance,p.currency)} outstanding</small></div>
            <div className="product-row-actions">{['received','matched'].includes(state.status)?<form action={approvePartnerPayableAction}><input type="hidden" name="payable_id" value={p.id}/><button className="button" disabled={!state.canApprove}>Approve</button></form>:null}{state.canRecordPayment?<details><summary>Record payment</summary><form action={recordPartnerPaymentAction} className="stack"><input type="hidden" name="payable_id" value={p.id}/><input name="amount" type="number" step="0.01" min="0.01" max={state.balance||undefined} placeholder="Amount" required/><select name="payment_method" defaultValue="bank_transfer"><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select><input name="reference" placeholder="Payment reference"/><button className="button">Record</button></form></details>:null}</div>
          </ProductRegisterRow>})}
        </ProductRegister>}
        {payablePages>1?<nav className="vp-pagination" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginTop:16}}><span>Page {payablePage} of {payablePages} · {payableCount} payables</span><div className="product-row-actions">{payablePage>1?<Link className="button secondary" href={pageHref(params,'payablePage',payablePage-1)}>Previous</Link>:null}{payablePage<payablePages?<Link className="button secondary" href={pageHref(params,'payablePage',payablePage+1)}>Next</Link>:null}</div></nav>:null}
      </section>
    </div>
  </section>;
}
