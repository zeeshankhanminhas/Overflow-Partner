import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import css from '../../../opos.module.css';

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
 // The screen is a read-only readiness surface. It NEVER creates an invoice,
 // records a payment, marks evidence verified or mints final-file links.
 const {data:project,error:projectError}=await supabase.from('projects')
  .select('id,project_number,title,project_stage,quote_id')
  .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
 if(projectError||!project)notFound();
 if(!['completion','closed'].includes(project.project_stage))notFound();
 const quoteResult=project.quote_id?await supabase.from('quotes')
  .select('id,quote_number,revision,total,currency')
  .eq('organisation_id',organisationId).eq('id',project.quote_id).maybeSingle():{data:null,error:null};
 const quote=quoteResult.data;
 const [contractResult,openingResult,reviewResult,statusResult,invoicesResult]=await Promise.all([
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
   .eq('organisation_id',organisationId).eq('project_id',id).limit(100)
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
 const unsettled=invoiceRows.filter(item=>Number(item.total||0)>Number(item.amount_paid||0));
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
   <p className={css.meta}>Final client invoice: {invoicesResult.error?'Ledger unavailable':invoiceRows.length===0?'No project-linked invoice issued':unsettled.length?'Outstanding invoice exists':'Invoice records present; verify their reconciliation separately'}. No invoice or payment is created by opening this page.</p>
   <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
    <Link className={css.secondaryLink} href={base+'#final-release'}>Back to project release controls →</Link>
    <Link className={css.secondaryLink} href="/opos-next/finance">Open invoice register →</Link>
   </div>
  </div>
  <div className={css.card} style={{display:'grid',gap:10}}>
   <h3 style={{fontSize:16,margin:0}}>Client-side test path</h3>
   <p className={css.meta}>In the separate Northfield Client account, open the project and choose <strong>View final balance</strong>. That route verifies the client's active entitlement, then opens the existing protected final-settlement page. An Operator session is not a Client account.</p>
   <p className={css.meta}>No native files may be downloaded before verified final settlement and a separate owner decision.</p>
  </div>
 </section>;
}
