'use client';
import {useActionState} from 'react';
import {decideNorthfieldQa} from './qa-internal-decision';
import css from './opportunity.module.css';
type Response={id:string;feasibility:string;capacity_status:string;confidence_percent:number|null;estimated_lead_time_days:number|null;technical_risks:string|null;assumptions:string|null;missing_information:string|null};
type Quote={price:number;currency:string;valid_until:string|null};
export default function QaDecisionForm({prospectId,requestId,responseId,partnerName,response,quote}:{prospectId:string;requestId:string;responseId:string;partnerName:string|null;response:Response;quote:Quote|null}){
 const [result,action,pending]=useActionState(decideNorthfieldQa,{ok:false,message:''});
 return <form action={action} className={css.workForm}>
  <input type="hidden" name="prospect_id" value={prospectId}/>
  <input type="hidden" name="request_id" value={requestId}/>
  <input type="hidden" name="response_id" value={responseId}/>
  <div className={css.workFacts}>
    <span>Partner <strong>{partnerName||'Execution Partner'}</strong></span>
    <span>Feasibility <strong>{response.feasibility}</strong></span>
    <span>Capacity <strong>{response.capacity_status}</strong></span>
    <span>Cost <strong>{quote?new Intl.NumberFormat('en-GB',{style:'currency',currency:quote.currency||'GBP'}).format(Number(quote.price)):'Not recorded'}</strong></span>
  </div>
  {response.technical_risks?<p className={css.workHint}>Technical risks: {response.technical_risks}</p>:null}
  <label className={css.workLabel}>Authorised decision
    <select className={css.workInput} name="decision" defaultValue="approved" required>
     <option value="approved">Approve and continue</option>
     <option value="approved_with_conditions">Approve with conditions</option>
     <option value="clarification_required">Request clarification</option>
     <option value="rejected">Decline opportunity</option>
    </select>
  </label>
  <label className={css.workLabel}>Decision and rationale
    <textarea className={css.workInput} name="review_notes" rows={4} required minLength={20} maxLength={5000}/>
  </label>
  <label className={css.workLabel}>Accepted assumptions
    <textarea className={css.workInput} name="accepted_assumptions" rows={3} defaultValue={response.assumptions||''}/>
  </label>
  <label className={css.workLabel}>Accepted risks
    <textarea className={css.workInput} name="accepted_risks" rows={3} defaultValue={response.technical_risks||''}/>
  </label>
  <label className={css.workLabel}>Clarification request (required if requesting more information)
    <textarea className={css.workInput} name="clarification_request" rows={2}/>
  </label>
  <p className={css.workHint}>This action is restricted to the fictional Northfield QA assessment. It cannot approve a real partner NDA.</p>
  <button className={css.workButton} disabled={pending||result.ok} type="submit">{pending?'Recording decision…':'Record governed feasibility decision →'}</button>
  {result.message?<p role={result.ok?'status':'alert'} className={result.ok?css.feedbackSuccess:css.feedbackError}>{result.message}</p>:null}
 </form>;
}
