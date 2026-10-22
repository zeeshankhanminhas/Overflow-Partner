'use client';
import { useState } from 'react';
import { updateOutreachThreadAction } from '@/app/outreach/actions';
import styles from '@/app/workspace/acquisition/LinkedInFlow.module.css';

type State='new'|'waiting'|'followup'|'interested'|'closed'|'converted';
function localValue(iso:string|null) {
 if(!iso)return '';
 const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';
 const pad=(n:number)=>String(n).padStart(2,'0');
 return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export default function OutreachDisposition({id,state,nextFollowUp}:{
 id:string;state:State;nextFollowUp:string|null;
}){
 const [next,setNext]=useState(state==='new'?'waiting':state);
 const [when,setWhen]=useState(localValue(nextFollowUp));
 const timestamp=when&&Number.isFinite(new Date(when).getTime())?new Date(when).toISOString():'';
 return <form action={updateOutreachThreadAction} className={styles.outcomeForm}>
  <input type="hidden" name="id" value={id}/>
  <input type="hidden" name="state" value={next}/>
  <input type="hidden" name="follow_up_iso" value={next==='followup'?timestamp:''}/>
  <label>What happens next?
   <select value={next} onChange={e=>setNext(e.target.value)}>
    <option value="waiting">Await a reply</option>
    <option value="followup">Follow up later</option>
    <option value="interested">Interest confirmed</option>
    <option value="closed">Not interested / close</option>
   </select>
  </label>
  {next==='followup'?<label>Follow-up (local time)
   <input type="datetime-local" required value={when} onChange={e=>setWhen(e.target.value)}/>
  </label>:null}
  {next==='interested'?<p className={styles.formNote}>This only confirms interest. You decide when to create the Prospect, Company and Contact in CRM.</p>:null}
  <button type="submit" className="button">Save next action ↗</button>
 </form>;
}
