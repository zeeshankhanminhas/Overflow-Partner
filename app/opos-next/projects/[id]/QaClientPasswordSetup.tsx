'use client';

import {useActionState} from 'react';
import {setNorthfieldQaClientPassword,type QaPasswordResult} from './qa-client-password-action';

const initial:QaPasswordResult={status:'idle',message:''};
export default function QaClientPasswordSetup({projectId}:{projectId:string}){
 const [state,dispatch,pending]=useActionState(setNorthfieldQaClientPassword,initial);
 return <details id="northfield-qa-password" style={{border:'1px solid #454951',borderRadius:9,padding:16,marginTop:12}}>
  <summary style={{cursor:'pointer',fontWeight:650}}>QA only: Set Northfield Client test password (no email required)</summary>
  <div style={{display:'grid',gap:12,marginTop:14,maxWidth:600}}>
   <p style={{fontSize:13,lineHeight:1.65,color:'#c0c6cb',margin:0}}>
    Use the existing confirmed Northfield test client identity, not an operator account.
    This changes only its QA authentication password, not the issued R01, its permissions or production.
    Do not use a password from your personal or work accounts.
   </p>
   <form action={dispatch} style={{display:'grid',gap:12}}>
    <input type="hidden" name="project_id" value={projectId}/>
    <label style={{display:'grid',gap:6,fontSize:13}}>Client test email
     <input readOnly value="midts.systems@gmail.com" style={{padding:10,background:'#16181b',color:'#f4f4f5',border:'1px solid #464b51',borderRadius:6}}/>
    </label>
    <label style={{display:'grid',gap:6,fontSize:13}}>Set a new QA-only password (12+ characters, letter and number)
     <input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"
      style={{padding:10,background:'#16181b',color:'#f4f4f5',border:'1px solid #464b51',borderRadius:6}}/>
    </label>
    <label style={{display:'grid',gap:6,fontSize:13}}>Confirm QA password
     <input name="password_confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password"
      style={{padding:10,background:'#16181b',color:'#f4f4f5',border:'1px solid #464b51',borderRadius:6}}/>
    </label>
    <label style={{display:'flex',gap:9,fontSize:13,lineHeight:1.5}}>
     <input name="confirm_test_password" type="checkbox" value="yes" required/>
     I authorize changing the password for this existing simulated QA Client only.
    </label>
    <button type="submit" disabled={pending} style={{background:'#dde8df',color:'#171b18',border:0,padding:'12px 16px',borderRadius:6,fontWeight:700,cursor:'pointer'}}>
     {pending?'Saving QA password…':'Save QA Client password'}
    </button>
   </form>
   {state.status!=='idle'?<p role={state.status==='error'?'alert':'status'} style={{fontSize:13,margin:0}}>{state.message}</p>:null}
   {state.status==='ready'?<a href="/login?next=%2Fportal%2Fclient" style={{color:'#d6e6ea'}}>Open Client password login →</a>:null}
  </div>
 </details>;
}
