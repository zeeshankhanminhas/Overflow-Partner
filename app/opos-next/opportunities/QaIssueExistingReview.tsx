'use client';
import {useActionState} from 'react';
import {issueNorthfieldQaReview} from './qa-issue-existing-review';
export default function QaIssueExistingReview(){
 const [result,action,pending]=useActionState(issueNorthfieldQaReview,{ok:false,message:''});
 return <section style={{padding:18,border:'1px solid #5556',borderRadius:12,marginTop:14}}>
  <strong>Issue Northfield Partner Technical Assessment</strong>
  <p style={{fontSize:13,opacity:.8,margin:'10px 0'}}>The draft and customer files already exist. Issue a controlled QA review link to open the actual partner-facing form. No email is sent and no legal NDA approval is asserted.</p>
  <form action={action}>
   <input type="hidden" name="request_id" value="e8d6be99-5b5a-446b-a071-cc5c05a102c7"/>
   <label style={{fontSize:13,display:'block',margin:'12px 0'}}><input required type="checkbox" name="confirm" value="yes"/> Confirm fictional QA partner review only</label>
   <button disabled={pending||result.ok} style={{padding:'12px 18px',background:'#f5f5f5',color:'#111',borderRadius:8}}>{pending?'Issuing…':'Issue secure QA assessment →'}</button>
  </form>
  {result.message?<p role={result.ok?'status':'alert'} style={{marginTop:12,fontSize:13}}>{result.message}</p>:null}
  {result.url?<p style={{marginTop:10}}><a target="_blank" rel="noreferrer" href={result.url} style={{textDecoration:'underline'}}>Open partner technical assessment ↗</a></p>:null}
 </section>;
}
