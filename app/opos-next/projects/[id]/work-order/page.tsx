import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {retryGovernedWorkOrderAction,retryNorthfieldQaInvitationAction} from './action';
import css from '../../../opos.module.css';

export const dynamic='force-dynamic';
export const metadata={title:'Execution Partner Work Order | OPOS QA',robots:{index:false,follow:false}};
type Query={error?:string;success?:string};
export default async function WorkOrderReadiness({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Query>}){
  const {id}=await params;
  const feedback=await searchParams;
  const {supabase,organisationId,profile}=await requireUserContext();
  const qa=isKnownIsolatedQaBackend();
  if(!qa)notFound();
  const {data:project,error:projectError}=await supabase.from('projects')
    .select('id,quote_id,project_number,title,project_stage,start_date,due_date,lead_id')
    .eq('id',id).eq('organisation_id',organisationId).maybeSingle();
  if(projectError||!project)notFound();
  const [quoteResult,financialResult,sowResult,assignmentResult,acceptanceResult,notificationResult,workOrderResult,handoffResult]=await Promise.all([
    supabase.from('quotes').select('id,commercial_review_id').eq('id',project.quote_id).eq('organisation_id',organisationId).maybeSingle(),
    supabase.rpc('op_project_financial_gate',{p_project_id:id}),
    supabase.from('documents').select('id,status,title,reference,revision_code,document_type,is_current_revision')
      .eq('organisation_id',organisationId).eq('project_id',id).in('document_type',['scope-of-work','statement-of-work'])
      .eq('is_current_revision',true).order('created_at',{ascending:false}).limit(12),
    supabase.from('project_execution_assignments').select('id,partner_id,scope_document_id,execution_state,release_reference,released_at')
      .eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
    supabase.from('partner_work_order_acceptances').select('id,assignment_id,scope_document_id,accepted_by_name,accepted_by_role,accepted_at')
      .eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
    // Signed-in workspace members read delivery state via the authorised
    // organisation-scoped RPC. Raw outbox SELECT is intentionally RLS-hidden.
    supabase.rpc('op_list_notification_delivery',{p_limit:150}),
    supabase.from('partner_work_orders').select('id,reference,partner_price,currency,scope_document_id,issued_at')
      .eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
    supabase.from('project_work_order_handoffs').select('status,last_blocker,attempts,updated_at')
      .eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
  ]);
  let partnerName='Not commercially selected';
  let selectedPartnerId='';
  let partnerApproved=false;
  let partnerNda=false;
  let partnerEmail=false;
  let partnerAgreementVerified=false;
  const quote=quoteResult.data;
  if(quote?.commercial_review_id){
    const {data:review,error:reviewError}=await supabase.from('commercial_reviews')
      .select('partner_quote_id,status').eq('organisation_id',organisationId).eq('id',quote.commercial_review_id).maybeSingle();
    if(!reviewError&&review?.partner_quote_id&&String(review.status)==='approved'){
      const {data:pq}=await supabase.from('partner_quotes').select('partner_id,status')
        .eq('organisation_id',organisationId).eq('id',review.partner_quote_id).maybeSingle();
      if(pq?.partner_id&&['received','selected'].includes(String(pq.status))){
        const {data:partner}=await supabase.from('partners').select('id,company_name,status,nda_signed,email')
          .eq('organisation_id',organisationId).eq('id',pq.partner_id).maybeSingle();
        if(partner){selectedPartnerId=partner.id;partnerName=partner.company_name;partnerApproved=partner.status==='approved';partnerNda=Boolean(partner.nda_signed);partnerEmail=Boolean(partner.email);}
      }
    }
  }
  if(selectedPartnerId){
    const {data:agreement,error:agreementError}=await supabase.from('partner_execution_agreement_evidence')
      .select('id,signed_at,verified_at').eq('organisation_id',organisationId).eq('partner_id',selectedPartnerId)
      .eq('is_current',true).maybeSingle();
    partnerAgreementVerified=!agreementError&&Boolean(agreement?.id&&agreement.signed_at&&agreement.verified_at&&new Date(agreement.signed_at).getTime()<=new Date(agreement.verified_at).getTime());
  }
  const sow=sowResult.data||[];
  const approved=sow.filter(x=>['approved','issued','published'].includes(x.status)&&x.is_current_revision);
  const earlierApprovedScope=approved.filter(x=>(x as {document_type?:string}).document_type==='scope-of-work');
  const approvedCandidates=earlierApprovedScope.length?earlierApprovedScope:approved.filter(x=>(x as {document_type?:string}).document_type==='statement-of-work');
  const financial=financialResult.data as {authorised?:boolean;basis?:string;received?:number;required?:number}|null;
  const settled=!financialResult.error&&financial?.authorised===true&&financial?.basis==='deposit'
     &&Number(financial.required)>0&&Number(financial.received)>=Number(financial.required);
  const blockers:string[]=[];
  if(!settled)blockers.push('The verified opening deposit must satisfy the governed financial release gate.');
  if(!quote?.commercial_review_id)blockers.push('The accepted quotation has no approved commercial review lineage.');
  else if(!selectedPartnerId)blockers.push('The approved commercial review does not identify an Execution Partner.');
  if(selectedPartnerId&&!partnerApproved)blockers.push('The commercially selected Execution Partner is not approved.');
  if(selectedPartnerId&&!partnerNda)blockers.push('The commercially selected Execution Partner has no signed NDA evidence.');
  if(selectedPartnerId&&!partnerEmail)blockers.push('The Execution Partner has no verified delivery email.');
  if(selectedPartnerId&&!partnerAgreementVerified)blockers.push('The signed Execution Partner Agreement has not been independently verified.');
  if(approvedCandidates.length!==1)blockers.push('Exactly one approved execution scope inherited from the quotation is required for Work Order issue.');
  if(!['mobilisation','ready_for_execution'].includes(String(project.project_stage)))blockers.push('Work Order issuance is available only before active execution begins.');
  const assignment=assignmentResult.data;
  const accepted=acceptanceResult.data;
  const assignmentMatched=Boolean(assignment&&selectedPartnerId&&assignment.partner_id===selectedPartnerId
    &&approvedCandidates.length===1&&assignment.scope_document_id===approvedCandidates[0].id);
  if(assignment&&!assignmentMatched)blockers.push('Existing assignment does not match the commercially approved partner and current scope.');
  const email=Array.isArray(notificationResult.data)
    ? notificationResult.data.find((row:{entity_id?:string;event_key?:string})=>
        row.entity_id===id&&row.event_key==='partner_work.released')||null
    : null;
  const workOrder=workOrderResult.data;
  const handoff=handoffResult.data;
  if([quoteResult,financialResult,sowResult,assignmentResult,acceptanceResult,workOrderResult,handoffResult].some(result=>Boolean(result.error)))
    blockers.push('Some governed evidence could not be retrieved; issuance is locked until verification is restored.');
  const actionable=blockers.length===0 && !workOrder?.issued_at && ['owner','admin'].includes(String(profile.role));
  const deliveryPending=Boolean(workOrder?.issued_at&&!accepted?.id&&email&&
    email.status!=='sent');
  const canRetryInvitation=deliveryPending&&['owner','admin'].includes(String(profile.role))&&
    String(project.id)==='b447f586-bf79-4839-be5e-1af607d9ca43';
  const actualStatus=accepted?.id?'Formally accepted':deliveryPending?
    'Work Order issued · partner invitation pending':workOrder?.issued_at?
    'Work Order issued · partner acceptance pending':blockers.length?'Blocked · evidence required':'Ready for automatic issue';
  return <div className={css.shell} style={{maxWidth:1000,margin:'0 auto',padding:'38px 20px',display:'grid',gap:24}}>
    <Link className={css.secondaryLink} href={'/opos-next/projects/'+id}>← Project 360</Link>
    <header><span className={css.overline}>ISOLATED QA · PROJECT 360</span><h1 style={{fontSize:32,fontWeight:650,marginTop:12}}>Execution Partner Work Order</h1>
      <p className={css.meta}>{project.project_number} · {project.title}</p></header>
    {feedback.error?<p role="alert" className={css.empty}>Action blocked: {feedback.error.slice(0,450)}</p>:null}
    {feedback.success?<p role="status" className={css.empty}>{feedback.success.slice(0,450)}</p>:null}
    <section className={css.card}>
      <span className={css.overline}>ONE NEXT ACTION</span>
      <h2 className={css.cardTitle}>{actualStatus}</h2>
      <p className={css.cardDescription}>{accepted?.id?'The named Execution Partner has accepted the controlled Work Order. Commencement still requires completed mobilisation.':workOrder?.issued_at?'The Work Order has been issued against the previously approved partner and scope. Formal partner acceptance and commencement remain separate.':blockers.length?'Correct the original commercial or scope evidence; no second partner selection or internal approval is required.':'The signed payment-to-project handoff can issue the already-approved partner Work Order. Partner acceptance is required before commencement.'}</p>
      {blockers.length?<ul style={{paddingLeft:20,marginTop:18}}>{blockers.map((reason,index)=><li key={index} style={{marginBottom:8}}>{reason}</li>)}</ul>:null}
      {canRetryInvitation?<form action={retryNorthfieldQaInvitationAction} style={{marginTop:22}}>
        <input type="hidden" name="project_id" value={id}/>
        <p className={css.meta}>The original Work Order is issued. Resend rejected its test-recipient alias. This action retries only the existing email to your verified primary QA inbox; it does not issue another Work Order.</p>
        <button className={css.action} type="submit" style={{border:0,cursor:'pointer',marginTop:12}}>
          Deliver existing QA partner invitation →
        </button>
      </form>:null}
      {actionable&&!accepted?.id?<form action={retryGovernedWorkOrderAction} style={{marginTop:22}}>
        <input type="hidden" name="project_id" value={id}/>
        <button className={css.action} type="submit" style={{border:0,cursor:'pointer'}}>Retry automatic Work Order handoff →</button>
      </form>:null}
    </section>
    <section className={css.card}>
      <span className={css.overline}>CONTROLLED EVIDENCE</span>
      <div className={css.factRow} style={{marginTop:18}}>
        <span>Verified opening deposit: <strong>{settled?'Confirmed':'Not verified'}</strong></span>
        <span>Commercial partner: <strong>{partnerName}</strong></span>
        <span>Execution Partner Agreement: <strong>{partnerAgreementVerified?'Verified':'Not verified'}</strong></span>
        <span>Approved execution scope: <strong>{approvedCandidates.length===1?(approvedCandidates[0].reference||'Available'):'Not ready'}</strong></span>
        <span>Project SOW for mobilisation: <strong>{approved.some(x=>(x as {document_type?:string}).document_type==='statement-of-work')?'Approved':'Not yet approved'}</strong></span>
        <span>Project stage: <strong>{String(project.project_stage).replaceAll('_',' ')}</strong></span>
        <span>Work Order issue: <strong>{workOrder?.issued_at?workOrder.reference:'Not issued'}</strong></span>
        <span>Partner commercial price: <strong>{workOrder?.issued_at?workOrder.currency+' '+Number(workOrder.partner_price).toFixed(2):'Not issued'}</strong></span>
        <span>Automatic payment handoff: <strong>{handoff?.status?handoff.status.replaceAll('_',' '):'Not attempted'}</strong></span>
        <span>Partner acceptance: <strong>{accepted?.accepted_at?'Recorded':'Not recorded'}</strong></span>
        <span>Partner notification: <strong>{email?.status==='sent'&&email.sent_at?'Provider accepted':email?.status||'Not queued'}</strong></span>
      </div>
      {accepted?.accepted_at?<p className={css.meta} style={{marginTop:18}}>Accepted by {accepted.accepted_by_name} ({accepted.accepted_by_role}) on {new Date(accepted.accepted_at).toLocaleString('en-GB')}. Acceptance is evidenced by the signed partner-session action, not merely opening the page.</p>:null}
      {handoff?.last_blocker&&!workOrder?.issued_at?<p role="alert" className={css.meta}>Payment handoff blocker: {String(handoff.last_blocker).slice(0,300)}</p>:null}
      {email?.last_error?<p role="alert" className={css.meta}>Notification error: {String(email.last_error).slice(0,300)}</p>:null}
      <p className={css.meta} style={{marginTop:18}}>A queued email does not prove delivery. Work commencement, engineering submissions, client review, final payment and partner settlement require their own verified gates. No partner advance is authorised.</p>
    </section>
  </div>;
}
