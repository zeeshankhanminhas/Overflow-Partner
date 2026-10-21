import { recordClientReviewOutcomeAction, recordClientTransmittalAction } from './client-actions';

export function ClientDeliveryRecordAction({projectId,recipientName,recipientEmail,blocked,blocker}:{projectId:string;recipientName:string;recipientEmail:string;blocked:boolean;blocker?:string}){
  const recipientReady=Boolean(recipientName&&recipientEmail);
  return <div className="stack">
    <div className="crm-recipient"><div className="crm-identity"><span className="crm-identity__mark" aria-hidden="true">C</span><div className="crm-identity__copy"><span className="crm-recipient__role">Delivery reviewer</span><strong>{recipientName||'Client contact required'}</strong><small>{recipientEmail||'Email address required before sending'}</small></div></div><span>{recipientReady?'Ready':'Incomplete'}</span></div>
    <form action={recordClientTransmittalAction} className="stack">
      <input type="hidden" name="project_id" value={projectId}/>
      <div className="grid gap-4 md:grid-cols-2"><label>Recipient name<input name="recipient_name" required defaultValue={recipientName}/></label><label>Recipient email<input name="recipient_email" type="email" required defaultValue={recipientEmail}/></label></div>
      <label>Delivery method<select name="delivery_method" required defaultValue="email"><option value="email">Email</option><option value="secure_link">Secure link</option><option value="client_portal">Client portal</option><option value="other">Other method</option></select></label>
      <label>Delivery note<textarea name="note" rows={3} placeholder="Optional delivery note"/></label>
      <button className="button" disabled={blocked||!recipientReady}>Send delivery to client</button>
    </form>
    {blocked&&blocker?<p>Resolve first: {blocker}</p>:!recipientReady?<p>Add an authoritative client contact and email before issuing the delivery.</p>:null}
  </div>;
}

export function ClientReviewOutcomeAction({projectId,dueAt,overdue}:{projectId:string;dueAt?:string;overdue?:boolean}){
  return <div className="stack">{dueAt?<p><strong>Client review deadline:</strong> {new Date(dueAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})} · {overdue?'Overdue — follow up before recording late changes':'Seven England/Wales working days from the controlled issue'}</p>:null}<form action={recordClientReviewOutcomeAction} className="stack"><input type="hidden" name="project_id" value={projectId}/><label>Client outcome<select name="outcome" required defaultValue=""><option value="" disabled>Select outcome</option><option value="accepted">Accepted</option><option value="accepted_with_comments">Accepted with comments</option><option value="changes_requested">Changes requested</option><option value="rejected">Rejected / correction required</option></select></label><label>Evidence basis<select name="evidence_basis" required defaultValue="email_confirmation"><option value="email_confirmation">Email confirmation</option><option value="signed_acceptance">Signed acceptance</option><option value="client_portal">Client portal</option><option value="meeting_record">Meeting record</option><option value="other_written">Other written evidence</option></select></label><label>Evidence reference<input name="evidence_reference" required placeholder="Email subject/date, signed acceptance ref, meeting record..."/></label><label>Feedback type (required when changes are requested)
  <select name="feedback_category" defaultValue="in_scope_correction">
    <option value="in_scope_correction">Correction within the approved scope</option>
    <option value="revision">Revision of an already approved design</option>
    <option value="out_of_scope_change">New or out-of-scope requirement</option>
  </select>
</label>
<label className="flex gap-2"><input type="checkbox" name="partner_defect" value="true"/> Correction of a partner error against the approved scope (not counted against the client's included round)</label>
<label>Consolidated review comments<textarea name="comments" rows={4} placeholder="List all corrections against their document/revision references in one consolidated response."/></label>
<p>Client review window: seven working days. One consolidated in-scope correction round is included. Partner defects must still be fixed; revisions and out-of-scope requests require separate technical and commercial approval.</p>
<button className="button">Record client outcome</button></form></div>;
}
