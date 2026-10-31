'use client';
import {useActionState} from 'react';
import {rehearseQaPartnerHandoff} from './qa-partner-handoff';
export default function QaPartnerHandoff(){
 const [state,action,pending]=useActionState(rehearseQaPartnerHandoff,{ok:false,message:''});
 return <div style={{border:'1px solid #4448',borderRadius:12,padding:20,marginTop:14}}>
  <strong>QA-only partner handoff rehearsal</strong>
  <p style={{fontSize:13,opacity:.8,margin:'9px 0'}}>Checks the simulated partner evidence and submitted Northfield document metadata. No real partner review or email is issued.</p>
  <form action={action}>
   <input type="hidden" name="partner_id" value="4f6bdcc5-1ea0-4dce-aa39-2fbef0cd17fa"/>
   <input type="hidden" name="prospect_id" value="dcaad06e-853d-466a-af5a-08b7ae7cc24d"/>
   <button disabled={pending} type="submit" style={{background:'#f5f5f5',color:'#111',borderRadius:8,padding:'12px 18px',fontWeight:650}}>
    {pending?'Checking handoff…':'Rehearse QA handoff →'}
   </button>
   {state.message?<p role={state.ok?'status':'alert'} style={{marginTop:12,fontSize:13,color:state.ok?'#8ed9ad':'#f39b9b'}}>{state.message}</p>:null}
  </form>
 </div>;
}
