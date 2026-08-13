import { recordClientReviewOutcomeAction, recordClientTransmittalAction } from './client-actions';

export function ClientDeliveryRecordAction({projectId,recipientName,recipientEmail,blocked,blocker}:{projectId:string;recipientName:string;recipientEmail:string;blocked:boolean;blocker?:string}){
  return <div className="stack">
    <div className="vp-callout"><strong>Record client delivery</strong><p>After the approved delivery has been sent outside Overflow Partner, record who received it and how it was sent.</p></div>
    <form action={recordClientTransmittalAction} className="stack">
      <input type="hidden" name="project_id" value={projectId}/>
      <div className="grid gap-4 md:grid-cols-2">
        <label>Recipient name<input name="recipient_name" required defaultValue={recipientName}/></label>
        <label>Recipient email<input name="recipient_email" type="email" defaultValue={recipientEmail}/></label>
      </div>
      <label>Delivery method<select name="delivery_method" required defaultValue="email"><option value="email">Email</option><option value="secure_link">Secure link</option><option value="client_portal">Client portal</option><option value="other">Other method</option></select></label>
      <label>Delivery note<textarea name="note" rows={3} placeholder="Optional delivery note"/></label>
      <button className="button" disabled={blocked}>Record delivery sent</button>
    </form>
    {blocked&&blocker?<p>Resolve first: {blocker}</p>:null}
  </div>;
}

export function ClientReviewOutcomeAction({projectId}:{projectId:string}){
  return <div className="stack">
    <div className="vp-callout"><strong>Record client outcome</strong><p>Record the written client response. Acceptance can move the project toward completion; requested changes send the work back for Partner correction.</p></div>
    <form action={recordClientReviewOutcomeAction} className="stack">
      <input type="hidden" name="project_id" value={projectId}/>
      <label>Client outcome<select name="outcome" required defaultValue=""><option value="" disabled>Select outcome</option><option value="accepted">Accepted</option><option value="accepted_with_comments">Accepted with comments</option><option value="changes_requested">Changes requested</option><option value="rejected">Rejected / correction required</option></select></label>
      <label>Evidence basis<select name="evidence_basis" required defaultValue="email_confirmation"><option value="email_confirmation">Email confirmation</option><option value="signed_acceptance">Signed acceptance</option><option value="client_portal">Client portal</option><option value="meeting_record">Meeting record</option><option value="other_written">Other written evidence</option></select></label>
      <label>Evidence reference<input name="evidence_reference" required placeholder="Email subject/date, signed acceptance ref, meeting record..."/></label>
      <label>Comments<textarea name="comments" rows={3}/></label>
      <button className="button">Record client outcome</button>
    </form>
  </div>;
}
