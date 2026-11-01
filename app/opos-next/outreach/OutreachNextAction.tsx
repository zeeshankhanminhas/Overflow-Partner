'use client';
import {useState} from 'react';
import {updateOutreachThreadAction} from '@/app/outreach/actions';
import css from './outreach.module.css';

type Disposition='waiting'|'followup'|'interested'|'closed';
function toLocal(iso:string|null){
 if(!iso)return '';
 const date=new Date(iso);if(!Number.isFinite(date.getTime()))return '';
 const pad=(v:number)=>String(v).padStart(2,'0');
 return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export default function OutreachNextAction({id,state,nextFollowUp}:{id:string;state:string;nextFollowUp:string|null}){
 const [next,setNext]=useState<Disposition>(state==='followup'?'followup':state==='waiting'?'waiting':'waiting');
 const [followUp,setFollowUp]=useState(toLocal(nextFollowUp));
 const valid=next!=='followup'||(Boolean(followUp)&&Number.isFinite(new Date(followUp).getTime()));
 return <form action={updateOutreachThreadAction} className={css.form}>
   <input type="hidden" name="opos_next" value="1"/>
   <input type="hidden" name="id" value={id}/>
   <input type="hidden" name="state" value={next}/>
   <input type="hidden" name="follow_up_iso" value={next==='followup'&&valid?new Date(followUp).toISOString():''}/>
   <label>Next conversation decision
     <select value={next} onChange={e=>setNext(e.target.value as Disposition)}>
       <option value="waiting">Await a reply</option>
       <option value="followup">Schedule follow-up</option>
       <option value="interested">Interest confirmed — eligible for CRM</option>
       <option value="closed">Close conversation</option>
     </select>
   </label>
   {next==='followup'?<label>Follow-up (local time)<input type="datetime-local" required value={followUp} onChange={e=>setFollowUp(e.target.value)}/></label>:null}
   {next==='interested'?<p>Confirming interest does not automatically create a CRM record or send an invitation.</p>:null}
   <button type="submit" disabled={!valid}>Save next action →</button>
 </form>;
}
