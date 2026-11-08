'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Analytics} from '@vercel/analytics/next';
import {SpeedInsights} from '@vercel/speed-insights/next';
const KEY='overflow_partner_cookie_consent';
type Choice='accepted'|'rejected'|null;
export default function CookieConsent(){
 const [choice,setChoice]=useState<Choice>(null);
 const [ready,setReady]=useState(false);
 const [showPreferences,setShowPreferences]=useState(false);
 useEffect(()=>{
  try{const stored=window.localStorage.getItem(KEY);if(stored==='accepted'||stored==='rejected')setChoice(stored);}
  catch{ /* When storage is blocked, remain opted out. */ }
  setReady(true);
  const reopen=()=>setShowPreferences(true);
  window.addEventListener('overflow:cookie-preferences',reopen);
  return ()=>window.removeEventListener('overflow:cookie-preferences',reopen);
 },[]);
 function choose(value:'accepted'|'rejected'){
  try{window.localStorage.setItem(KEY,value)}catch{/* Keep this session preference without persistence. */}
  setChoice(value);setShowPreferences(false);
 }
 return <>
  {ready&&choice==='accepted'?<><Analytics/><SpeedInsights/></>:null}
  {ready&&(!choice||showPreferences)?<section role="region" aria-label="Analytics preferences" className="cookie_banner fixed bottom-0 left-0 right-0 z-[100] max-h-[80vh] overflow-y-auto border-t border-black/30 bg-white p-5 text-[#101311] shadow-[0_-12px_55px_rgba(0,0,0,.2)] sm:p-7">
    <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-[1fr_auto] md:items-center">
      <div><h2 className="text-lg font-semibold">Your analytics preference</h2><p className="mt-2 max-w-3xl text-sm leading-6">Essential site functions operate without analytics. Optional Vercel Analytics and Speed Insights are loaded only when you choose to accept. See our <Link className="underline" href="/privacy">privacy policy</Link> and <Link className="underline" href="/cookie-policy">cookie policy</Link>.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={()=>choose('rejected')} className="min-h-12 border border-[#101311] px-5 py-3 text-sm font-semibold text-[#101311] hover:bg-[#f4f3ee]">Reject optional analytics</button>
        <button type="button" onClick={()=>choose('accepted')} className="min-h-12 bg-[#ef6c24] px-5 py-3 text-sm font-semibold text-white hover:bg-[#b74a0f]">Accept analytics</button>
      </div>
    </div>
   </section>:null}
 </>;
}
