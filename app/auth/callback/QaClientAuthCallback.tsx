'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';

export default function QaClientAuthCallback(){
 const [state,setState]=useState<{status:'working'|'error';message:string}>({
  status:'working',message:'Validating your secure Northfield QA client sign-in…'
 });
 useEffect(()=>{
  let cancelled=false;
  async function finish(){
   try{
    const supabase=createClient();
    const url=new URL(window.location.href);
    const code=url.searchParams.get('code');
    const tokenHash=url.searchParams.get('token_hash');
    const type=url.searchParams.get('type');
    const fragment=new URLSearchParams(window.location.hash.replace(/^#/,''));
    const accessToken=fragment.get('access_token');
    const refreshToken=fragment.get('refresh_token');
    if(code){
     const {error}=await supabase.auth.exchangeCodeForSession(code);
     if(error)throw error;
    }else if(tokenHash&&type&&['invite','email','magiclink','signup'].includes(type)){
     const {error}=await supabase.auth.verifyOtp({
      token_hash:tokenHash,
      type:type as 'invite'|'email'|'magiclink'|'signup',
     });
     if(error)throw error;
    }else if(accessToken&&refreshToken){
     const {error}=await supabase.auth.setSession({
      access_token:accessToken,refresh_token:refreshToken,
     });
     if(error)throw error;
    }else{
     const {data:{user},error}=await supabase.auth.getUser();
     if(error||!user)throw new Error('No usable sign-in token was received. Please request a fresh secure email link.');
    }
    // Auth alone is not authorisation; verify exact active client membership.
    const {data:accounts,error:membershipError}=await supabase.rpc('portal_my_workspaces');
    if(membershipError||!(accounts||[]).some((x:{portal_kind:string})=>x.portal_kind==='client')){
     await supabase.auth.signOut();
     throw new Error('This account is not authorised for the Client Workspace. Ask the OP QA owner to assign the correct client test account.');
    }
    if(!cancelled)window.location.replace('/portal/client');
   }catch(error){
    if(cancelled)return;
    setState({status:'error',message:error instanceof Error?error.message:
     'The secure client sign-in could not be completed.'});
   }
  }
  void finish();
  return ()=>{cancelled=true;};
 },[]);
 return <main style={{minHeight:'100dvh',background:'#0d1011',color:'#f4f4f5',padding:'11vh 24px'}}>
  <section style={{maxWidth:520,margin:'0 auto',border:'1px solid #343840',borderRadius:13,padding:30,display:'grid',gap:14}}>
   <span style={{fontSize:11,letterSpacing:'.13em',color:'#a7b0b7'}}>OVERFLOW PARTNER / CLIENT ACCESS · ISOLATED QA</span>
   <h1 style={{fontSize:26,margin:0,lineHeight:1.2}}>Secure Client Workspace</h1>
   <p role={state.status==='error'?'alert':'status'} style={{fontSize:14,lineHeight:1.6,margin:0}}>{state.message}</p>
   {state.status==='error'?<Link href="/login?next=%2Fportal%2Fclient" style={{color:'#d6e6ea'}}>Return to secure client sign-in →</Link>:null}
  </section>
 </main>;
}
