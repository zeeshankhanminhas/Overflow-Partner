import type { ReactNode } from 'react';
import Link from 'next/link';
import LinkedInDecisionForm from '@/components/workspace/LinkedInDecisionForm';
import ProspectOutreachTools from '@/components/workspace/ProspectOutreachTools';
import { createStep2InvitationFormAction } from '@/app/workspace/acquisition/actions';
import styles from '@/app/workspace/acquisition/LinkedInFlow.module.css';

type Event = {id:string;event_type:string;created_at:string;event_data?:unknown};
type Decision='waiting'|'followup'|'interested'|'closed';

export default function LinkedInProspectWorkspace({
  id,companyName,contactName,jobTitle,linkedInUrl,openingMessage,followUpAt,
  interested,closed,decision,conversation,events,notices,canDecide,
}:{
  id:string;companyName:string;contactName:string|null;jobTitle:string|null;
  linkedInUrl:string|null;openingMessage:string;followUpAt:string|null;
  interested:boolean;closed:boolean;decision:Decision;
  conversation:ReactNode;events:Event[];notices:ReactNode;canDecide:boolean;
}) {
  const date=(value:string)=>{const d=new Date(value);return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(d)
    : 'Unknown date';};
  const notes=events.filter(event=>{
    const data=event.event_data as {note?:unknown}|null;
    return data && typeof data.note==='string' && Boolean(data.note.trim());
  });
  return <section className={`${styles.record} ${styles.simpleRecord}`}>
    <header className={styles.recordTop}>
      <div>
        <Link href="/outreach" className={styles.back}>← All conversations</Link>
        <h1>{companyName}</h1>
        <p>{contactName||'Contact'}{jobTitle?' · '+jobTitle:''}</p>
      </div>
      <ProspectOutreachTools linkedinUrl={linkedInUrl} message={openingMessage}/>
    </header>
    {notices?<div className={styles.alert}>{notices}</div>:null}
    {interested?<section className={styles.simpleNext}>
      <div><strong>Interested — ready for requirements</strong>
        <p>Confirming interest allows a secure requirements request. It does not qualify the project.</p>
      </div>
      <form action={createStep2InvitationFormAction}>
        <input type="hidden" name="prospect_id" value={id}/>
        <button className="button" type="submit">Start requirements →</button>
      </form>
    </section>:null}
    {closed?<p className={styles.actionHint}>This prospect is closed. The conversation remains available for reference.</p>:null}
    {conversation||<section className={styles.paper}>
      <h2>Conversation</h2>
      <p>Manual LinkedIn conversation importing is not enabled in this preview. Your prospect record and next actions are still available.</p>
    </section>}
    {canDecide&&!closed?<section className={styles.simpleDecision}>
      <div>
        <p className={styles.eyebrow}>Next step</p>
        <h2>{interested?'Record another update':'What happened next?'}</h2>
        {followUpAt?<p>Follow up: {date(followUpAt)}</p>:null}
      </div>
      <LinkedInDecisionForm prospectId={id} initialDecision={decision} followUpAt={followUpAt}/>
    </section>:null}
    {notes.length?<details className={styles.simpleNotes}>
      <summary>Earlier notes ({notes.length})</summary>
      <ul>{notes.map(event=><li key={event.id}>
        <small>{date(event.created_at)}</small>
        <p>{String((event.event_data as {note:string}).note)}</p>
      </li>)}</ul>
    </details>:null}
  </section>;
}
