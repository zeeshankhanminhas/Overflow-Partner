import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getCloseoutEvidence,CLOSEOUT_BASE} from '@/lib/qa/northfieldCloseoutEvidence';
import {PROJECT} from '@/lib/qa/northfieldPartnerSettlement';
import {reconcileNorthfieldOpeningInvoice,prepareNorthfieldCloseoutDocument,advanceNorthfieldCloseoutDocument} from './actions';
import css from '../../../opos.module.css';

export const dynamic='force-dynamic';

function status(d:{status:string}|null){return d?.status?.replaceAll('_',' ')||'not created';}
function Section({kind,doc,billingReady}:{
 kind:'invoice'|'completion-report';
 doc:{id:string;reference:string;status:string;revision_code:string|null;storage_path:string|null;approved_at:string|null;issued_at:string|null}|null;
 billingReady:boolean;
}){
 const title=kind==='invoice'?'Controlled paid Invoice evidence':'Controlled Completion Report';
 const next=doc?.status==='in_review'?'sign':doc?.status==='signed'?'approve':doc?.status==='approved'?'issue':null;
 const button=next==='sign'?'Sign reviewed document':next==='approve'?'Approve controlled document':'Issue controlled document';
 return <div className={css.card} style={{display:'grid',gap:12}}>
  <h2 style={{fontSize:20,margin:0}}>{title}</h2>
  <p className={css.meta}>Record: {doc?.reference||'To be created'} · Status: {status(doc)} · Revision: {doc?.revision_code||'P01'}</p>
  <p className={css.meta}>{kind==='invoice'
    ?'An internal QA accounting-evidence PDF recording the already-paid £644.78 opening receipt and £1,504.47 final invoice. It is not a new tax invoice.'
    :'A QA completion report referencing accepted R01 drawings, the issued final handover, client acceptance and clearly simulated partner settlement.'}</p>
  {doc?.storage_path?<Link className={css.secondaryLink} href={CLOSEOUT_BASE+'/file?kind='+kind} target="_blank">Open protected R01 PDF for review →</Link>:null}
  {!billingReady?<p className={css.meta}>First reconcile the historical opening payment with the invoice ledger; no repeat payment is required.</p>:
   !doc||doc.status==='draft'?<form action={prepareNorthfieldCloseoutDocument}>
      <input type="hidden" name="project_id" value={PROJECT}/>
      <input type="hidden" name="kind" value={kind}/>
      <button className={css.action} type="submit" style={{border:0,cursor:'pointer'}}>Prepare {title} R01 →</button>
    </form>:next?<form action={advanceNorthfieldCloseoutDocument} style={{display:'grid',gap:12}}>
      <input type="hidden" name="project_id" value={PROJECT}/>
      <input type="hidden" name="kind" value={kind}/>
      <input type="hidden" name="step" value={next}/>
      <label className={css.meta}><input type="checkbox" name="acknowledge" value="reviewed" required/> I reviewed the R01 PDF and underlying evidence for this {next} decision.</label>
      <button className={css.action} type="submit" style={{border:0,cursor:'pointer'}}>{button} →</button>
    </form>:<p className={css.meta}>{doc?.status==='issued'?'Issued and recorded.': 'No further status change available.'}</p>}
 </div>;
}

export default async function CloseoutEvidencePage({params,searchParams}:{
 params:Promise<{id:string}>;searchParams:Promise<{updated?:string;error?:string}>;
}){
 const {id}=await params;
 if(id!==PROJECT)notFound();
 const {updated,error}=await searchParams;
 const e=await getCloseoutEvidence(id);
 const {data:readiness,error:readinessError}=await e.supabase.rpc('op_project_stage_readiness',{p_project_id:id});
 const blockers:string[]=Array.isArray(readiness?.reasons)?readiness.reasons:[];
 return <section className={css.section} style={{maxWidth:900,margin:'36px auto',display:'grid',gap:18}}>
  <p className={css.overline}>PROJECT / OP-PRJ-2026-0002 / CLOSEOUT EVIDENCE</p>
  <h1 style={{fontSize:31,margin:0}}>Northfield · Final closeout records</h1>
  <p className={css.meta}>One controlled path from the existing paid quotation through project invoice reconciliation, Completion Report and governed closure. QA-only evidence. No external charges or client emails.</p>
  {updated?<div className={css.card} role="status">{updated}</div>:null}
  {error?<div className={css.card} role="alert">{error}</div>:null}
  <div className={css.card} style={{display:'grid',gap:10}}>
   <h2 style={{fontSize:20,margin:0}}>Customer payment reconciliation</h2>
   <dl className={css.detailFacts}>
    <div><dt>Accepted quotation</dt><dd>£2,149.25</dd></div>
    <div><dt>Verified Stripe TEST opening payment</dt><dd>£644.78</dd></div>
    <div><dt>Existing paid final invoice</dt><dd>£1,504.47</dd></div>
    <div><dt>Historical opening invoice</dt><dd>{e.deposit?'Recorded · QA':'Not yet reconciled'}</dd></div>
    <div><dt>Invoiced total</dt><dd>{e.billingReady?'£2,149.25 · fully accounted for':'£1,504.47 · missing opening ledger record'}</dd></div>
    <div><dt>Additional charge required</dt><dd>£0.00</dd></div>
   </dl>
   {!e.deposit?<form action={reconcileNorthfieldOpeningInvoice} style={{display:'grid',gap:12}}>
    <input type="hidden" name="project_id" value={id}/>
    <label className={css.meta}><input type="checkbox" name="acknowledge" value="verified" required/> I confirm the existing £644.78 Stripe TEST payment will be reconciled as a historical deposit invoice entry. No new payment will be collected.</label>
    <button className={css.action} type="submit" style={{border:0,cursor:'pointer'}}>Reconcile existing £644.78 payment →</button>
   </form>:<p className={css.meta}>Historical opening payment has been recorded without charging the client again.</p>}
  </div>
  <Section kind="invoice" doc={e.invoiceDoc} billingReady={e.billingReady}/>
  <Section kind="completion-report" doc={e.completionDoc} billingReady={e.billingReady}/>
  <div className={css.card} style={{display:'grid',gap:10}}>
   <h2 style={{fontSize:20,margin:0}}>Canonical closure verification</h2>
   {readinessError?<p role="alert">Project readiness unavailable: {readinessError.message}</p>:null}
   {readiness?.ready===true?<p>All governed readiness checks have passed. Return to Partner Settlement to make the separate, attributable owner closure decision.</p>:
    <p className={css.meta}>Project closure is still locked by the original independent readiness function.</p>}
   {blockers.map((reason,i)=><p key={i} className={css.meta}>• {reason}</p>)}
   <Link className={css.secondaryLink} href={'/opos-next/projects/'+id+'/partner-settlement'}>Return to Partner Settlement and closure →</Link>
   <Link className={css.secondaryLink} href={'/opos-next/projects/'+id}>Return to Northfield Project 360 →</Link>
  </div>
 </section>;
}
