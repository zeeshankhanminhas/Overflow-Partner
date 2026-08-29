import { createProspectPartnerReviewAction, decideProspectPartnerReviewAction } from '@/app/workspace/acquisition/partner-actions';
import { commercialStatus } from '@/lib/presentation/commercialLanguage';

type Partner = { id:string; company_name:string; rating:number|null; email:string|null };
type Request = { id:string; status:string; response_due_at:string; case_reference:string; partner?:{company_name?:string|null}|null };
type Response = { id:string; feasibility:string; confidence_percent:number; capacity_status:string; estimated_engineering_hours:number|null; estimated_lead_time_days:number|null; assumptions:string|null; technical_risks:string|null; missing_information:string|null; exclusions:string|null; reviewer_name:string; reviewer_role:string|null };
type Quote = { id:string; price:number; currency:string; valid_until:string|null; payment_terms:string|null; delivery_commitment:string|null; commercial_assumptions:string|null; exclusions:string|null; quote_reference:string|null };
type Decision = { decision:string; review_notes:string|null; clarification_request:string|null; approved_at:string|null };

function value(input:unknown,fallback='Not recorded'){return input===null||input===undefined||input===''?fallback:String(input)}
function money(valueInput:number|undefined,currency:string|undefined){return valueInput===undefined?'Not received':`${currency||'GBP'} ${Number(valueInput).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}`}

export default function AcquisitionPartnerGate({
  prospectId,intakeSessionId,scopeSummary,partners,request,response,quote,decision,reviewUrl,
}:{
  prospectId:string;intakeSessionId:string;scopeSummary:string;partners:Partner[];request:Request|null;response:Response|null;quote:Quote|null;decision:Decision|null;reviewUrl?:string;
}){
  const dueDefault=new Date(Date.now()+3*24*60*60*1000).toISOString().slice(0,16);

  if(!request){
    return <div style={{display:'grid',gap:18}}>
      <div className="vp-callout"><strong>Delivery review required</strong><p>Send the requirements to an approved delivery partner to confirm feasibility, availability, lead time and cost before pricing the opportunity.</p></div>
      {partners.length?<form action={createProspectPartnerReviewAction} style={{display:'grid',gap:16}}>
        <input type="hidden" name="prospect_id" value={prospectId}/><input type="hidden" name="intake_session_id" value={intakeSessionId}/><input type="hidden" name="scope_summary" value={scopeSummary}/>
        <label className="field">Delivery partner<select name="partner_id" required defaultValue=""><option value="" disabled>Select approved partner</option>{partners.map(p=><option key={p.id} value={p.id}>{p.company_name}{p.rating!==null?` · ${p.rating}/5`:''}</option>)}</select></label>
        <label className="field">Response due<input type="datetime-local" name="response_due_at" defaultValue={dueDefault} required/></label>
        <label className="field">Review instructions<textarea name="review_instructions" rows={3} defaultValue="Confirm feasibility, assumptions, engineering hours, lead time, capacity and price. Flag any missing information before committing."/></label>
        <label style={{display:'flex',gap:10,alignItems:'flex-start'}}><input type="checkbox" name="show_client_identity" value="true"/><span>Share client identity with this delivery partner</span></label>
        <button className="button" type="submit">Request partner review</button>
      </form>:<div className="vp-empty">No approved delivery partners are available. Add or approve a partner before progressing this opportunity.</div>}
    </div>;
  }

  if(['invited','opened','in_progress'].includes(request.status)){
    return <div style={{display:'grid',gap:16}}>
      <div className="vp-callout"><strong>{request.status==='invited'?'Waiting for delivery partner':'Partner review in progress'}</strong><p>{request.partner?.company_name||'The delivery partner'} has the next action. The opportunity can progress once feasibility, availability and price are confirmed.</p></div>
      <div className="vp-facts"><div className="vp-fact"><small>Review reference</small><strong>{request.case_reference}</strong></div><div className="vp-fact"><small>Delivery partner</small><strong>{request.partner?.company_name||'Not recorded'}</strong></div><div className="vp-fact"><small>Status</small><strong>{commercialStatus(request.status)}</strong></div><div className="vp-fact"><small>Due</small><strong>{new Date(request.response_due_at).toLocaleString('en-GB')}</strong></div></div>
      {reviewUrl?<div className="vp-callout"><strong>Test access</strong><p style={{overflowWrap:'anywhere'}}>{reviewUrl}</p><a className="button secondary" href={reviewUrl} target="_blank" rel="noreferrer">Open partner workspace</a></div>:null}
    </div>;
  }

  if(response && request.status==='submitted' && !decision){
    return <div style={{display:'grid',gap:18}} id="approval-decision">
      <div className="vp-callout"><strong>Commercial decision required</strong><p>The delivery partner has responded. Review feasibility, assumptions, risk, capacity and price before deciding whether to progress the opportunity.</p></div>
      <div className="vp-facts"><div className="vp-fact"><small>Delivery partner</small><strong>{request.partner?.company_name||'Not recorded'}</strong></div><div className="vp-fact"><small>Feasibility</small><strong>{commercialStatus(response.feasibility,value(response.feasibility))}</strong></div><div className="vp-fact"><small>Confidence</small><strong>{response.confidence_percent}%</strong></div><div className="vp-fact"><small>Capacity</small><strong>{commercialStatus(response.capacity_status,value(response.capacity_status))}</strong></div><div className="vp-fact"><small>Engineering hours</small><strong>{value(response.estimated_engineering_hours)}</strong></div><div className="vp-fact"><small>Lead time</small><strong>{response.estimated_lead_time_days?`${response.estimated_lead_time_days} days`:'Not recorded'}</strong></div><div className="vp-fact"><small>Partner price</small><strong>{money(quote?.price,quote?.currency)}</strong></div><div className="vp-fact"><small>Valid until</small><strong>{quote?.valid_until||'Not recorded'}</strong></div></div>
      {response.assumptions?<div><strong>Partner assumptions</strong><p style={{whiteSpace:'pre-wrap'}}>{response.assumptions}</p></div>:null}
      {response.technical_risks?<div><strong>Technical risks</strong><p style={{whiteSpace:'pre-wrap'}}>{response.technical_risks}</p></div>:null}
      {response.missing_information?<div><strong>Missing information</strong><p style={{whiteSpace:'pre-wrap'}}>{response.missing_information}</p></div>:null}
      {quote?.commercial_assumptions?<div><strong>Commercial assumptions</strong><p style={{whiteSpace:'pre-wrap'}}>{quote.commercial_assumptions}</p></div>:null}
      {quote?.exclusions?<div><strong>Exclusions</strong><p style={{whiteSpace:'pre-wrap'}}>{quote.exclusions}</p></div>:null}
      <form action={decideProspectPartnerReviewAction} style={{display:'grid',gap:14,borderTop:'1px solid var(--op-line)',paddingTop:18}}>
        <input type="hidden" name="prospect_id" value={prospectId}/><input type="hidden" name="request_id" value={request.id}/><input type="hidden" name="response_id" value={response.id}/>
        <label className="field">Decision<select name="decision" required defaultValue="approved"><option value="approved">Approve and continue</option><option value="approved_with_conditions">Approve with conditions</option><option value="clarification_required">Request clarification</option><option value="rejected">Decline opportunity</option></select></label>
        <label className="field">Decision notes<textarea name="review_notes" rows={3} placeholder="Reason for this decision"/></label>
        <label className="field">Accepted assumptions<textarea name="accepted_assumptions" rows={2} defaultValue={response.assumptions||''}/></label>
        <label className="field">Accepted risks<textarea name="accepted_risks" rows={2} defaultValue={response.technical_risks||''}/></label>
        <label className="field">Clarification request<textarea name="clarification_request" rows={2} placeholder="What does the partner need to clarify?"/></label>
        <button className="button" type="submit">Confirm decision</button>
      </form>
    </div>;
  }

  if(decision?.decision==='clarification_required') return <div className="vp-callout"><strong>Clarification required</strong><p>{decision.clarification_request||'More information is required from the delivery partner before this opportunity can progress.'}</p></div>;
  if(['approved','approved_with_conditions'].includes(decision?.decision||'')) return <div className="vp-callout"><strong>Ready to progress</strong><p>Delivery capability and partner cost have been confirmed. Continue with pricing and the client quote.</p></div>;
  if(decision?.decision==='rejected') return <div className="vp-callout"><strong>Opportunity declined</strong><p>This opportunity will not progress to commercial preparation or delivery.</p></div>;
  return <div className="vp-empty">The delivery review is incomplete.</div>;
}
