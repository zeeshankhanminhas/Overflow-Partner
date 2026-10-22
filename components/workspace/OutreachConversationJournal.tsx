import { addOutreachNoteAction } from '@/app/outreach/note-actions';
import styles from '@/app/workspace/acquisition/LinkedInFlow.module.css';

type Event = {
 id:string;event_type:string;created_at:string;
 event_data?:unknown;
};
const fmt=(value:string)=>new Intl.DateTimeFormat('en-GB',{
 dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London',
}).format(new Date(value));

/** First useful conversation workflow without writing new database tables.
 * A structured sender-labelled importer can replace this after DB rollout. */
export default function OutreachConversationJournal({
 prospectId,events,canWrite,
}:{prospectId:string;events:Event[];canWrite:boolean}) {
 const notes=events.filter(e=>{
  const d=e.event_data as {note?:unknown}|null;
  return d&&typeof d.note==='string'&&Boolean(d.note.trim());
 });
 return <section className={styles.paper} aria-label="Conversation history">
   <div className={styles.panelTop}>
     <div>
       <p className={styles.eyebrow}>LinkedIn / Sales Navigator</p>
       <h2>Conversation</h2>
     </div>
     <span className={styles.pill}>{notes.length} note{notes.length===1?'':'s'}</span>
   </div>
   {notes.length?<ol className={styles.historyList}>
     {notes.map(e=><li key={e.id}>
       <strong>{e.event_type==='prospect.linkedin_conversation_note'?'Copied conversation':'Conversation update'}</strong>
       <small> · {fmt(e.created_at)}</small>
       <p>{(e.event_data as {note:string}).note}</p>
     </li>)}
   </ol>:<div className={styles.emptyConversation}>
     <strong>No conversation notes yet</strong>
     <p>Continue talking on LinkedIn, then paste the relevant exchange here so you have its context when following up.</p>
   </div>}
   {canWrite?<form action={addOutreachNoteAction} className={styles.journalForm}>
     <input type="hidden" name="prospect_id" value={prospectId}/>
     <label>Paste a conversation excerpt or add a note
       <textarea required rows={5} maxLength={6000} name="body" placeholder={'You: Hello, do you work with overflow CAD support?\nProspect: Yes, occasionally.'}/>
     </label>
     <div className={styles.journalFooter}>
       <span>Manual notes are stored in the Prospect activity history. Copy only relevant business correspondence.</span>
       <button className="button" type="submit">Save note ↗</button>
     </div>
   </form>:null}
 </section>;
}
