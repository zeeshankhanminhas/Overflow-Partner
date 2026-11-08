'use client';
import {useState} from 'react';
export default function ConfirmEnquiryButton({token}:{token:string}){
 const[status,setStatus]=useState<'idle'|'pending'|'success'|'error'>('idle');
 const[message,setMessage]=useState('');
 async function confirm(){
  if(status==='pending'||status==='success')return;
  setStatus('pending');setMessage('');
  try{
   const response=await fetch('/api/intake/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
   const data=await response.json() as {success?:boolean;message?:string;invitationEmailStatus?:string};
   if(!response.ok||!data.success)throw new Error(data.message||'Confirmation could not be completed.');
   setStatus('success');setMessage(data.invitationEmailStatus==='failed'?'Your address is confirmed. Our team will contact you about the next steps.':'Your email is confirmed. Please check your inbox for the next step.');
  }catch(error){setStatus('error');setMessage(error instanceof Error?error.message:'Please try again.')}
 }
 return <div className="mt-8"><button type="button" onClick={confirm} disabled={status==='pending'||status==='success'} className="op-cta disabled:cursor-not-allowed disabled:opacity-60">{status==='pending'?'Confirming…':status==='success'?'Email confirmed':'Confirm my email →'}</button>{message?<p role={status==='error'?'alert':'status'} className="mt-6 max-w-lg text-base leading-7">{message}</p>:null}</div>
}