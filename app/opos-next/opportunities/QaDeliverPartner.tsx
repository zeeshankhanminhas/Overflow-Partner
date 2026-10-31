'use client';
import {useActionState} from 'react';
import {deliverNorthfieldPartnerInvitation} from './qa-deliver-partner';
export default function QaDeliverPartner(){
 const [result,action,pending]=useActionState(deliverNorthfieldPartnerInvitation,{ok:false,message:''});
 return <section style={{border:'1px solid #5557',borderRadius:12,padding:18}}>
  <strong>Send controlled QA partner invitation</strong>
  <p style={{fontSize:13,opacity:.8,margin:'12px 0'}}>Issue the existing Northfield assessment through the QA Resend sandbox. Recipient is the verified test inbox; no real supplier is contacted.</p>
  <form action={action}><input type="hidden" name="request_id" value="e8d6be99-5b5a-446b-a071-cc5c05a102c7"/>
   <label style={{fontSize:13,display:'block',marginBottom:12}}><input name="confirm" type="checkbox" value="yes" required/> This is fictional QA email only</label>
   <button type="submit" disabled={pending||result.ok} style={{padding:'11px 18px',borderRadius:8,background:'#fafafa',color:'#111'}}>{pending?'Sending…':'Send QA partner invitation →'}</button></form>
  {result.message?<p role={result.ok?'status':'alert'} style={{marginTop:12,fontSize:13}}>{result.message}</p>:null}
 </section>;
}
