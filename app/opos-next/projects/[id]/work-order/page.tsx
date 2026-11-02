import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {retryGovernedWorkOrderAction} from './action';
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
  const [quoteResult,financialResult,sowResult,assignmentResult,acceptanceResult,notificationResult]=await Promise.all([
    supabase.from('quotes').select('id,commercial_review_id').eq('id',project.quote_id).eq('organisation_id',organisationId).maybeSingle(),
    supabase.rpc('op_project_financial_gate',{p_project_id:id}),
    supabase.from('documents').select('id,status,title,reference,revision_code,is_current_revision')
      .eq('organisation_id',organisationId).eq('project_id',id).eq('document_type','statement-of-work')
      .eq('is_current_revision',true).order('created_at',{ascending:false}).limit(5),
    supabase.from('project_execution_assignments').select('id,partner_id,scope_document_id,execution_state,release_reference,released_at')
      .eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
    supabase.from('partner_work_order_acceptances').select('id,assignment_id,scope_document_id,accepted_by_name,accepted_by_role,accepted_at')
      .eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
    supabase.from('notification_outbox').select('id,status,provider_message_id,last_error,attempts')
      .eq('organisation_id',organisationId).eq('entity_id',id).like('subject','Work package released%')
      .order('created_at',{ascending:false}).limit(1).maybeSingle(),
  ]);
  let partnerName='Not commercially selected';
  let selectedPartnerId='';
  let partnerApproved=false;
  let partnerNda=false;
  let partnerEmail=false;
  const quote=quoteResult.data;
  if(quote?.commercial_review_id){
    const {data:review,error:reviewError}=await supabase.from('commercial_reviews')
      .select('partner_quote_id,status').eq('organisation_id',organisationId).eq('id',quote.commercial_review_id).maybeSingle();
    if(!reviewError&&review?.partner_quote_id&&String(review.status)==='approved'){
      const {data:pq}=await supabase.from('partner_quotes').select('partner_id')
        .eq('organisation_id',organisationId).eq('id',review.partner_quote_id).maybeSingle();
      if(pq?.partner_id){
        const {data:partner}=await supabase.from('partners').select('id,company_name,status,nda_signed,email')
          .eq('organisation_id',organisationId).eq('id',pq.partner_id).maybeSingle();
        if(partner){selectedPartnerId=partner.id;partnerName=partner.company_name;partnerApproved=partner.status==='approved';partnerNda=Boolean(partner.nda_signed);partnerEmail=Boolean(partner.email);}
      }
    }
  }
  const sow=sowResult.data||[];
  const approved=sow.filter(x=>['approved','issued','published'].includes(x.status)&&x.is_current_revision);
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
  if(approved.length!==1)blockers.push('Exactly one current approved Statement of Work is required.');
  if(!project.due_date)blockers.push('The project delivery due date is not recorded.');
  if(project.project_stage!=='ready_for_execution')blockers.push('The controlled Mobilisation stage must first be completed.');
  const assignment=assignmentResult.data;
  const accepted=acceptanceResult.data;
  const assignmentMatched=Boolean(assignment&&selectedPartnerId&&assignment.partner_id===selectedPartnerId
    &&approved.length===1&&assignment.scope_document_id===approved[0].id);
  if(assignment&&!assignmentMatched)blockers.push('Existing assignment does not match the commercially approved partner and current scope.');
  const actionable=blockers.length===0 && ['owner','admin'].includes(String(profile.role));
  const email=notificationResult.data;
  const actualStatus=accepted?.id?'Formally accepted':assignment?.released_at?
    'Issued · partner acceptance pending':blockers.length?'Blocked · evidence required':'Ready for governed release';
  return <div className={css.shell} style={{maxWidth:1000,margin:'0 auto',padding:'38px 20px',display:'grid',gap:24}}>
    <Link className={css.secondaryLink} href={'/opos-next/projects/'+id}>← Project 360</Link>
    <header><span className={css.overline}>ISOLATED QA · PROJECT 360</span><h1 style={{fontSize:32,fontWeight:650,marginTop:12}}>Execution Partner Work Order</h1>
      <p className={css.meta}>{project.project_number} · {project.title}</p></header>
    {feedback.error?<p role="alert" className={css.empty}>Action blocked: {feedback.error.slice(0,450)}</p>:null}
    {feedback.success?<p role="status" className={css.empty}>{feedback.success.slice(0,450)}</p>:null}
    <section className={css.card}>
      <span className={css.overline}>ONE NEXT ACTION</span>
      <h2 className={css.cardTitle}>{actualStatus}</h2>
      <p className={css.cardDescription}>{accepted?.id?'The named Execution Partner has accepted the controlled Work Order. Commencement is still a separate declaration.':blockers.length?'Resolve the outstanding governed evidence. This record must not be released to a partner yet.':'A controlled Work Order can be queued for the commercially selected Execution Partner. Partner acceptance is required before commencement.'}</p>
      {blockers.length?<ul style={{paddingLeft:20,marginTop:18}}>{blockers.map((reason,index)=><li key={index} style={{marginBottom:8}}>{reason}</li>)}</ul>:null}
      {actionable&&!accepted?.id?<form action={retryGovernedWorkOrderAction} style={{marginTop:22}}>
        <input type="hidden" name="project_id" value={id}/>
        <button className={css.action} type="submit" style={{border:0,cursor:'pointer'}}>Issue or retry governed Work Order →</button>
      </form>:null}
    </section>
    <section className={css.card}>
      <span className={css.overline}>CONTROLLED EVIDENCE</span>
      <div className={css.factRow} style={{marginTop:18}}>
        <span>Verified opening deposit: <strong>{settled?'Confirmed':'Not verified'}</strong></span>
        <span>Commercial partner: <strong>{partnerName}</strong></span>
        <span>Approved SOW: <strong>{approved.length===1?(approved[0].reference||'Available'):'Not ready'}</strong></span>
        <span>Project stage: <strong>{String(project.project_stage).replaceAll('_',' ')}</strong></span>
        <span>Work Order issue: <strong>{assignment?.released_at?'Recorded':'Not issued'}</strong></span>
        <span>Partner acceptance: <strong>{accepted?.accepted_at?'Recorded':'Not recorded'}</strong></span>
        <span>Partner notification: <strong>{email?.status==='sent'&&email.provider_message_id?'Provider accepted':email?.status||'Not queued'}</strong></span>
      </div>
      {accepted?.accepted_at?<p className={css.meta} style={{marginTop:18}}>Accepted by {accepted.accepted_by_name} ({accepted.accepted_by_role}) on {new Date(accepted.accepted_at).toLocaleString('en-GB')}. Acceptance is evidenced by the signed partner-session action, not merely opening the page.</p>:null}
      {email?.last_error?<p role="alert" className={css.meta}>Notification error: {String(email.last_error).slice(0,300)}</p>:null}
      <p className={css.meta} style={{marginTop:18}}>A queued email does not prove delivery. Work commencement, engineering submissions, client review, final payment and partner settlement require their own verified gates. No partner advance is authorised.</p>
    </section>
  </div>;
}
