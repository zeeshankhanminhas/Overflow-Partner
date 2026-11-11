import {requireUserContext} from '@/lib/auth/context';
import {OperatorPageIntro,OperatorRegister,type OperatorRow} from '../OperatorViews';
export default async function AccountsPage(){
 const {supabase,organisationId}=await requireUserContext();
 const {data,error}=await supabase.from('companies').select('id,name,industry,country,account_status,next_account_review_at')
   .eq('organisation_id',organisationId).order('name').limit(150);
 if(error)throw new Error('Client accounts could not be loaded.');
 const rows:OperatorRow[]=(data||[]).map(a=>({id:a.id,title:a.name,subtitle:[a.industry,a.country].filter(Boolean).join(' · ')||'Account',
   state:String(a.account_status||'Not classified').replaceAll('_',' '),
   next:a.next_account_review_at?'Next review '+new Date(a.next_account_review_at).toLocaleDateString('en-GB'):'Review not scheduled',
   href:'/opos-next/accounts/'+a.id}));
 return <section><OperatorPageIntro eyebrow="RELATIONSHIPS / CLIENT ACCOUNTS" title="Accounts" subtitle="Client relationship review and connected operating records, without leaving Workspace 2.0." count={rows.length}/>
   <OperatorRegister rows={rows} heading="Client account register" empty="No client companies are recorded."/>
 </section>;
}
