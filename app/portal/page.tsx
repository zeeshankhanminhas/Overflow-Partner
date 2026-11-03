import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
import css from './portal.module.css';
export const dynamic='force-dynamic';
export default async function PortalEntry(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login?next=%2Fportal%2Fclient');
 const {data,error}=await supabase.rpc('portal_my_workspaces');
 const roles=new Set((data||[]).map((x:{portal_kind:string})=>x.portal_kind));
 if(error)throw new Error('Account access could not be verified.');
 return <><div className={css.hero}><p className={css.eyebrow}>YOUR ACCOUNT</p>
 <h1 className={css.title}>One partner. Your work in one place.</h1>
 <p className={css.subtitle}>Choose an account workspace. Access is restricted to companies and execution partners explicitly linked to your sign-in.</p></div>
 <section className={css.grid} aria-label="Available workspaces">
 {roles.has('client')?<div className={css.summary}><p className={css.eyebrow}>FOR ENGINEERING CLIENTS</p><strong>Client Workspace</strong><p>Quotations, active engineering projects and commercial decisions.</p><div className={css.actions}><Link className={css.action} href="/portal/client">Open Client Workspace</Link></div></div>:null}
 {roles.has('partner')?<div className={css.summary}><p className={css.eyebrow}>FOR EXECUTION PARTNERS</p><strong>Partner Workspace</strong><p>Approved Work Orders, project progress and engineering submissions.</p><div className={css.actions}><Link className={css.action} href="/portal/partner">Open Partner Workspace</Link></div></div>:null}
 </section>
 {!roles.size?<div className={css.empty}>Your sign-in is valid but no external account has been granted access. Ask Overflow Partner to approve and link your company or Execution Partner account.</div>:null}
 </>;
}
