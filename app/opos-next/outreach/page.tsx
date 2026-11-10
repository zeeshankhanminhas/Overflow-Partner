import {requireUserContext} from '@/lib/auth/context';
import {isKnownIsolatedQaFixtureBackend} from '@/lib/qa/isolation';
import {addOutreachThreadAction} from '@/app/outreach/actions';
import {OperatorPageIntro,OperatorRegister,type OperatorRow} from '../OperatorViews';
import css from './outreach.module.css';

export default async function OutreachPage({searchParams}:{searchParams?:Promise<{error?:string;add?:string}>}){
 const query=searchParams?await searchParams:{};
 const {supabase,organisationId,profile}=await requireUserContext();
 const {data,error}=await supabase.from('linkedin_outreach_threads')
   .select('id,company_name,contact_name,state,next_follow_up_at,created_at')
   .eq('organisation_id',organisationId).order('created_at',{ascending:false}).limit(200);
 if(error)throw new Error('LinkedIn conversations could not be loaded.');
 const canWrite=isKnownIsolatedQaFixtureBackend()&&['owner','admin','business_development','operator'].includes(String(profile.role));
 const now=Date.now();
 const rows:OperatorRow[]=(data||[]).map(item=>({id:item.id,title:item.company_name,
   subtitle:item.contact_name,state:String(item.state||'identified').replaceAll('_',' '),
   next:item.state==='interested'?'Interest confirmed · Convert to CRM':item.state==='converted'?'Handed over to CRM':
     item.state==='waiting'?'Awaiting LinkedIn reply':item.state==='followup'&&item.next_follow_up_at&&new Date(item.next_follow_up_at).getTime()<=now?'Follow-up due now':
     item.next_follow_up_at?'Follow up '+new Date(item.next_follow_up_at).toLocaleDateString('en-GB'):'Review conversation',
   href:'/opos-next/outreach/'+item.id}));
 const due=(data||[]).filter(t=>t.state==='followup'&&t.next_follow_up_at&&new Date(t.next_follow_up_at).getTime()<=now).length;
 return <section>
   <OperatorPageIntro eyebrow="BEFORE CRM / LINKEDIN" title="Outreach" subtitle="Qualify personal LinkedIn conversations here. Only confirmed interest is eligible for a governed CRM handoff." count={rows.length}/>
   {query.error?<p className={css.notice+' '+css.error} role="alert">{String(query.error).slice(0,400)}</p>:null}
   {due>0?<p className={css.notice} role="status">{due} conversation{due===1?'':'s'} due for follow-up.</p>:null}
   <div className={css.layout}>
     <details className={css.panel} id="add-conversation" open={query.add==='1'||Boolean(query.error)}>
       <summary style={{cursor:'pointer',fontWeight:650,fontSize:15}}>+ Add a LinkedIn conversation</summary>
       <p>Creates an Outreach thread only. No CRM opportunity or email is created.</p>
       {canWrite?<form action={addOutreachThreadAction} className={css.form}>
         <input type="hidden" name="opos_next" value="1"/>
         <div className={css.grid}>
           <label>Company<input name="company_name" required minLength={2} maxLength={180} placeholder="Engineering company"/></label>
           <label>Contact<input name="contact_name" required minLength={2} maxLength={180} placeholder="Decision-maker"/></label>
           <label>Job title<input name="job_title" maxLength={180} placeholder="Engineering Manager"/></label>
           <label>LinkedIn profile (optional)<input name="linkedin_url" type="url" placeholder="https://www.linkedin.com/in/..."/></label>
         </div>
         <button type="submit">Save conversation →</button>
       </form>:<p className={css.notice}>Adding conversations is locked until the isolated QA fixture gate and your operator permissions are enabled. Existing records remain readable.</p>}
     </details>
     <div><OperatorRegister rows={rows} heading="LinkedIn conversations" empty="No LinkedIn conversations are recorded. Add a fictional QA conversation when writes are enabled."/></div>
   </div>
   {rows.length===200?<p style={{marginTop:16,fontSize:12,opacity:.75}}>Showing the 200 most recent conversations.</p>:null}
 </section>;
}
