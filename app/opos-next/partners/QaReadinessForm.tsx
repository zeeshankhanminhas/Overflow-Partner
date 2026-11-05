'use client';
import {useActionState} from 'react';
import {approveQaPartnerReadinessAction} from './qa-actions';
export default function QaReadinessForm({partnerId}:{partnerId:string}){
  const [result,action,pending]=useActionState(approveQaPartnerReadinessAction,{ok:false,message:''});
  return <section style={{border:'1px solid #4446',borderRadius:12,padding:22,marginTop:28}}>
    <h2 style={{fontSize:20}}>QA-only simulated approval</h2>
    <p style={{fontSize:13,margin:'12px 0',opacity:.8}}>Simulation only: no real NDA, approval, or partner eligibility is granted.</p>
    <form action={action} style={{display:'grid',gap:14}}>
      <input type="hidden" name="partner_id" value={partnerId}/>
      <label style={{fontSize:13}}>Approval test rationale
        <textarea name="rationale" required minLength={15} maxLength={1000}
          placeholder="Explain the simulated QA checks" style={{display:'block',width:'100%',minHeight:82,padding:12,marginTop:8,color:'#111',background:'#fff',borderRadius:8}}/>
      </label>
      <label style={{display:'flex',gap:10,fontSize:13}}>
        <input type="checkbox" name="simulation_ack" value="yes" required/>
        I confirm this is synthetic QA evidence, not a legally executed NDA.
      </label>
      <button type="submit" disabled={pending} style={{background:'#f6f6f6',color:'#111',borderRadius:8,padding:'13px 18px',fontWeight:600}}>
        {pending?'Recording QA evidence…':'Record simulated QA approval →'}
      </button>
      {result.message?<p role={result.ok?'status':'alert'} style={{fontSize:13,color:result.ok?'#86d4a5':'#f18c8c'}}>{result.message}</p>:null}
    </form>
  </section>;
}
