import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getQaScenario,PROJECT,BASE} from '@/lib/qa/northfieldPartnerSettlement';
import {
 createQaPartnerPayable,approveQaPartnerPayable,
 simulateQaPartnerPayment,closeQaNorthfieldProject
} from './actions';
import css from '../../../opos.module.css';

export const dynamic='force-dynamic';
function money(n:unknown){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(n||0));}
export default async function QaPartnerSettlement({params,searchParams}:{
 params:Promise<{id:string}>;
 searchParams:Promise<{error?:string;updated?:string}>;
}){
 const {id}=await params;
 if(id!==PROJECT)notFound();
 const {error,updated}=await searchParams;
 const {supabase,project,wo,quote,submission,payable,payments,status}=await getQaScenario(id);
 const {data:closeout,error:closeoutError}=await supabase.rpc('op_project_stage_readiness',{p_project_id:id});
 const blockers:Array<string>=Array.isArray(closeout?.reasons)?closeout.reasons:[];
 const simulated=payments.find(p=>p.payment_method==='qa_simulated_bank_transfer'&&p.status==='cleared');
 const isPaid=payable?.status==='paid'&&Number(payable.amount_paid)===1200&&Boolean(simulated);
 const canClose=isPaid&&status?.readyForManualClosure===true&&closeout?.ready===true&&!closeoutError;
 const stage=project.project_stage;
 const payableState=payable?.status||'not created';
 return <section className={css.section} style={{display:'grid',gap:18,maxWidth:900,margin:'36px auto'}}>
  <p className={css.overline}>PROJECT / {project.project_number} / EXECUTION PARTNER SETTLEMENT</p>
  <h1 style={{fontSize:30,margin:0}}>Partner settlement — QA simulation</h1>
  <p className={css.meta}>This is a controlled end-to-end test of the existing finance ledger and closure gates. It does not send any money, instruct a bank or issue a genuine supplier invoice.</p>
  <div className={css.card} role="note" style={{border:'1px solid #bb9b55',display:'grid',gap:6}}>
   <strong>SIMULATED BANK PAYMENT — NOT REAL FUNDS</strong>
   <p className={css.meta}>Only Northfield in the isolated OPOS-QA database is eligible. Any payment here is permanently labelled QA-SIM and excluded from the normal bank-transfer workflow. Do not use these references in actual accounting.</p>
  </div>
  {error?<p className={css.card} role="alert">{error}</p>:null}
  {updated?<p className={css.card} role="status">{updated}</p>:null}
  <div className={css.card} style={{display:'grid',gap:14}}>
   <h2 style={{fontSize:18,margin:0}}>Selected Execution Partner commitment</h2>
   <dl className={css.detailFacts}>
    <div><dt>Work Order</dt><dd>{wo.reference}</dd></div>
    <div><dt>Selected partner quotation</dt><dd>{quote.id.slice(0,8).toUpperCase()} · selected</dd></div>
    <div><dt>Partner amount</dt><dd>{money(wo.partner_price)}</dd></div>
    <div><dt>Current accepted engineering submission</dt><dd>{submission.id.slice(0,8)} · R01</dd></div>
    <div><dt>Client final settlement</dt><dd>{status?.finalPaid?'Verified':'Blocked'}</dd></div>
    <div><dt>Owner final-release decision</dt><dd>{status?.ownerApproved?'Approved':'Blocked'}</dd></div>
    <div><dt>Partner payable</dt><dd>{payableState}</dd></div>
    <div><dt>Partner balance (QA)</dt><dd>{payable?money(Math.max(0,Number(payable.total)-Number(payable.amount_paid))):'Not yet recorded'}</dd></div>
    <div><dt>Bank settlement</dt><dd>{isPaid?'QA-SIM · reconciliation succeeded':'No simulated payment recorded'}</dd></div>
   </dl>
   <p className={css.meta}>For QA, the selected Work Order amount is treated as a £1,200 gross fixture with £0 test VAT. VAT treatment and a real supplier invoice must be independently verified before any production payment.</p>
  </div>
  {stage==='closed'?<div className={css.card} role="status">
    <h2 style={{fontSize:19,margin:0}}>Northfield QA project closed</h2>
    <p>The governed closure engine completed with explicitly simulated partner settlement. No real bank transfer occurred.</p>
   </div>:
   <>
   {!payable?<div className={css.card} style={{display:'grid',gap:12}}>
    <h2 style={{fontSize:19,margin:0}}>1. Record partner payable</h2>
    <p className={css.meta}>Creates a RECEIVED liability from the selected Work Order and a clearly synthetic supplier-invoice fixture. No approval or payment is inferred.</p>
    <form action={createQaPartnerPayable}><input type="hidden" name="project_id" value={id}/>
     <button className={css.action} type="submit" style={{border:0,cursor:'pointer'}}>Create £1,200 QA payable →</button>
    </form>
   </div>:null}
   {payable?.status==='received'?<div className={css.card} style={{display:'grid',gap:12}}>
    <h2 style={{fontSize:19,margin:0}}>2. Approve liability</h2>
    <p className={css.meta}>Review the accepted R01 file evidence and the selected £1,200 Work Order. This fixture does not replace a genuine supplier invoice for production.</p>
    <form action={approveQaPartnerPayable} style={{display:'grid',gap:12}}>
     <input type="hidden" name="project_id" value={id}/>
     <label className={css.meta}><input type="checkbox" name="confirm_evidence" value="yes" required/> I have checked the accepted delivery and agree to approve this synthetic QA liability.</label>
     <button className={css.action} type="submit" style={{border:0,cursor:'pointer'}}>Approve QA payable →</button>
    </form>
   </div>:null}
   {payable?.status==='approved'&&!payments.length?<div className={css.card} style={{display:'grid',gap:12}}>
    <h2 style={{fontSize:19,margin:0}}>3. Simulate bank transfer</h2>
    <p className={css.meta}>Exercises the same settlement and reconciliation triggers as a bank transfer, but the payment method is `qa_simulated_bank_transfer`. No external transfer or notification takes place.</p>
    <form action={simulateQaPartnerPayment} style={{display:'grid',gap:12,maxWidth:580}}>
     <input type="hidden" name="project_id" value={id}/>
     <label className={css.meta}><input type="checkbox" name="confirm_simulation" value="yes" required/> I understand this records a synthetic £1,200 payment only in isolated QA. It is not bank evidence.</label>
     <label style={{display:'grid',gap:6}}>Type SIMULATE to confirm
      <input name="confirmation" required placeholder="SIMULATE" autoComplete="off" style={{padding:12,borderRadius:8,border:'1px solid gray',background:'transparent',color:'inherit'}}/>
     </label>
     <button className={css.action} type="submit" style={{border:0,cursor:'pointer'}}>Record simulated £1,200 settlement →</button>
    </form>
   </div>:null}
   {isPaid?<div className={css.card} style={{display:'grid',gap:8}} role="status">
    <h2 style={{fontSize:19,margin:0}}>QA payment reconciliation passed</h2>
    <p className={css.meta}>The simulated transfer carries reference <strong>{simulated?.reference}</strong>. The QA payable has reached Paid through the existing ledger trigger. This is NOT a real cleared bank transfer.</p>
   </div>:null}
   <div className={css.card} style={{display:'grid',gap:10}}>
    <h2 style={{fontSize:19,margin:0}}>4. Governed project closure</h2>
    {canClose?<form action={closeQaNorthfieldProject} style={{display:'grid',gap:12}}>
     <input type="hidden" name="project_id" value={id}/>
     <label className={css.meta}><input type="checkbox" name="confirm_closure" value="yes" required/> I authorise closing the isolated Northfield QA project after reviewing all governed evidence. Its partner transfer is simulated.</label>
     <button className={css.action} type="submit" style={{border:0,cursor:'pointer'}}>Close Northfield QA project →</button>
    </form>:<p className={css.meta}>Closure remains locked until the canonical project readiness function confirms every requirement. No shortcut is provided.</p>}
    {closeoutError?<p role="alert">Project readiness is unavailable: {closeoutError.message}</p>:null}
    {blockers.length?<Link className={css.secondaryLink} href={'/opos-next/projects/'+id+'/closeout-evidence'}>Reconcile opening payment and issue closeout documents →</Link>:null}
    {blockers.length?<div style={{display:'grid',gap:8}}>
      <strong>Outstanding closeout evidence</strong>
      {blockers.map((reason,i)=><p key={i} className={css.meta}>• {reason}</p>)}
     </div>:null}
    {!blockers.length&&!canClose?<p className={css.meta}>Finish the prior payable and simulated payment steps; project closure is a separate authenticated decision.</p>:null}
    <Link className={css.secondaryLink} href={'/opos-next/projects/'+id}>Return to Northfield Project 360 →</Link>
    <Link className={css.secondaryLink} href="/opos-next/finance">Review Finance register →</Link>
   </div>
   </>}
 </section>;
}
