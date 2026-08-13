import { createProspectPartnerReviewAction, decideProspectPartnerReviewAction } from '@/app/workspace/acquisition/partner-actions';
import { ActionDialog, EvidenceRow, ProductDisclosure } from '@/components/workspace/InteractionPrimitives';

type Partner = { id:string; company_name:string; rating:number|null; email:string|null };
type Request = { id:string; status:string; response_due_at:string; case_reference:string; partner?:{company_name?:string|null}|null };
type Response = { id:string; feasibility:string; confidence_percent:number; capacity_status:string; estimated_engineering_hours:number|null; estimated_lead_time_days:number|null; assumptions:string|null; technical_risks:string|null; missing_information:string|null; exclusions:string|null; reviewer_name:string; reviewer_role:string|null };
type Quote = { id:string; price:number; currency:string; valid_until:string|null; payment_terms:string|null; delivery_commitment:string|null; commercial_assumptions:string|null; exclusions:string|null; quote_reference:string|null };
type Decision = { decision:string; review_notes:string|null; clarification_request:string|null; approved_at:string|null };

function value(input:unknown,fallback='Not recorded'){return input===null||input===undefined||input===''?fallback:String(input)}
function money(valueInput:number|undefined,currency:string|undefined){return valueInput===undefined?'Not received':`${currency||'GBP'} ${Number(valueInput).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
function dateTime(input:string|undefined){if(!input)return 'Not set';const date=new Date(input);return Number.isNaN(date.getTime())?input:date.toLocaleString('en-GB')}
function human(input:string|undefined){return String(input||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}

export default function AcquisitionPartnerGate({
  prospectId,intakeSessionId,scopeSummary,partners,request,response,quote,decision,reviewUrl,
}:{
  prospectId:string;intakeSessionId:string;scopeSummary:string;partners:Partner[];request:Request|null;response:Response|null;quote:Quote|null;decision:Decision|null;reviewUrl?:string;
}){
  const dueDefault=new Date(Date.now()+3*24*60*60*1000).toISOString().slice(0,16);

  if(!request){
    if(!partners.length) return <div className="vp-empty">No approved NDA-compliant partners are available. Add or approve a partner before progressing this opportunity.</div>;
    return <div style={{display:'grid',gap:14}}>
      <div className="vp-callout"><strong>Partner assessment required</strong><p>One approved NDA-ready Execution Partner must confirm feasibility and price before Go / No-Go.</p></div>
      <ActionDialog
        title="Send to Execution Partner"
        description="The submitted client evidence and current scope summary will be released for governed feasibility, capacity and pricing review."
        triggerLabel="Send to Partner"
      >
        <form action={createProspectPartnerReviewAction} style={{display:'grid',gap:16}}>
          <input type="hidden" name="prospect_id" value={prospectId}/>
          <input type="hidden" name="intake_session_id" value={intakeSessionId}/>
          <input type="hidden" name="scope_summary" value={scopeSummary}/>
          <label className="field">Execution Partner<select name="partner_id" required defaultValue=""><option value="" disabled>Select approved Partner</option>{partners.map(p=><option key={p.id} value={p.id}>{p.company_name}</option>)}</select></label>
          <label style={{display:'flex',gap:10,alignItems:'flex-start'}}><input type="checkbox" name="show_client_identity" value="true"/><span>Show client identity to this Partner for the controlled review</span></label>
          <ProductDisclosure summary="Advanced review settings">
            <div style={{display:'grid',gap:14}}>
              <label className="field">Response due<input type="datetime-local" name="response_due_at" defaultValue={dueDefault} required/></label>
              <label className="field">Review instructions<textarea name="review_instructions" rows={3} defaultValue="Confirm feasibility, assumptions, engineering hours, lead time, capacity and commercial price. Flag any missing information before committing."/></label>
            </div>
          </ProductDisclosure>
          <button className="button" type="submit">Send assessment</button>
        </form>
      </ActionDialog>
    </div>;
  }

  if(['invited','opened','in_progress'].includes(request.status)){
    const state=request.status==='invited'?'Waiting for Partner response':'Partner assessment in progress';
    return <div style={{display:'grid',gap:14}}>
      <div className="vp-callout"><strong>{state}</strong><p>{request.partner?.company_name||'Execution Partner'} owns the next move. No internal decision is required until the governed response and price arrive.</p></div>
      <div className="op-evidence-list">
        <EvidenceRow label="Execution Partner" value={request.partner?.company_name||'Not recorded'} tone="waiting"/>
        <EvidenceRow label="Response due" value={dateTime(request.response_due_at)} tone="waiting"/>
      </div>
      <ProductDisclosure summary="Assessment details">
        <div className="op-evidence-list">
          <EvidenceRow label="Reference" value={request.case_reference}/>
          <EvidenceRow label="Review state" value={state}/>
        </div>
        {reviewUrl?<div className="vp-callout" style={{marginTop:14}}><strong>Developer / owner test access</strong><a className="button secondary" href={reviewUrl} target="_blank" rel="noreferrer">Open Partner portal</a></div>:null}
      </ProductDisclosure>
    </div>;
  }

  if(response && request.status==='submitted' && !decision){
    return <div style={{display:'grid',gap:16}} id="approval-decision">
      <div className="vp-callout"><strong>Go / No-Go decision required</strong><p>The Partner response is complete. Decide whether this opportunity is commercially and technically fit to enter Case 360.</p></div>
      <div className="op-evidence-list">
        <EvidenceRow label="Execution Partner" value={request.partner?.company_name||'Execution Partner'}/>
        <EvidenceRow label="Feasibility" value={`${human(response.feasibility)} · ${response.confidence_percent}% confidence`} tone={response.feasibility==='not_feasible'?'attention':'complete'}/>
        <EvidenceRow label="Partner price" value={money(quote?.price,quote?.currency)} tone={quote?.price?'complete':'attention'}/>
        <EvidenceRow label="Delivery position" value={response.estimated_lead_time_days?`${response.estimated_lead_time_days} days · ${human(response.capacity_status)}`:human(response.capacity_status)}/>
      </div>

      <ProductDisclosure summary="Review Partner response">
        <div style={{display:'grid',gap:16}}>
          <div className="op-evidence-list">
            <EvidenceRow label="Engineering hours" value={value(response.estimated_engineering_hours)}/>
            <EvidenceRow label="Quote validity" value={quote?.valid_until||'Not recorded'}/>
            {quote?.delivery_commitment?<EvidenceRow label="Delivery commitment" value={quote.delivery_commitment}/>:null}
            {quote?.payment_terms?<EvidenceRow label="Partner payment terms" value={quote.payment_terms}/>:null}
          </div>
          {response.assumptions?<div><strong>Partner assumptions</strong><p style={{whiteSpace:'pre-wrap'}}>{response.assumptions}</p></div>:null}
          {response.technical_risks?<div><strong>Technical risks</strong><p style={{whiteSpace:'pre-wrap'}}>{response.technical_risks}</p></div>:null}
          {response.missing_information?<div><strong>Missing information</strong><p style={{whiteSpace:'pre-wrap'}}>{response.missing_information}</p></div>:null}
          {response.exclusions?<div><strong>Technical exclusions</strong><p style={{whiteSpace:'pre-wrap'}}>{response.exclusions}</p></div>:null}
          {quote?.commercial_assumptions?<div><strong>Commercial assumptions</strong><p style={{whiteSpace:'pre-wrap'}}>{quote.commercial_assumptions}</p></div>:null}
          {quote?.exclusions?<div><strong>Commercial exclusions</strong><p style={{whiteSpace:'pre-wrap'}}>{quote.exclusions}</p></div>:null}
        </div>
      </ProductDisclosure>

      <ActionDialog
        title="Record Go / No-Go"
        description="This governed decision closes the Acquisition assessment boundary. Partner evidence remains attached to the exact submitted response revision."
        triggerLabel="Make Go / No-Go decision"
      >
        <form action={decideProspectPartnerReviewAction} style={{display:'grid',gap:14}}>
          <input type="hidden" name="prospect_id" value={prospectId}/>
          <input type="hidden" name="request_id" value={request.id}/>
          <input type="hidden" name="response_id" value={response.id}/>
          <label className="field">Decision<select name="decision" required defaultValue="approved"><option value="approved">Go · proceed to Case 360</option><option value="approved_with_conditions">Go with conditions</option><option value="clarification_required">Request Partner clarification</option><option value="rejected">No-Go · close opportunity</option></select></label>
          <label className="field">Decision notes / conditions<textarea name="review_notes" rows={3} placeholder="Record only your decision rationale or conditions; do not copy the Partner response."/></label>
          <label className="field">Clarification request<textarea name="clarification_request" rows={2} placeholder="Complete only when clarification is required."/></label>
          <button className="button" type="submit">Record decision</button>
        </form>
      </ActionDialog>
    </div>;
  }

  if(decision?.decision==='clarification_required') return <div className="vp-callout"><strong>Waiting for Partner clarification</strong><p>{decision.clarification_request||'Partner clarification is required before this opportunity can proceed.'}</p></div>;
  if(['approved','approved_with_conditions'].includes(decision?.decision||'')) return <div className="vp-callout"><strong>Go approved</strong><p>Partner feasibility and pricing are governed evidence. The next permitted action is to create Case 360.</p></div>;
  if(decision?.decision==='rejected') return <div className="vp-callout"><strong>No-Go recorded</strong><p>This opportunity is closed in Acquisition and must not enter Case 360.</p></div>;
  return <div className="vp-empty">Partner assessment context is incomplete.</div>;
}
