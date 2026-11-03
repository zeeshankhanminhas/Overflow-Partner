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
  const issued=Boolean(workOrder?.issued_at);
  const executionLive=['in_progress','internal_review','partner_correction','ready_for_client_issue','issued_to_client','client_review','completion','closed'].includes(String(project.project_stage));
  const actualStatus=accepted?.id?(executionLive?'Work Order accepted · execution active':'Work Order formally accepted'):deliveryPending?
    'Work Order issued · partner invitation pending':workOrder?.issued_at?
    'Work Order issued · partner acceptance pending':blockers.length?'Blocked · evidence required':'Ready for automatic issue';
  return <article className={css.detailPage}>
    <Link className={css.detailBack} href={'/opos-next/projects/'+id}>← Back to Project 360</Link>
    <header className={css.detailHeader}><span className={css.overline}>WORK / PROJECT 360 / WORK ORDER</span><h1 className={css.detailTitle}>Execution Partner Work Order</h1>
      <p className={css.detailSubtitle}>{project.project_number} · {project.title}</p></header>
    {feedback.error?<p role="alert" className={css.detailNotice+" "+css.detailNoticeError}>Action blocked: {feedback.error.slice(0,450)}</p>:null}
    {feedback.success?<p role="status" className={css.detailNotice+" "+css.detailNoticeSuccess}>{feedback.success.slice(0,450)}</p>:null}
    <section className={css.detailPanel+" "+css.detailLead}>
      <span className={css.overline}>WORK ORDER · CURRENT POSITION</span>
      <h2 className={css.cardTitle}>{actualStatus}</h2>
      <p className={css.cardDescription}>{accepted?.id?
        executionLive?'The Execution Partner has formally accepted WO-01 and commencement has been recorded. Engineering progress, deliverables and internal OP quality review are the next controlled milestones. This Work Order remains the immutable commercial basis.':
        'The Execution Partner formally accepted this Work Order. OPOS must authorise mobilisation and the partner must separately confirm commencement before technical work begins.':
        issued?'The governed Work Order was issued against the approved scope and selected partner. Await formal partner acceptance before commencement.':
        blockers.length?'Resolve the recorded contractual or technical evidence before issuing a Work Order.':
        'All pre-issue checks have passed. Issue the original governed Work Order, then verify the partner invitation and formal acceptance.'}</p>
      {!issued&&blockers.length?<ul className={css.detailList}>{blockers.map((reason,index)=><li key={index}>{reason}</li>)}</ul>:null}
      {issued?<div className={css.factRow} style={{marginTop:18}}>
        <span>Work Order <strong>{workOrder?.reference}</strong></span>
        <span>Commercial price <strong>{workOrder?.currency} {Number(workOrder?.partner_price).toFixed(2)}</strong></span>
        <span>Partner acceptance <strong>{accepted?.accepted_at?'Recorded':'Pending'}</strong></span>
      </div>:null}
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
    <section className={css.detailPanel}>
      <span className={css.overline}>CONTROLLED EVIDENCE</span>
      <dl className={css.detailFacts}>
        <div><dt>Execution Partner</dt><dd>{partnerName}</dd></div>
        <div><dt>Opening payment</dt><dd>{settled?'Verified':'Not verified'}</dd></div>
        <div><dt>Work Order</dt><dd>{workOrder?.reference||'Not issued'}</dd></div>
        <div><dt>Partner price</dt><dd>{issued?workOrder?.currency+' '+Number(workOrder?.partner_price).toFixed(2):'Not issued'}</dd></div>
        <div><dt>Work Order acceptance</dt><dd>{accepted?.accepted_at?'Formally accepted':'Pending'}</dd></div>
        <div><dt>Partner invitation</dt><dd>{email?.status==='sent'&&email.sent_at?'Accepted by email provider':email?.status||'Not recorded'}</dd></div>
        <div><dt>Project lifecycle</dt><dd>{String(project.project_stage).replaceAll('_',' ')}</dd></div>
        <div><dt>Current approved scope</dt><dd>{approvedCandidates.length===1?(approvedCandidates[0].reference||'Available'):'Not ready'}</dd></div>
      </dl>
      <details className={css.detailHistory}>
        <summary>View original release and governance checks</summary>
        <div className={css.detailFacts}>
          <div><dt>Partner Agreement</dt><dd>{partnerAgreementVerified?'Verified':'Not verified'}</dd></div>
          <div><dt>Approved project Statement of Work</dt><dd>{approved.some(x=>(x as {document_type?:string}).document_type==='statement-of-work')?'Approved':'Not yet approved'}</dd></div>
          <div><dt>Payment-triggered handoff</dt><dd>{issued?'Work Order issued':handoff?.status?handoff.status.replaceAll('_',' '):'Not attempted'}</dd></div>
          <div><dt>Partner contact recorded</dt><dd>{partnerEmail?'Yes':'No'}</dd></div>
        </div>
      </details>
      {accepted?.accepted_at?<p className={css.meta} style={{marginTop:18}}>Accepted by {accepted.accepted_by_name} ({accepted.accepted_by_role}) on {new Date(accepted.accepted_at).toLocaleString('en-GB')}. Acceptance is evidenced by the signed partner-session action, not merely opening the page.</p>:null}
      {handoff?.last_blocker&&!workOrder?.issued_at?<p role="alert" className={css.meta}>Payment handoff blocker: {String(handoff.last_blocker).slice(0,300)}</p>:null}
      {email?.last_error&&email?.status!=='sent'?<p role="alert" className={css.meta}>Current notification issue: {String(email.last_error).slice(0,300)}</p>:null}
      <p className={css.meta} style={{marginTop:18}}>Email-provider acceptance does not prove the recipient opened the invitation. Formal Work Order acceptance, partner commencement, technical QA, client approval and settlement remain separately governed. No partner advance is authorised.</p>
    </section>
  </article>;
}
