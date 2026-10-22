import LinkedInConversationImportForm from '@/components/workspace/LinkedInConversationImportForm';
import styles from '@/app/workspace/acquisition/LinkedInFlow.module.css';

type Message = {
  id:string;source:string;speaker:string;body:string;
  sent_at:string|null;imported_at:string;original_order?:number;
};
type Import = {
  id:string;source:string;source_url:string|null;
  original_text:string;created_at:string;
};

function formatDate(value:string|null){
  if(!value)return '';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(date):'';
}

export default function ProspectConversationPanel({
  prospectId,messages,imports,canImport,
}:{
  prospectId:string;messages:Message[];imports:Import[];canImport:boolean;
}){
  const ordered=[...messages].sort((a,b)=>{
    const first=Date.parse(a.sent_at||a.imported_at),second=Date.parse(b.sent_at||b.imported_at);
    return first-second || (a.original_order??0)-(b.original_order??0);
  });
  return <section className={styles.paper} aria-label="LinkedIn conversation history">
    <div className={styles.panelTop}>
      <div><p className={styles.eyebrow}>LinkedIn / Sales Navigator</p><h2>Conversation</h2></div>
      <span className={styles.pill}>{messages.length} messages</span>
    </div>
    <p>One continuing record of the business conversation. Messages are copied manually; nothing is sent automatically.</p>
    {ordered.length?<ol className={styles.historyList}>
      {ordered.map(message=><li key={message.id}>
        <strong>{message.speaker==='you'?'You':message.speaker==='prospect'?'Prospect':'Unassigned sender'}</strong>
        <small> · {message.source==='sales_navigator'?'Sales Navigator':'LinkedIn'} · {message.sent_at?'Sent '+formatDate(message.sent_at):'Imported '+formatDate(message.imported_at)}</small>
        <p>{message.body}</p>
      </li>)}
    </ol>:<div className={styles.emptyConversation}>
      <strong>No copied conversation yet.</strong>
      <p>Open the conversation on LinkedIn, copy the relevant messages, and paste them below.</p>
    </div>}
    {canImport?<details className={styles.importToggle}>
      <summary>+ Paste or append conversation</summary>
      <LinkedInConversationImportForm prospectId={prospectId}/>
    </details>:null}
    {imports.length?<div className={styles.archive}>
      <details><summary>Original transcripts ({imports.length}{imports.length===25?'+':''})</summary>
        {imports.map(item=><details key={item.id}>
          <summary>{item.source==='sales_navigator'?'Sales Navigator':'LinkedIn'} · archived {formatDate(item.created_at)}</summary>
          {item.source_url?<p><a href={item.source_url} target="_blank" rel="noopener noreferrer">Open source on LinkedIn ↗</a></p>:null}
          <pre>{item.original_text}</pre>
        </details>)}
        {imports.length===25?<small>Showing the latest 25 original imports. Older records remain archived.</small>:null}
      </details>
    </div>:null}
  </section>;
}
