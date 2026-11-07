import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import css from '../../../opos.module.css';
import {issueQaFinalInvoice} from './issue-invoice-action';

export const dynamic='force-dynamic';

function gbp(value:number,currency:string){
 return new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'GBP'}).format(value);
}
const CLIENT_KINDS=['accepted','accepted_with_comments'];

export default async function ProjectFinalSettlement({params}:{
 params:Promise<{id:string}>;
}){
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const {supabase,user,profile,organisationId}=await requireUserContext('/opos-next');
 assertRole(profile.role,['owner','admin','operator','engineering','commercial']);
 const base='/opos-next/projects/'+id;
 // Reading this screen never mutates commercial or payment data.
 // A separate authenticated server action may issue only the governed final invoice.
 const {data:project,error:projectError}=await supabase.from('projects')
  .select('id,project_number,title,project_stage,quote_id')
  .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
 if(projectError||!project)notFound();
 if(!['completion','closed'].includes(project.project_stage))notFound();
 const quoteResult=project.quote_id?await supabase.from('quotes')
  .select('id,quote_number,revision,total,currency')
  .eq('organisation_id',organisationId).eq('id',project.quote_id).maybeSingle():{data:null,error:null};
 const quote=quoteResult.data;
 const [contractResult,openingResult,reviewResult,statusResult,invoicesResult,documentsResult]=await Promise.all([
  quote?supabase.from('quote_release_contracts')
   .select('opening_amount,release_basis').eq('organisation_id',organisationId)
   .eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle():Promise.resolve({data:null,error:null}),
  quote?supabase.from('quote_payment_confirmations')
   .select('amount,payment_method').eq('organisation_id',organisationId)
   .eq('quote_id',quote.id).maybeSingle():Promise.resolve({data:null,error:null}),
  supabase.from('project_client_reviews').select('outcome,recorded_at')
   .eq('organisation_id',organisationId).eq('project_id',id)
   .order('recorded_at',{ascending:false}).limit(1).maybeSingle(),
  isKnownIsolatedQaBackend()?supabase.rpc('op_project_voice_final_release_status',{
   p_organisation_id:organisationId,p_user_id:user.id,p_project_id:id
  }):Promise.resolve({data:null,error:null}),
  supabase.from('invoices').select('id,invoice_number,invoice_type,status,total,amount_paid')
   .eq('organisation_id',organisationId).eq('project_id',id).limit(100),
  supabase.from('documents').select('id,reference,title,document_type,status,revision_code,is_current_revision,storage_path,approved_at,issued_at')
   .eq('organisation_id',organisationId).eq('project_id',id)
   .in('document_type',['handover-pack','completion-report','document-register'])
 ]);
 const error=Boolean(quoteResult.error||contractResult.error||openingResult.error||
  reviewResult.error||statusResult.error||invoicesResult.error);
 const terms=contractResult.data;
 const total=Number(quote?.total);
 const opening=Number(terms?.opening_amount);
 const balance=Math.round((total-opening)*100)/100;
 const amountReady=!error&&Boolean(quote&&terms&&
  ['deposit','payment'].includes(String(terms.release_basis)))&&
  Number.isFinite(total)&&Number.isFinite(opening)&&Number.isFinite(balance)&&
  opening>=0&&balance>=0&&opening<=total;
 const openingConfirmed=Boolean(amountReady&&openingResult.data&&
  Number(openingResult.data.amount)>=opening);
 const accepted=Boolean(!reviewResult.error&&CLIENT_KINDS.includes(String(reviewResult.data?.outcome||'')));
 const final=statusResult.data as null|{clientAccepted:boolean;finalPaid:boolean;ownerApproved:boolean;partnerPaid:boolean;readyForManualClosure:boolean};
 const currency=String(quote?.currency||'GBP');
 const finalServiceEnabled=isKnownIsolatedQaBackend()&&process.env.OP_VOICE_FINAL_RELEASE_ENABLED==='true';
 const invoiceRows=invoicesResult.data||[];
 const controlled=documentsResult.data||[];
 const handover=controlled.find(x=>x.document_type==='handover-pack'&&x.is_current_revision);
 const handoverIssued=Boolean(handover&&['issued','published'].includes(handover.status)&&handover.approved_at&&handover.issued_at&&handover.storage_path);
 const completedDocs=controlled.filter(x=>x.document_type!=='handover-pack');
 const finalInvoice=invoiceRows.find(item=>item.invoice_type==='final'&&item.status!=='cancelled');
 const canIssueInvoice=isKnownIsolatedQaBackend()&&['owner','admin','commercial'].includes(String(profile.role))&&amountReady&&openingConfirmed&&accepted&&!finalInvoice&&invoiceRows.length===0;
 return <section className={css.section} style={{maxWidth:860,margin:'32px auto',display:'grid',gap:20}}>
  <p className={css.meta}>PROJECT / {project.project_number} / COMMERCIAL CLOSEOUT</p>
  <h1 style={{fontSize:32,margin:0}}>Final settlement and handover</h1>
  <p className={css.meta}>Engineering delivery has been accepted. Commercial settlement,
   final handover approval and project closure remain separate governed actions.</p>
  <div className={css.card} style={{display:'grid',gap:12}}>
   <span className={css.overline}>FINAL CLIENT BALANCE</span>
   <h2 style={{fontSize:32,margin:0}}>{amountReady?gbp(balance,currency):'Awaiting verified terms'}</h2>
   {amountReady?<dl className={css.detailFacts}>
    <div><dt>Accepted quotation</dt><dd>{quote?.quote_number} · {gbp(total,currency)}</dd></div>
    <div><dt>Frozen opening amount</dt><dd>{gbp(opening,currency)}</dd></div>
    <div><dt>Opening payment evidence</dt><dd>{openingConfirmed?'Recorded':'Not confirmed'}</dd></div>
    <div><dt>Remaining contractual balance</dt><dd>{gbp(balance,currency)}</dd></div>
   </dl>:<p role="alert">The accepted quote or frozen settlement terms could not be verified. No payment request should be issued.</p>}
  </div>
  <div className={css.card} style={{display:'grid',gap:12}}>
   <h2 style={{fontSize:20,margin:0}}>What needs to happen next</h2>
   <dl className={css.detailFacts}>
    <div><dt>Client review</dt><dd>{accepted?'Accepted':'Not verified'}</dd></div>
    <div><dt>Final payment</dt><dd>{final?.finalPaid?'Verified':final?'Not verified':'Status unavailable'}</dd></div>
    <div><dt>Owner release</dt><dd>{final?.ownerApproved?'Approved':'Not approved'}</dd></div>
    <div><dt>Execution Partner settlement</dt><dd>{final?.partnerPaid?'Verified':'Outstanding / unverified'}</dd></div>
    <div><dt>Project closure</dt><dd>{project.project_stage==='closed'?'Closed':final?.readyForManualClosure?'Eligible for separate closure approval':'Blocked until all gates pass'}</dd></div>
   </dl>
   {error||!amountReady||!final?
    <p role="alert" className={css.meta}>One or more financial evidence checks are unavailable. Do not accept or release files based on this view.</p>:
    !final.finalPaid?
    <p className={css.meta}><strong>Next action: final client payment.</strong> The Client must open their own authenticated Client Workspace and select their project's final payment. Checkout remains subject to the isolated QA payment-service gate. A Stripe return alone does not verify settlement.</p>:
    !final.ownerApproved?
    <p className={css.meta}>Final payment has been verified. The owner must independently authorise the exact final engineering revision before handover. {finalServiceEnabled?'The owner release control is available on Project 360.':'The owner release service is not enabled in this QA preview.'}</p>:
    <p className={css.meta}>Final engineering release is approved. Complete partner settlement and the separate project closure gate.</p>}
   <div className={css.meta}>Final client invoice: {invoicesResult.error?'Ledger unavailable':finalInvoice?finalInvoice.invoice_number+' · '+finalInvoice.status:invoiceRows.length===0?'Not issued':'Other project invoices exist; verify the final invoice separately'}. Opening this page never creates an invoice or payment.
   {canIssueInvoice?<form action={issueQaFinalInvoice} style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:8,marginTop:10}}>
    <input type="hidden" name="project_id" value={id}/>
    <button type="submit" className={css.action} style={{cursor:'pointer'}}>Issue governed final invoice →</button>
    <span className={css.meta}>One invoice for the accepted quote balance. This does not confirm any payment or release engineering files.</span>
   </form>:null}</div>
   <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
    <Link className={css.secondaryLink} href={base+'#final-release'}>Back to project release controls →</Link>
    <Link className={css.secondaryLink} href="/opos-next/finance">Open invoice register →</Link>
   </div>
  </div>
  <div className={css.card} style={{display:'grid',gap:12}}>
   <h3 style={{fontSize:18,margin:0}}>Controlled final handover readiness</h3>
   <p className={css.meta}>The accepted Partner R01 drawing alone is not the issued Handover Pack. The final handover remains blocked until the current pack is approved, issued and linked to a protected stored document.</p>
   <dl className={css.detailFacts}>
    <div><dt>Current Handover Pack</dt><dd>{handover?handover.reference+' · '+handover.revision_code:'Missing'}</dd></div>
    <div><dt>Document control</dt><dd>{handover?String(handover.status).replaceAll('_',' '):'Not registered'}</dd></div>
    <div><dt>Controlled file</dt><dd>{handover?.storage_path?'Recorded in private storage':'Not attached'}</dd></div>
    <div><dt>Release readiness</dt><dd>{handoverIssued?'Issued evidence recorded':'Blocked: issued approved file required'}</dd></div>
   </dl>
   {handover?<><Link className={css.secondaryLink} href={base+'/handover'}>Prepare and review controlled Handover Pack →</Link><Link className={css.secondaryLink} href={'/opos-next/documents/'+handover.id}>Open document register entry →</Link></>:null}
   {completedDocs.map(d=><Link key={d.id} className={css.secondaryLink} href={'/opos-next/documents/'+d.id}>{d.title} · {d.status} →</Link>)}
   <Link className={css.secondaryLink} href={base+'#final-release'}>Return to the separate owner release decision →</Link>
  </div>
  <div className={css.card} style={{display:'grid',gap:10}}>
   <h3 style={{fontSize:16,margin:0}}>Client-side test path</h3>
   <p className={css.meta}>In the separate Northfield Client account, open the project and choose <strong>View final balance</strong>. That route verifies the client's active entitlement, then opens the existing protected final-settlement page. An Operator session is not a Client account.</p>
   <p className={css.meta}>No native files may be downloaded before verified final settlement and a separate owner decision.</p>
  </div>
 </section>;
}
