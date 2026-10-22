import { addOutreachNoteAction } from '@/app/outreach/note-actions';
import styles from '@/app/workspace/acquisition/LinkedInFlow.module.css';

type Entry = { id:string;source:string;body:string;created_at:string };
const fmt=(v:string)=>new Intl.DateTimeFormat('en-GB',{
 dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London',
}).format(new Date(v));
export default function OutreachConversationJournal({
 outreachId,entries,canWrite,
}:{outreachId:string;entries:Entry[];canWrite:boolean}) {
 return <section className={styles.paper} aria-label="LinkedIn conversation history">
   <div className={styles.panelTop}>
     <div><p className={styles.eyebrow}>LINKEDIN / SALES NAVIGATOR</p><h2>Conversation</h2></div>
     <span className={styles.pill}>{entries.length} entr{entries.length===1?'y':'ies'}</span>
   </div>
   {entries.length?<ol className={styles.historyList}>
    {entries.map(e=><li key={e.id}>
      <strong>{e.source==='sales_navigator'?'Sales Navigator':e.source==='linkedin'?'LinkedIn':'Internal note'}</strong>
      <small> · Saved {fmt(e.created_at)}</small>
      <p>{e.body}</p>
    </li>)}
   </ol>:<div className={styles.emptyConversation}>
     <strong>Start the conversation on LinkedIn.</strong>
     <p>Copy the relevant exchange into this record as it develops. It stays outside CRM until confirmed interest.</p>
   </div>}
   {canWrite?<form action={addOutreachNoteAction} className={styles.journalForm}>
     <input type="hidden" name="outreach_id" value={outreachId}/>
     <label>Source
       <select name="source" defaultValue="linkedin">
        <option value="linkedin">LinkedIn</option>
        <option value="sales_navigator">Sales Navigator</option>
        <option value="note">Internal note</option>
       </select>
     </label>
     <label>Paste conversation or add note
       <textarea name="body" maxLength={60000} required rows={6}
         placeholder={'You: Hello, do you outsource CAD capacity?\nProspect: Yes, sometimes.'}/>
     </label>
     <div className={styles.journalFooter}>
       <span>Manual archive; original pasted text is kept. No messages sent or interest inferred.</span>
       <button className="button" type="submit">Save to conversation ↗</button>
     </div>
   </form>:null}
 </section>;
}
