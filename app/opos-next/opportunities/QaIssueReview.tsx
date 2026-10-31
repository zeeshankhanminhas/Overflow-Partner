'use client';
import {useActionState} from 'react';
import {createNorthfieldQaPartnerReview} from './qa-create-partner-review';
export default function QaIssueReview(){
 const [state,action,pending]=useActionState(createNorthfieldQaPartnerReview,{ok:false,message:''});
 return <section style={{border:'1px solid #4446',borderRadius:12,padding:18,marginTop:16}}>
  <strong>Issue QA Partner Technical Assessment</strong>
  <p style={{fontSize:13,margin:'10px 0',opacity:.75}}>Creates a governed draft with the submitted technical requirements and source PDF. Only the isolated Northfield QA fixture is allowed; no real NDA or partner approval is asserted.</p>
  <form action={action}><input name="prospect_id" type="hidden" value="dcaad06e-853d-466a-af5a-08b7ae7cc24d"/>
   <button disabled={pending||state.ok} type="submit" style={{background:'#fafafa',color:'#111',borderRadius:8,padding:'12px 17px',fontWeight:650}}>{pending?'Creating assessment…':'Create QA technical assessment →'}</button>
  </form>
  {state.message?<p role={state.ok?'status':'alert'} style={{fontSize:13,marginTop:12,color:state.ok?'#8dd9aa':'#f19a9a'}}>{state.message}</p>:null}
  {state.url?<p style={{marginTop:12,fontSize:13}}><a href={state.url} target="_blank" rel="noreferrer" style={{textDecoration:'underline'}}>Open secure QA partner review ↗</a><span style={{display:'block',opacity:.7}}>Treat this one-time link as confidential. The assessment email has not been sent.</span></p>:null}
 </section>;
}
