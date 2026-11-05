'use client';

import {useActionState,useState} from 'react';
import {
 createNorthfieldManualQaClientLink,type ManualQaLinkResult
} from './qa-manual-client-link-action';

const initial:ManualQaLinkResult={status:'idle',message:'',link:null};
export default function QaManualClientAccess({projectId}:{projectId:string}){
 const [state,dispatch,pending]=useActionState(createNorthfieldManualQaClientLink,initial);
 const [copyMessage,setCopyMessage]=useState('');
 const copy=async()=>{
  if(!state.link)return;
  try{await navigator.clipboard.writeText(state.link);setCopyMessage('Copied. Paste it into a separate incognito/private browser window.');}
  catch{setCopyMessage('Copy the displayed link manually into a separate private browser.');}
 };
 return <section aria-label="Manual QA client activation without email delivery"
   style={{display:'grid',gap:13,padding:20,border:'1px solid #786c56',
    borderRadius:9,background:'#242119',maxWidth:700}}>
   <strong>Generate a secure QA Client sign-in link — no Resend required</strong>
   <p style={{fontSize:13,lineHeight:1.7,margin:0,color:'#d1c8b5'}}>
    This is for a <strong>simulated Client QA identity</strong>, separate from the OP operator login.
    Supabase creates a one-use authentication link without delivering email.
    It does <strong>not verify ownership of the email address</strong> and must not be used to onboard real customers.
   </p>
   <form action={dispatch} style={{display:'grid',gap:12}}>
    <input type="hidden" name="project_id" value={projectId}/>
    <label style={{display:'grid',gap:6,fontSize:13,fontWeight:600}}>
     Separate test Client email identifier
     <input name="email" type="email" autoComplete="off" required
       placeholder="separate-qa-client@example.com"
       style={{padding:12,border:'1px solid #6c655b',borderRadius:7,
        background:'#151618',color:'#f7f7f7',width:'100%'}}/>
    </label>
    <label style={{display:'grid',gridTemplateColumns:'18px minmax(0,1fr)',
      alignItems:'start',gap:11,fontSize:13,lineHeight:1.6}}>
     <input type="checkbox" name="qa_manual_ack" value="yes" required
       style={{width:18,height:18,margin:'3px 0 0',padding:0}}/>
     <span>I authorise an isolated QA test persona. The link is equivalent to a temporary password;
       I'll open it only in a separate private browser, and I understand email delivery remains untested.</span>
    </label>
    <button disabled={pending} type="submit" style={{justifySelf:'start',
      background:'#dde8df',color:'#171b18',border:0,borderRadius:7,
      cursor:pending?'progress':'pointer',fontWeight:700,padding:'11px 17px'}}>
     {pending?'Generating QA link…':'Generate single-use QA Client link →'}
    </button>
   </form>
   {state.status==='error'?<p role="alert" style={{color:'#ffd0ce',fontSize:13,
    border:'1px solid #985f59',borderRadius:7,padding:12,margin:0}}>{state.message}</p>:null}
   {state.status==='ready'&&state.link?<div role="status" style={{display:'grid',gap:12,
    border:'1px solid #66886e',borderRadius:8,padding:14,background:'#14251b'}}>
    <strong>QA Client link generated — no email sent</strong>
    <p style={{fontSize:13,lineHeight:1.6,margin:0}}>{state.message}</p>
    <label style={{display:'grid',gap:6,fontSize:12}}>Single-use test access link (keep private)
     <textarea readOnly value={state.link} rows={3}
       onFocus={event=>event.currentTarget.select()}
       style={{width:'100%',resize:'none',background:'#101816',color:'#cde9d5',
        border:'1px solid #57765d',borderRadius:7,padding:10,fontSize:12}}/>
    </label>
    <button type="button" onClick={copy} style={{justifySelf:'start',
      background:'#dde8df',color:'#171b18',padding:'10px 15px',
      border:0,borderRadius:7,cursor:'pointer',fontWeight:650}}>
      Copy QA link
    </button>
    {copyMessage?<p style={{fontSize:12,margin:0}}>{copyMessage}</p>:null}
    <p style={{fontSize:12,lineHeight:1.6,margin:0,color:'#c0cfbf'}}>
      After successful private-session login, refresh Northfield Project 360 as OP.
      Only then will the separately governed R01 issue action be available.
      Do not share this test access link with a real customer.
    </p>
   </div>:null}
 </section>;
}
