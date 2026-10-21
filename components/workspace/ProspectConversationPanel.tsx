import { importProspectConversationAction } from '@/app/workspace/acquisition/conversation-actions';

type Message = {
  id:string; source:string; speaker:string; body:string;
  sent_at:string|null; imported_at:string;
};
type Import = {
  id:string; source:string; source_url:string|null;
  original_text:string; created_at:string;
};

function formatDate(value: string | null): string {
  if (!value) return 'Time not supplied';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(date)
    : 'Time not supplied';
}

export default function ProspectConversationPanel({
  prospectId, messages, imports, canImport,
}:{
  prospectId:string; messages:Message[]; imports:Import[]; canImport:boolean;
}) {
  const order = [...messages].reverse();
  return <section className="stack" aria-label="LinkedIn conversation history" style={{gap:16}}>
    <div>
      <p className="vp-kicker">LinkedIn / Sales Navigator</p>
      <h3>Conversation history</h3>
      <p style={{color:'var(--op-muted)'}}>Only manually copied business messages are stored here. Importing does not mark a prospect interested, send a message or open technical intake.</p>
    </div>
    {canImport ? <details className="product-notice">
      <summary style={{cursor:'pointer',fontWeight:650}}>Import or append conversation</summary>
      <form action={importProspectConversationAction} className="stack" style={{marginTop:14}}>
        <input type="hidden" name="prospect_id" value={prospectId}/>
        <label>Copied from
          <select name="source" defaultValue="linkedin" required>
            <option value="linkedin">LinkedIn</option>
            <option value="sales_navigator">Sales Navigator</option>
          </select>
        </label>
        <label>Conversation URL (optional)
          <input type="url" name="source_url" placeholder="https://www.linkedin.com/messaging/..." maxLength={2048}/>
        </label>
        <label>Paste conversation
          <textarea name="transcript" required maxLength={60000} rows={10}
            placeholder={'You: Hello, do you use overflow CAD support?\nProspect: Occasionally, yes.\n[2026-10-20T14:30:00Z] You: Happy to share details.'}/>
        </label>
        <small>Label each message You: or Prospect: for a structured timeline. Optional ISO timestamps distinguish repeated identical replies. The complete original paste is always retained. Re-importing an earlier conversation skips duplicates.</small>
        <button className="button" type="submit">Save conversation to this prospect</button>
      </form>
    </details> : <p>You can read this history, but only authorised acquisition operators may import messages.</p>}
    <div className="stack" style={{gap:10}}>
      <strong>Recorded messages</strong>
      {order.length === 0 ? <p className="vp-empty">No copied conversations yet.</p> : order.map(item =>
        <div className="project-os-history-row" key={item.id}>
          <span aria-hidden="true">{item.speaker === 'you' ? '↗' : item.speaker === 'prospect' ? '↙' : '•'}</span>
          <div style={{minWidth:0}}>
            <strong>{item.speaker === 'you' ? 'You' : item.speaker === 'prospect' ? 'Prospect' : 'Unlabelled transcript'}</strong>
            <small>{item.source === 'sales_navigator' ? 'Sales Navigator' : 'LinkedIn'} · {formatDate(item.sent_at ?? item.imported_at)}</small>
            <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{item.body}</p>
          </div>
        </div>
      )}
      {messages.length >= 500 ? <small>Showing the latest 500 recorded messages. Older messages remain archived; this preview is limited.</small> : null}
    </div>
    <details className="product-notice">
      <summary style={{cursor:'pointer'}}>Original pasted transcripts ({imports.length}{imports.length === 25 ? '+' : ''})</summary>
      <div className="stack" style={{marginTop:10}}>
        {imports.length ? imports.map(item=>
          <details key={item.id}>
            <summary style={{cursor:'pointer'}}>{item.source === 'sales_navigator' ? 'Sales Navigator' : 'LinkedIn'} · imported {formatDate(item.created_at)}</summary>
            {item.source_url ? <p><a href={item.source_url} target="_blank" rel="noopener noreferrer">Open original conversation</a></p> : null}
            <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit',fontSize:'0.9em'}}>{item.original_text}</pre>
          </details>
        ) : <p>No source transcript archived.</p>}
        {imports.length === 25 ? <small>Only the latest 25 imports are shown here; all imports remain archived in the database.</small> : null}
      </div>
    </details>
  </section>;
}
