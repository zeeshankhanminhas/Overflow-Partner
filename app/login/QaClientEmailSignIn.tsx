'use client';

import {useState,type FormEvent} from 'react';
import {createClient} from '@/lib/supabase/client';
import styles from './login.module.css';

const QA_ORIGIN='https://overflow-partner-git-qa-recov-21e6a9-zeeshankhanminhas-projects.vercel.app';

export default function QaClientEmailSignIn(){
 const [email,setEmail]=useState('');
 const [status,setStatus]=useState('');
 const [pending,setPending]=useState(false);
 async function requestLink(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(pending)return;
  setPending(true);
  setStatus('');
  try{
   // Browser-initiated PKCE persists the verifier on this same fixed alias.
   // The callback's browser client can now exchange the emailed code.
   const {error}=await createClient().auth.signInWithOtp({
    email:email.trim().toLowerCase(),
    options:{shouldCreateUser:false,emailRedirectTo:QA_ORIGIN+'/auth/callback'},
   });
   if(error)throw error;
   setStatus('A fresh sign-in link has been requested. Open the new email link in this same browser and browser profile. Do not use an incognito window or another device to open it.');
  }catch(error){
   setStatus(error instanceof Error?error.message:'Unable to request a secure sign-in link.');
  }finally{setPending(false);}
 }
 return <form onSubmit={requestLink} className={styles.form}>
  <label className={styles.field}>Email
   <input className={styles.input} type="email" name="email" value={email}
    onChange={event=>setEmail(event.target.value)} required autoComplete="email"/>
  </label>
  <p style={{fontSize:12,lineHeight:1.6,margin:0,color:'#aab4bc'}}>
   Important: request the link and open the email in the same browser profile and device. PKCE sign-in cannot be completed in a different browser or incognito session.
  </p>
  <button className={styles.button} type="submit" disabled={pending}>
   {pending?'Requesting secure link…':'Email sign-in link'}
  </button>
  {status?<p role="status" style={{fontSize:13,lineHeight:1.6,margin:0}}>{status}</p>:null}
 </form>;
}
