'use client';

import {FormEvent,useEffect,useRef,useState} from 'react';
import Script from 'next/script';
import {submitNativeIntake} from '@/components/formSubmission';
import {services} from '@/lib/marketing';

const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
const fieldClass='field_input w-full border-0 border-b border-white/40 bg-transparent px-0 py-3 text-white outline-none transition placeholder:text-white/55 focus:!border-[#ff9c65] disabled:opacity-60';
const labelClass='field_group grid gap-2 text-xs font-medium uppercase text-white';
export default function EnquiryForm(){
 const[submitted,setSubmitted]=useState(false);const[isSubmitting,setSubmitting]=useState(false);
 const[error,setError]=useState('');const statusRef=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if((submitted||error)&&statusRef.current)statusRef.current.focus()},[submitted,error]);
 async function handleSubmit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setSubmitted(false);setError('');
  if(!siteKey){setError('Online enquiries are temporarily unavailable. Please try again later.');return;}
  const form=event.currentTarget;const formData=new FormData(form);
  const captcha=String(formData.get('cf-turnstile-response')||'');
  if(!captcha){setError('Please complete the security check before submitting.');return;}
  setSubmitting(true);
  try{
   const payload:Record<string,string>={};
   formData.forEach((value,key)=>{if(typeof value==='string')payload[key]=value});
   await submitNativeIntake({
    ...payload,
    turnstile_token:captcha,
    lead_id:`overflow-partner-${Date.now()}`,
    source:'Website',
    pageUrl:window.location.href,
    nurture_consent:formData.get('nurture_consent')==='on'?'true':'false',
   });
   setSubmitted(true);form.reset();
  }catch(exception){
   setError(exception instanceof Error?exception.message:'Please try again shortly.');
  }finally{
   setSubmitting(false);
   // A verification challenge should not be reused across attempts.
   const widget=window as Window & {turnstile?:{reset:()=>void}};
   widget.turnstile?.reset();
  }
 }
 return <form className="form_enquiry grid gap-8" onSubmit={handleSubmit}>
  <p className="max-w-xl text-sm leading-6 text-white/85">A brief description is enough to begin. We’ll email a confirmation link to verify your work address before sending the secure technical details form.</p>
  <div className="grid gap-8 md:grid-cols-2">
   <label className={labelClass}>Full name<input className={fieldClass} name="full_name" autoComplete="name" minLength={2} maxLength={160} required disabled={isSubmitting}/></label>
   <label className={labelClass}>Work email<input className={fieldClass} name="work_email" type="email" autoComplete="email" maxLength={254} required disabled={isSubmitting}/></label>
  </div>
  <div className="grid gap-8 md:grid-cols-2">
   <label className={labelClass}>Company<input className={fieldClass} name="company" autoComplete="organization" minLength={2} maxLength={180} required disabled={isSubmitting}/></label>
   <label className={labelClass}>Engineering service<select className={fieldClass} name="project_type" required defaultValue="" disabled={isSubmitting}><option value="" disabled>Choose a service</option>{services.map(s=><option key={s.slug} value={s.title}>{s.title}</option>)}<option value="Other engineering requirement">Other engineering requirement</option></select></label>
  </div>
  <label className={labelClass}>What would you like help with?<textarea className={`${fieldClass} min-h-28 resize-y`} name="brief_requirement" minLength={10} maxLength={4000} placeholder="Describe the work, drawings or deliverables you have in mind." required disabled={isSubmitting}/></label>
  <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true"><label>Website address<input name="company_website" tabIndex={-1} autoComplete="off"/></label></div>
  <label className="flex max-w-xl items-start gap-3 text-sm leading-6 text-white/85"><input type="checkbox" name="nurture_consent" className="mt-1 h-[18px] w-[18px] shrink-0" disabled={isSubmitting}/><span>Yes, I’d like occasional emails about Overflow Partner’s engineering services (up to five). I can unsubscribe at any time. This is optional.</span></label>
  <div className="grid gap-3">
   <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Security verification</p>
   {siteKey?<><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive"/><div className="cf-turnstile min-h-16" data-sitekey={siteKey} data-theme="dark" data-appearance="always" data-response-field="true"/></>:<p className="text-sm text-white">Online enquiries are temporarily unavailable.</p>}
  </div>
  <div className="grid gap-4 border-t border-white/30 pt-7 md:grid-cols-[auto_1fr] md:items-center"><button className="op-cta disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={isSubmitting||!siteKey}>{isSubmitting?'Sending…':'Send enquiry →'}</button><p className="text-sm leading-6 text-white/80">You’ll receive one email to confirm your address. No marketing emails unless you opt in.</p></div>
  {submitted?<p ref={statusRef} tabIndex={-1} role="status" className="rounded-sm border border-white/60 bg-white p-4 text-sm text-[#101311]">Thanks. Please check your work inbox for the email confirmation link. We’ll share the next step once you confirm.</p>:null}
  {error?<p ref={statusRef} tabIndex={-1} role="alert" className="rounded-sm border border-[#ff9c65] p-4 text-sm text-white">{error}</p>:null}
 </form>;
}
