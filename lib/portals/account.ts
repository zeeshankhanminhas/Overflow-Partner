import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

export type PortalKind='client'|'partner';
export type PortalAccount={portal_kind:PortalKind;organisation_id:string;account_id:string;account_name:string};
export type PortalProject={
 portal_kind:PortalKind;organisation_id:string;account_id:string;account_name:string;
 project_id:string;project_number:string;project_title:string;project_stage:string;
 project_status:string;due_date:string|null;reference:string|null;
 amount:number|string|null;currency:string|null;work_order_accepted:boolean;
 partner_execution_state:string|null;progress_state:string|null;
};
export type PortalQuote={
 organisation_id:string;account_id:string;lead_id:string;lead_reference:string|null;
 lead_title:string;quote_id:string;quote_number:string;quote_revision:number;
 total:number|string;currency:string;client_response:string;project_id:string|null;
};

export function isPortalKind(value:string):value is PortalKind{
 return value==='client'||value==='partner';
}
export function stageLabel(stage:string,kind:PortalKind){
 const map:Record<string,string>={
  mobilisation:'Preparing delivery',ready_for_execution:'Ready to begin',
  in_progress:kind==='client'?'Engineering in progress':'Work in progress',
  partner_correction:'Technical corrections',internal_review:'Internal OP quality review',
  ready_for_client_issue:'Preparing client review',issued_to_client:'Client review prepared',
  client_review:'Client review',completion:'Delivery and settlement',closed:'Completed'
 };
 return map[stage]||stage.replaceAll('_',' ');
}
export function nextAction(stage:string,kind:PortalKind){
 if(kind==='partner'){
  if(stage==='mobilisation')return 'Await OP mobilisation authority';
  if(stage==='ready_for_execution')return 'Confirm commencement in Partner Work';
  if(['in_progress','partner_correction'].includes(stage))return 'Report progress or submit engineering work';
  if(stage==='internal_review')return 'Await OP technical review';
  if(stage==='client_review')return 'Await controlled client decision';
  return 'Review your current Work Order and status';
 }
 if(stage==='in_progress')return 'Engineering underway · awaiting technical submission';
 if(stage==='internal_review')return 'OP internal quality review in progress';
 if(['ready_for_client_issue','issued_to_client','client_review'].includes(stage))return 'Client review is the next controlled decision';
 if(stage==='completion')return 'Final payment and handover controls';
 if(stage==='closed')return 'Project record complete';
 return 'OP is preparing your engineering delivery';
}
export function formatAmount(amount:number|string|null,currency:string|null){
 if(amount==null)return 'Not issued';
 const n=Number(amount);
 if(!Number.isFinite(n))return 'Not available';
 try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'GBP'}).format(n);}
 catch{return n.toFixed(2)+' '+String(currency||'GBP');}
}

/** External account session, independent of the internal OP employee profile.
 * A valid Supabase Auth session is not an entitlement: the DB function only
 * returns explicit active memberships that match auth.uid(). No service key.
 */
export async function portalContext(kind:PortalKind){
 const supabase=await createClient();
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)redirect('/login?next='+encodeURIComponent('/portal/'+kind));
 const [access,projects,quotes]=await Promise.all([
  supabase.rpc('portal_my_workspaces'),
  supabase.rpc('portal_my_projects',{p_kind:kind}),
  kind==='client'?supabase.rpc('portal_my_quotations'):Promise.resolve({data:[],error:null})
 ]);
 if(access.error||projects.error||quotes.error)
  throw new Error('The external workspace is temporarily unavailable. Please contact Overflow Partner.');
 const accounts=(access.data||[]) as PortalAccount[];
 return {supabase,user,accounts,
  permitted:accounts.some(a=>a.portal_kind===kind),
  projects:(projects.data||[]) as PortalProject[],
  quotes:(quotes.data||[]) as PortalQuote[]};
}
