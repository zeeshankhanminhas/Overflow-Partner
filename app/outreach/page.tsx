import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { addOutreachThreadAction } from './actions';
import LinkedInProspectList, { type LinkedInWorkItem } from '@/components/workspace/LinkedInProspectList';
import styles from '@/app/workspace/acquisition/LinkedInFlow.module.css';

function dateLabel(value:string|null) {
 const date=new Date(value||'');
 return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-GB',{
  dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London',
 }).format(date):'';
}

export default async function OutreachPage({
 searchParams,
}:{searchParams?:Promise<{error?:string,add?:string}>}) {
 const query=searchParams?await searchParams:{};
 const {supabase,organisationId,profile}=await requireUserContext();
 const {data,error}=await supabase.from('linkedin_outreach_threads')
   .select('id,company_name,contact_name,state,next_follow_up_at,created_at,crm_prospect_id')
   .eq('organisation_id',organisationId).order('created_at',{ascending:false}).limit(500);
 if(error)throw new Error('Outreach inbox is not available. Its database migration has not been applied.');
 const now=Date.now();
 let due=0;
 const items:LinkedInWorkItem[]=(data||[]).map(t=>{
   let action='Contact on LinkedIn',priority=3,detail='',archived=false;
   const overdue=t.next_follow_up_at&&new Date(t.next_follow_up_at).getTime()<=now;
   if(t.state==='interested'){action='Interested · Convert to CRM';priority=0;}
   else if(t.state==='followup'&&overdue){action='Follow up now';detail=dateLabel(t.next_follow_up_at);priority=1;due++;}
   else if(t.state==='waiting'){action='Waiting for reply';priority=4;}
   else if(t.state==='followup'){action='Follow up later';detail=dateLabel(t.next_follow_up_at);priority=5;}
   else if(t.state==='converted'){action='In CRM';priority=6;archived=true;}
   else if(t.state==='closed'){action='Closed';priority=7;archived=true;}
   return {id:t.id,company:t.company_name,contact:t.contact_name,action,detail,priority,archived};
 });
 const canWrite=['owner','admin','business_development','operator'].includes(String(profile.role));
 return <section className={styles.flow}>
   <header className={styles.top}>
    <div>
     <p className={styles.eyebrow}>BEFORE CRM / LINKEDIN</p>
     <h1>Outreach</h1>
     <p className={styles.muted}>Keep cold conversations here. Only confirmed interest becomes a Prospect, Company and Contact in OPOS.</p>
    </div>
    {canWrite?<Link className="button" href="/outreach?add=1#add-prospect">+ Add conversation</Link>:null}
   </header>
   {query.error?<p role="alert" className={styles.actionHint}>{query.error}</p>:null}
   {due>0?<p className={styles.actionHint}>{due} follow-up{due===1?'':'s'} due.</p>:null}
   <LinkedInProspectList items={items}/>
   {canWrite?<details id="add-prospect" open={query.add==='1'||Boolean(query.error)} className={styles.newProspect}>
    <summary>Start a new LinkedIn conversation</summary>
    <form action={addOutreachThreadAction} className={styles.quickForm}>
     <label>Company <input name="company_name" minLength={2} maxLength={180} required placeholder="Company name"/></label>
     <label>Person <input name="contact_name" minLength={2} maxLength={180} required placeholder="Contact name"/></label>
     <label>LinkedIn profile <input name="linkedin_url" type="url" placeholder="https://www.linkedin.com/in/..."/></label>
     <label>Job title <input name="job_title" maxLength={180}/></label>
     <p>Saved in Outreach only. No Prospect, Company, Contact, enquiry or email is created in CRM.</p>
     <button type="submit" className="button">Save conversation →</button>
    </form>
   </details>:null}
   {(data||[]).length===500?<p className={styles.small}>Showing the 500 most recent outreach conversations.</p>:null}
 </section>;
}
