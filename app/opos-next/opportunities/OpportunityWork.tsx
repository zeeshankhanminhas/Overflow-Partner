import {createStep2InvitationFormAction,convertProspectFormAction} from '@/app/workspace/acquisition/actions';
import {createProspectPartnerReviewAction,decideProspectPartnerReviewAction} from '@/app/workspace/acquisition/partner-actions';
import type {AcquisitionActionKey} from '@/lib/acquisition/state';
import css from './opportunity.module.css';

type Partner={id:string;company_name:string;email:string|null};
type PartnerResponse={
  id:string;feasibility:string;capacity_status:string;confidence_percent:number|null;
  estimated_lead_time_days:number|null;technical_risks:string|null;assumptions:string|null;
  missing_information:string|null;
};
type PartnerQuote={price:number;currency:string;valid_until:string|null};

export default function OpportunityWork({
  prospectId,actionKey,canWrite,canDecide,previewWritable,hasContactEmail,linkedinEligible,
  sessionId,scopeSummary,partners,partnerRequestId,partnerResponse,
  partnerQuote,partnerName,convertedCaseId,
}:{
  prospectId:string;actionKey:AcquisitionActionKey;
  canWrite:boolean;canDecide:boolean;previewWritable:boolean;hasContactEmail:boolean;linkedinEligible:boolean;
  sessionId:string|null;scopeSummary:string;partners:Partner[];
  partnerRequestId:string|null;partnerResponse:PartnerResponse|null;
  partnerQuote:PartnerQuote|null;partnerName:string|null;
  convertedCaseId:string|null;
}){
  const hidden=<><input type="hidden" name="prospect_id" value={prospectId}/><input type="hidden" name="opos_next" value="1"/></>;
  if(actionKey==='create_intake'){
    if(!linkedinEligible)return <p className={css.workHint}>This LinkedIn prospect must express interest in the Outreach conversation before receiving a technical intake invitation.</p>;
    if(!hasContactEmail)return <p className={css.workHint}>A customer email address is required to deliver the secure requirements form. Complete the contact record before inviting requirements.</p>;
    if(!canWrite)return <p className={css.workHint}>An authorised Acquisition operator is required to issue the secure invitation.</p>;
    return <form action={createStep2InvitationFormAction} className={css.workForm}>
      {hidden}<p className={css.workHint}>OPOS creates a secure customer form and queues the invitation and scheduled reminders. Email delivery status is tracked independently.</p>
      <button className={css.workButton} type="submit" disabled={!previewWritable}>Issue secure requirements invitation →</button>
    </form>;
  }
  if(actionKey==='request_partner'){
    if(!canWrite)return <p className={css.workHint}>An authorised operator must select the approved Execution Partner for this technical assessment.</p>;
    if(!sessionId)return <p className={css.workHint}>A submitted requirements session is needed before requesting partner assessment.</p>;
    if(!partners.some(p=>Boolean(p.email)))return <p className={css.workHint}>No approved Execution Partner has a verified contact email on record. Complete partner readiness before issuing the secure assessment.</p>;
    const due=new Date(Date.now()+3*86400000).toISOString().slice(0,16);
    return <form action={createProspectPartnerReviewAction} className={css.workForm}>
      {hidden}
      <input type="hidden" name="intake_session_id" value={sessionId}/>
      <input type="hidden" name="scope_summary" value={scopeSummary}/>
      <label className={css.workLabel}>Approved Execution Partner
        <select required name="partner_id" defaultValue="" className={css.workInput}>
          <option value="" disabled>Select an eligible partner</option>
          {partners.map(p=><option key={p.id} value={p.id} disabled={!p.email}>{p.company_name}{p.email?'':' · Email required'}</option>)}
        </select>
      </label>
      <label className={css.workLabel}>Assessment due
        <input type="datetime-local" name="response_due_at" required defaultValue={due} className={css.workInput}/>
      </label>
      <label className={css.workLabel}>Assessment instructions
        <textarea name="review_instructions" rows={3} className={css.workInput}
          defaultValue="Confirm technical feasibility, capacity, risks, lead time, engineering hours, missing information and partner price."/>
      </label>
      <label className={css.workCheck}><input type="checkbox" name="show_client_identity" value="true"/> Share client identity with the selected partner</label>
      <button className={css.workButton} type="submit" disabled={!previewWritable}>Request governed partner assessment →</button>
    </form>;
  }
  if(actionKey==='review_partner_response'){
    if(!partnerResponse || !partnerRequestId)return <p className={css.workHint}>The governed partner response is not yet available for approval.</p>;
    if(!canDecide)return <p className={css.workHint}>The partner response is ready for an authorised commercial or engineering approver.</p>;
    return <form action={decideProspectPartnerReviewAction} className={css.workForm}>
      {hidden}
      <input type="hidden" name="request_id" value={partnerRequestId}/>
      <input type="hidden" name="response_id" value={partnerResponse.id}/>
      <div className={css.workFacts}>
        <span>Partner <strong>{partnerName||'Execution Partner'}</strong></span>
        <span>Feasibility <strong>{partnerResponse.feasibility||'Not recorded'}</strong></span>
        <span>Capacity <strong>{partnerResponse.capacity_status||'Not recorded'}</strong></span>
        <span>Cost <strong>{partnerQuote&&Number(partnerQuote.price)>0?new Intl.NumberFormat('en-GB',{style:'currency',currency:partnerQuote.currency||'GBP'}).format(Number(partnerQuote.price)):'Partner price outstanding'}</strong></span>
      </div>
      {partnerResponse.technical_risks?<p className={css.workHint}>Technical risks: {partnerResponse.technical_risks}</p>:null}
      {partnerResponse.missing_information?<p className={css.workHint}>Missing information: {partnerResponse.missing_information}</p>:null}
      <label className={css.workLabel}>Authorised decision
        <select name="decision" defaultValue={partnerQuote&&Number(partnerQuote.price)>0?'approved':'clarification_required'} required className={css.workInput}>
          {partnerQuote&&Number(partnerQuote.price)>0?<><option value="approved">Approve and continue</option><option value="approved_with_conditions">Approve with conditions</option></>:null}
          <option value="clarification_required">Request clarification</option>
          <option value="rejected">Decline opportunity</option>
        </select>
      </label>
      <label className={css.workLabel}>Decision and rationale
        <textarea name="review_notes" className={css.workInput} rows={3} placeholder="Record the basis and constraints of the decision"/>
      </label>
      <label className={css.workLabel}>Accepted assumptions
        <textarea name="accepted_assumptions" className={css.workInput} rows={2} defaultValue={partnerResponse.assumptions||''}/>
      </label>
      <label className={css.workLabel}>Accepted risks
        <textarea name="accepted_risks" className={css.workInput} rows={2} defaultValue={partnerResponse.technical_risks||''}/>
      </label>
      <label className={css.workLabel}>Clarification request (required when requesting further information)
        <textarea name="clarification_request" className={css.workInput} rows={2}/>
      </label>
      <button className={css.workButton} type="submit" disabled={!previewWritable}>Record governed feasibility decision →</button>
    </form>;
  }
  if(actionKey==='create_case'){
    if(!canWrite)return <p className={css.workHint}>Only an authorised Acquisition operator can complete the Case 360 handover.</p>;
    return <form action={convertProspectFormAction} className={css.workForm}>{hidden}
      <p className={css.workHint}>The approved Partner Review, technical intake and pricing evidence are carried into the controlled Case. Conversion is checked by the backend.</p>
      <button className={css.workButton} type="submit" disabled={!previewWritable}>Create governed Case 360 →</button>
    </form>;
  }
  if(actionKey==='open_case' && convertedCaseId)return <a className={css.workButton} href={'/opos-next/cases/'+convertedCaseId}>Open Case 360 →</a>;
  if(actionKey==='wait_customer')return <p className={css.workHint}>The customer owns the next step. OPOS will reflect their submission when it is received; no duplicate invitation should be issued while the session is active.</p>;
  if(actionKey==='wait_partner')return <p className={css.workHint}>The selected Execution Partner owns the assessment. OPOS is waiting for their secured technical and commercial response.</p>;
  if(actionKey==='resolve_clarification')return <p className={css.workHint}>Clarification is pending. Review the recorded request and obtain the required partner response before approving feasibility.</p>;
  if(actionKey==='closed')return <p className={css.workHint}>The opportunity is closed. Its decision evidence remains in the record history.</p>;
  return <p className={css.workHint}>Review the controlled record for the currently permitted action.</p>;
}
