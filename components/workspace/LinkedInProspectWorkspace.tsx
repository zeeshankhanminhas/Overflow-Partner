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
  return <section className={styles.record}>
    <header className={styles.recordTop}>
      <div>
        <Link href="/workspace/acquisition/funnel" className={styles.back}>← LinkedIn worklist</Link>
        <h1>{companyName}</h1>
        <p>{contactName||'Contact'}{jobTitle?' · '+jobTitle:''}</p>
      </div>
      <ProspectOutreachTools linkedinUrl={linkedInUrl} message={openingMessage}/>
    </header>
    {notices?<div className={styles.alert}>{notices}</div>:null}
    <div className={styles.profileGrid}>
      <div>
        {conversation||<section className={styles.paper}>
          <h2>Conversation</h2>
          <p>Conversation importing becomes available once its secure archive is enabled. You can still record your outcome on the right.</p>
        </section>}
        <section className={styles.activity}>
          <details>
            <summary>Recent conversation notes ({notes.length})</summary>
            {notes.length?<ul>{notes.map(event=><li key={event.id}>
              <small>{date(event.created_at)}</small>
              <p>{String((event.event_data as {note:string}).note)}</p>
            </li>)}</ul>:<p>No additional notes recorded.</p>}
          </details>
        </section>
      </div>
      <aside className={styles.actionPanel}>
        <section className={styles.paper}>
          <p className={styles.eyebrow}>Next action</p>
          {closed?<><h2>Closed</h2><p>Excluded from the active campaign. The conversation and decision history remain on this record.</p></>
            :interested?<><h2>Ready for requirements</h2>
              <p>Interest is confirmed. Create the secure requirements request to begin the governed technical enquiry. This is not technical qualification.</p>
              <form action={createStep2InvitationFormAction}>
                <input type="hidden" name="prospect_id" value={id}/>
                <button className="button" type="submit">Create requirements request ↗</button>
              </form>
            </>:<><h2>{followUpAt?'Follow up':'Keep the conversation moving'}</h2>
              <p>{followUpAt?'Next follow-up: '+date(followUpAt):'Send a personal message on LinkedIn, then record the next action.'}</p>
              <p>No automatic messages are sent from OPOS.</p>
            </>}
        </section>
        {canDecide&&!closed?<section className={styles.paper}>
          <p className={styles.eyebrow}>Record progress</p>
          <h2>What happened?</h2>
          <p>One decision replaces multiple status dropdowns.</p>
          <LinkedInDecisionForm prospectId={id} initialDecision={decision} followUpAt={followUpAt}/>
        </section>:null}
      </aside>
    </div>
  </section>;
}
