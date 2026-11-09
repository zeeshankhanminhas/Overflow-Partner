import {createClient} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
import {signOut} from '@/app/login/actions';
import css from './portal.module.css';

export const dynamic='force-dynamic';

export default async function PortalEntry(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login?next=%2Fportal%2Fclient');
 const {data,error}=await supabase.rpc('portal_my_workspaces');
 if(error)throw new Error('Account access could not be verified.');
 const kinds=new Set((data||[]).map((item:{portal_kind:string})=>item.portal_kind));
 // A signed-in external identity belongs to exactly one kind of workspace.
 // Memberships for multiple companies within that kind remain allowed.
 if(kinds.size===1&&kinds.has('client'))redirect('/portal/client');
 if(kinds.size===1&&kinds.has('partner'))redirect('/portal/partner');
 return <div className={css.empty} role="alert">
  This account has no single authorised external workspace. Contact Overflow Partner to correct your access.
  <form action={signOut} className={css.actions}>
   <button type="submit" className={css.secondaryAction}>Sign out</button>
  </form>
 </div>;
}
