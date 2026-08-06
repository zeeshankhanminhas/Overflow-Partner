import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { listWorkflowCases } from '@/lib/orchestration/service';
import { acceptQuoteAction, approveCommercialAction, approveIntakeAction, createCommercialReviewAction, createIntakeShellAction, issueQuoteAction, recordQuoteOutcomeAction, reviseQuoteAction } from '../../orchestration/actions';
import { createPartnerReviewRequestAction, decidePartnerReviewAction } from './actions';
import { eventLabel, partnerReviewNextAction, workspaceLabel } from '@/lib/presentation/vocabulary';
import MarginSimulator from './MarginSimulator';

const dateTime=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Not recorded';
const money=(currency:string|null|undefined,amount:number|string|null|undefined)=>amount===null||amount===undefined?'Not recorded':new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'GBP'}).format(Number(amount));
function Fact({label,value}:{label:string;value:React.ReactNode}){return <div className="vp-fact"><small>{label}</small><strong>{value??'Not recorded'}</strong></div>}

export default async function Case360Page({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const {id}=await params;
  const query=searchParams?await searchParams:{};
  const {supabase,organisationId}=await requireUserContext();
  const workflow=(await listWorkflowCases(supabase,organisationId)).find(item=>item.lead.id===id);
  if(!workflow)notFound();

  const [activityResult,documentsResult,partnersResult,reviewsResult]=await Promise.all([
    supabase.from('activity_events').select('*').eq('organisation_id',organisationId).eq('entity_type','lead').eq('entity_id',id).order('created_at',{ascending:false}).limit(20),
    supabase.from('documents').select('*').eq('organisation_id',organisationId).eq('lead_id',id).order('created_at',{ascending:false}),
    supabase.from('partners').select('id,company_name,status,nda_signed').eq('organisation_id',organisationId).eq('status','approved').eq('nda_signed',true).order('company_name'),
    supabase.from('partner_review_requests').select('*, partner:partners(id,company_name,nda_signed), responses:partner_review_responses(*), decisions:partner_review_internal_decisions(*), files:partner_review_files(id)').eq('organisation_id',organisationId).eq('lead_id',id).order('created_at',{ascending:false}),
  ]);
  const activity=activityResult.data??[];
  const documents=documentsResult.data??[];
  const partners=partnersResult.data??[];
  const review=((reviewsResult.data??[]) as any[])[0] as any|undefined;
  const response=[...(review?.responses??[])].sort((a:any,b:any)=>Number(b.revision)-Number(a.revision))[0];
  const technicalApproved=workflow.technicalIntake?.status==='approved';
  const partnerApproved=['approved','approved_with_conditions'].includes(review?.status);
  const quote=workflow.clientQuote;
  const quoteDocument=documents.find((document:any)=>['client-quote','quote'].includes(document.document_type)&&(!quote?.id||document.quote_id===quote.id));
  const quoteDocumentStatus=String(quoteDocument?.status||'not generated');

  let currentStatus='New enquiry',nextAction='Create technical scope',reason='The case needs a governed technical definition.',actionKey='create_scope',blocker:string|null=null;
  if(workflow.technicalIntake&&!technicalApproved){currentStatus='Technical scope under review';nextAction='Approve technical scope';reason='The inherited scope is ready for an engineering decision.';actionKey='approve_scope'}
  if(technicalApproved&&!review){currentStatus='Ready for partner review';nextAction='Send partner review';reason='The approved scope can now be issued to an NDA-ready execution partner.';actionKey='create_partner_review'}
  if(review&&!response){currentStatus='Awaiting partner response';nextAction=partnerReviewNextAction(review.status,false);reason='The partner has the controlled request.';blocker='Waiting on the execution partner.';actionKey='wait_partner'}
  if(review?.status==='submitted'&&response){currentStatus='Partner response received';nextAction='Record technical decision';reason='Technical feasibility and commercial pricing are ready for internal review.';blocker='Commercial progression is locked until this decision is recorded.';actionKey='decide_partner'}
  if(review?.status==='clarification_required'){currentStatus='Clarification required';nextAction='Await revised response';reason='The clarification request is with the partner.';blocker='Waiting on revised partner evidence.';actionKey='wait_partner'}
  if(partnerApproved&&workflow.partnerQuote&&!workflow.commercialReview){currentStatus='Ready for commercial decision';nextAction='Set margin';reason='The approved partner cost is ready for a selling-price decision.';actionKey='create_commercial'}
  if(workflow.commercialReview&&!quote){currentStatus='Quote ready to generate';nextAction='Generate client quote';reason='The approved commercial position can now become a controlled quote.';actionKey='generate_quote'}
  if(quote&&['draft','internal_review'].includes(quote.status)){currentStatus='Draft quote ready';nextAction=quoteDocumentStatus==='approved'?'Issue client quote':'Complete controlled quotation';reason=quoteDocumentStatus==='approved'?'The controlled quotation is approved and may now be commercially issued.':`Commercial issue is blocked until the controlled client quotation is signed and approved. Current document state: ${quoteDocumentStatus}.`;actionKey='issue_quote';blocker=quoteDocumentStatus==='approved'?null:'Controlled quotation approval required.'}
  if(quote?.status==='issued'&&!workflow.project){currentStatus='Awaiting client decision';nextAction='Record client outcome';reason='The issued quote is awaiting acceptance, rejection or revision.';actionKey='accept_quote'}
  if(quote&&['rejected','expired','withdrawn'].includes(quote.status)&&!workflow.project){currentStatus=`Quote ${quote.status}`;nextAction='Open quote revision';reason='The concluded quotation may be revised through a new controlled publication.';actionKey='revise_quote'}
  if(workflow.project){currentStatus=workflow.project.status==='active'?'Active project':'Project ready';nextAction='Open active project';reason='The accepted case has entered controlled delivery.';actionKey='open_project'}

  const caseReference=review?.case_reference||`OP-CASE-${workflow.lead.id.slice(0,8).toUpperCase()}`;
  const success=query.success||query.partnerReviewDecision||query.partnerReviewCreated;
  const primaryTitle=actionKey==='accept_quote'||actionKey==='revise_quote'?'Client quote':actionKey==='issue_quote'||actionKey==='generate_quote'?'Client quote':actionKey==='decide_partner'?'Partner response':actionKey==='create_commercial'?'Commercial position':actionKey==='create_partner_review'||actionKey==='wait_partner'?'Partner review':'Technical scope';

  return <section className="vp-page">
    <header className="vp-header"><div><p className="vp-kicker">Case 360 · {caseReference}</p><h1>{workflow.lead.title||workflow.lead.company_name}</h1><p className="vp-subtitle">{workflow.lead.company_name}{workflow.lead.contact_name?` · ${workflow.lead.contact_name}`:''}</p></div><Link href="/workspace/leads">All cases</Link></header>
    {success?<div className="vp-callout"><strong>{String(success)}</strong><p>Current status: {currentStatus}. Next: {nextAction}.</p>{query.reviewUrl?<p style={{overflowWrap:'anywhere'}}>{String(query.reviewUrl)}</p>:null}</div>:null}
    {query.error?<div className="vp-callout"><strong>Action could not be completed</strong><p>{String(query.error)}</p></div>:null}

    <div className="vp-primary-grid">
      <main className="vp-object vp-object--hero">
        <span className="vp-status">{currentStatus}</span><p className="vp-label">Primary object</p><h2 style={{fontSize:'clamp(1.8rem,3vw,3rem)',margin:'.5rem 0'}}>{primaryTitle}</h2><p style={{maxWidth:680,color:'rgb(255 255 255/.58)',lineHeight:1.65}}>{reason}</p>
        {quote?<div className="vp-facts"><Fact label="Quote" value={quote.quote_number}/><Fact label="Subtotal" value={money(quote.currency,quote.subtotal)}/><Fact label="VAT" value={money(quote.currency,quote.vat)}/><Fact label="Total" value={money(quote.currency,quote.total)}/><Fact label="Valid until" value={quote.valid_until}/><Fact label="Quote status" value={workspaceLabel(quote.status,'clientQuote')}/><Fact label="Controlled document" value={workspaceLabel(quoteDocumentStatus,'document')}/></div>:null}
        {!quote&&actionKey==='create_commercial'&&workflow.partnerQuote?<div className="vp-facts"><Fact label="Partner cost" value={money(workflow.partnerQuote.currency,workflow.partnerQuote.price)}/><Fact label="Currency" value={workflow.partnerQuote.currency}/><Fact label="Lead time" value={workflow.partnerQuote.lead_time_days?`${workflow.partnerQuote.lead_time_days} days`:'Not recorded'}/><Fact label="Valid until" value={workflow.partnerQuote.valid_until}/></div>:null}
        {!quote&&response?<div className="vp-facts"><Fact label="Feasibility" value={workspaceLabel(response.feasibility,'feasibility')}/><Fact label="Confidence" value={`${response.confidence_percent}%`}/><Fact label="Capacity" value={workspaceLabel(response.capacity_status,'capacity')}/><Fact label="Engineering hours" value={response.estimated_engineering_hours}/><Fact label="Lead time" value={response.estimated_lead_time_days?`${response.estimated_lead_time_days} days`:'Not recorded'}/></div>:null}
        {!quote&&!response?<div className="vp-facts"><Fact label="Project type" value={workflow.technicalIntake?.project_type||workflow.lead.project_type}/><Fact label="Discipline" value={workflow.technicalIntake?.discipline}/><Fact label="Deadline" value={workflow.technicalIntake?.deadline}/><Fact label="Documents" value={documents.length}/></div>:null}
      </main>

      <aside className="vp-action"><p className="vp-label">Next action</p><h2>{nextAction}</h2>{blocker?<p><strong>Blocked:</strong> {blocker}</p>:<p>{reason}</p>}
        {actionKey==='create_scope'?<form action={createIntakeShellAction}><input type="hidden" name="lead_id" value={id}/><button className="button">Create technical scope</button></form>:null}
        {actionKey==='approve_scope'?<form action={approveIntakeAction}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="intake_id" value={workflow.technicalIntake?.id}/><button className="button">Approve technical scope</button></form>:null}
        {actionKey==='create_partner_review'?<form action={createPartnerReviewRequestAction} className="stack"><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="technical_intake_id" value={workflow.technicalIntake?.id}/><label>Execution partner<select name="partner_id" required defaultValue=""><option value="">Select partner</option>{partners.map((p:any)=><option key={p.id} value={p.id}>{p.company_name}</option>)}</select></label><label>Response due<input name="response_due_at" type="datetime-local" required/></label><label>Files<select name="file_selection" defaultValue="all"><option value="all">All approved documents</option><option value="none">No files</option></select></label><button className="button">Send partner review</button></form>:null}
        {actionKey==='decide_partner'?<form action={decidePartnerReviewAction} className="stack"><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="request_id" value={review.id}/><input type="hidden" name="response_id" value={response.id}/><label>Decision<select name="decision" required defaultValue=""><option value="">Select decision</option><option value="approved">Approve</option><option value="approved_with_conditions">Approve with conditions</option><option value="clarification_required">Request clarification</option><option value="rejected">Reject</option></select></label><label>Decision note<textarea name="review_notes" rows={3}/></label><button className="button">Record decision</button></form>:null}
        {actionKey==='create_commercial'?<form action={createCommercialReviewAction} className="stack"><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="partner_quote_id" value={workflow.partnerQuote?.id}/><MarginSimulator cost={Number(workflow.partnerQuote?.price||0)} currency={workflow.partnerQuote?.currency||'GBP'}/><label>Optional note<textarea name="commercial_note" rows={3}/></label><button className="button">Approve commercial position</button></form>:null}
        {actionKey==='generate_quote'?<form action={approveCommercialAction}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="commercial_review_id" value={workflow.commercialReview?.id}/><button className="button">Generate quote</button></form>:null}
        {actionKey==='issue_quote'?<div className="stack">{quoteDocument?<Link className="button secondary" href={`/workspace/documents/templates/${quoteDocument.document_type}?quote=${quote?.id}&document_record=${quoteDocument.id}`}>Open controlled quotation</Link>:<Link className="button secondary" href="/workspace/documents">Create controlled quotation</Link>}<form action={issueQuoteAction}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="quote_id" value={quote?.id}/><button className="button" disabled={quoteDocumentStatus!=='approved'}>Issue client quote</button></form></div>:null}
        {actionKey==='accept_quote'?<div className="stack"><form action={acceptQuoteAction}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="quote_id" value={quote?.id}/><button className="button">Record acceptance and create project</button></form><details className="vp-disclosure"><summary>Other client outcome</summary><form action={recordQuoteOutcomeAction} className="stack"><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="quote_id" value={quote?.id}/><label>Outcome<select name="outcome" required defaultValue="rejected"><option value="rejected">Rejected</option><option value="expired">Expired</option><option value="withdrawn">Withdrawn</option></select></label><label>Decision note<textarea name="note" rows={3}/></label><button className="button secondary">Record outcome</button></form></details></div>:null}
        {actionKey==='revise_quote'?<form action={reviseQuoteAction} className="stack"><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="quote_id" value={quote?.id}/><label>Revision reason<textarea name="note" rows={3} required/></label><button className="button">Open new controlled revision</button></form>:null}
        {actionKey==='open_project'?<Link className="button" href={`/workspace/projects/${workflow.project?.id}`}>Open active project</Link>:null}
        {actionKey==='wait_partner'?<p><strong>No internal action is required.</strong></p>:null}
      </aside>
    </div>

    <section style={{display:'grid',gap:12}}>
      <details className="vp-disclosure"><summary>Technical context</summary><div><div className="vp-facts"><Fact label="Project" value={workflow.lead.title||workflow.lead.company_name}/><Fact label="Project type" value={workflow.technicalIntake?.project_type||workflow.lead.project_type}/><Fact label="Discipline" value={workflow.technicalIntake?.discipline}/><Fact label="Deliverables" value={workflow.technicalIntake?.deliverables||workflow.lead.service}/><Fact label="Deadline" value={workflow.technicalIntake?.deadline}/><Fact label="Documents" value={documents.length}/></div><div style={{marginTop:22}}><Fact label="Scope" value={workflow.technicalIntake?.description||workflow.lead.notes}/></div></div></details>
      {response?<details className="vp-disclosure" open={actionKey==='decide_partner'}><summary>Partner evidence · Revision {response.revision}</summary><div><div className="vp-facts"><Fact label="Feasibility" value={workspaceLabel(response.feasibility,'feasibility')}/><Fact label="Confidence" value={`${response.confidence_percent}%`}/><Fact label="Capacity" value={workspaceLabel(response.capacity_status,'capacity')}/><Fact label="Hours" value={response.estimated_engineering_hours}/><Fact label="Lead time" value={response.estimated_lead_time_days?`${response.estimated_lead_time_days} days`:'Not recorded'}/>{workflow.partnerQuote?<Fact label="Partner price" value={money(workflow.partnerQuote.currency,workflow.partnerQuote.price)}/>:null}</div><div className="vp-facts"><Fact label="Approach" value={response.proposed_delivery_approach}/><Fact label="Assumptions" value={response.assumptions}/><Fact label="Risks" value={response.technical_risks}/><Fact label="Missing information" value={response.missing_information}/><Fact label="Exclusions" value={response.exclusions}/></div></div></details>:null}
      <details className="vp-disclosure"><summary>Case history</summary><div>{activity.length?activity.slice(0,10).map((event:any)=><div key={event.id} style={{borderTop:'1px solid rgb(255 255 255/.08)',padding:'12px 0'}}><strong>{eventLabel(event.event_type)}</strong><p style={{margin:'.3rem 0 0',color:'rgb(255 255 255/.45)'}}>{dateTime(event.created_at)}</p></div>):<p>No activity recorded.</p>}</div></details>
    </section>
  </section>;
}
