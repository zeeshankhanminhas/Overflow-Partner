import {notFound,redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

export type PortalKind='client'|'partner';
export type PaidPortalProject={
  portal_kind:PortalKind;organisation_id:string;account_id:string;account_name:string;
  project_id:string;project_number:string;project_title:string;project_stage:string;
  project_status:string;due_date:string|null;reference:string|null;amount:number|null;
  currency:string|null;work_order_accepted:boolean;partner_execution_state:string|null;
  progress_state:string|null;
};

/** Signed-in, explicitly provisioned, role-scoped, PAID-only project list.
 * Data is returned by a purpose-limited SECURITY DEFINER RPC with exact
 * authenticated uid, client company/partner assignment and payment evidence.
 * Never query internal project tables from the external user's Supabase session.
 */
export async function paidPortalProjects(kind:PortalKind){
 // Fail closed until the paid-only database migration and protected QA pass.
 if(process.env.OP_PAID_EXTERNAL_PORTALS_ENABLED!=='true')notFound();
 const supabase=await createClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)redirect('/login');
 const {data:memberships,error:membershipError}=await supabase.rpc('portal_my_workspaces');
 if(membershipError)notFound(); // No function/grants? Fail closed.
 const eligible=Array.isArray(memberships)&&memberships.some((item:any)=>item.portal_kind===kind);
 if(!eligible)notFound(); // Never bounce to a privileged Controller page.
 const {data,error}=await supabase.rpc('portal_my_projects',{p_kind:kind});
 if(error)notFound();
 const rows=(data||[]) as PaidPortalProject[];
 if(!rows.length)notFound(); // No paid project = no dashboard; secure links only.
 return rows.filter(r=>r.portal_kind===kind);
}
