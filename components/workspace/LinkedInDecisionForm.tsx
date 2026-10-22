'use client';

import { useState } from 'react';
import { recordLinkedInDecisionAction } from '@/app/workspace/acquisition/linkedin-actions';
import styles from '@/app/workspace/acquisition/LinkedInFlow.module.css';

type Decision='waiting'|'followup'|'interested'|'closed';

function localInputValue(iso:string|null|undefined) {
  if(!iso) return '';
  const date=new Date(iso);
  if(!Number.isFinite(date.getTime()))return '';
  const pad=(n:number)=>String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function LinkedInDecisionForm({
  prospectId, initialDecision, followUpAt,
}:{
  prospectId:string;initialDecision:Decision;followUpAt:string|null|undefined;
}) {
  const [decision,setDecision]=useState<Decision>(initialDecision);
  const [followUp,setFollowUp]=useState(localInputValue(followUpAt));
  const timestamp=followUp && Number.isFinite(new Date(followUp).getTime())
    ? new Date(followUp).toISOString() : '';
  return <form action={recordLinkedInDecisionAction} className={styles.outcomeForm}>
    <input type="hidden" name="prospect_id" value={prospectId}/>
    <input type="hidden" name="decision" value={decision}/>
    <input type="hidden" name="next_follow_up_at_iso" value={decision==='followup'?timestamp:''}/>
    <label>What happened?
      <select value={decision} onChange={event=>setDecision(event.target.value as Decision)}>
        <option value="waiting">Message sent / awaiting reply</option>
        <option value="followup">Follow up later</option>
        <option value="interested">Prospect is interested</option>
        <option value="closed">Not interested / close</option>
      </select>
    </label>
    {decision==='followup'?<label>Next follow-up (your local time)
      <input type="datetime-local" value={followUp} onChange={event=>setFollowUp(event.target.value)} required/>
    </label>:null}
    <label>{decision==='closed'?'Reason for closing':'Conversation note (optional)'}
      <textarea name="note" rows={3} maxLength={4000}
        required={decision==='closed'} minLength={decision==='closed'?5:undefined}
        placeholder={decision==='closed'?'Why is this prospect not a fit?':'Anything useful to remember from the conversation'}/>
    </label>
    {decision==='interested'?<div className={styles.formNote}>This records marketing interest only. You will then be able to create a secure requirements request. Nothing is sent automatically.</div>:null}
    <button className="button" type="submit">Save next action ↗</button>
    <small>OPOS keeps the underlying outreach and commercial status consistent.</small>
  </form>;
}
