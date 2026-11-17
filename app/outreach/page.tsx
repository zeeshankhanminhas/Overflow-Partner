import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { addOutreachThreadAction } from './actions';
import LinkedInProspectList, { type LinkedInWorkItem } from '@/components/workspace/LinkedInProspectList';
import styles from '@/app/workspace/acquisition/LinkedInFlow.module.css';
import {OUTREACH_WEEKLY_TARGETS,researchGaps,isReviewedForManualContact,outreachPhase,type OutreachResearch} from '@/lib/outreach/research';

function dateLabel(value:string|null) {
 const date=new Date(value||'');
 return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-GB',{
  dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London',
 }).format(date):'';
}

export default async function OutreachPage({
 searchParams,
}:{searchParams?:Promise<{error?:string,add?:string,view?:string}>}) {
 const query=searchParams?await searchParams:{};
 const {supabase,organisationId,profile}=await requireUserContext();
 const {data,error}=await supabase.from('linkedin_outreach_threads')
   .select('id,company_name,contact_name,state,next_follow_up_at,created_at,crm_prospect_id')
   .eq('organisation_id',organisationId).order('created_at',{ascending:false}).limit(500);
 if(error)throw new Error('Outreach inbox is not available. Its database migration has not been applied.');
 const ids=(data||[]).map(t=>t.id);
 const researchResult=ids.length?await supabase.from('linkedin_outreach_research')
   .select('*').eq('organisation_id',organisationId).in('outreach_id',ids):
   {data:[] as OutreachResearch[],error:null};
 if(researchResult.error)throw new Error('Outreach research is unavailable. Its migration must be applied before use.');
 const researchMap=new Map((researchResult.data||[]).map(r=>[r.outreach_id,r as OutreachResearch]));
 const sevenDaysAgo=Date.now()-7*24*60*60*1000;
 const qualify=(t:{id:string;created_at:string})=>{
   const r=researchMap.get(t.id);
   return r&&Date.parse(t.created_at)>=sevenDaysAgo&&researchGaps(r).length===0&&
     !['rejected','blocked'].includes(r.review_status);
 };
 const qualifiedSevenDays=(data||[]).filter(t=>qualify(t)).length;
 const approvedSevenDays=(data||[]).filter(t=>qualify(t)&&isReviewedForManualContact(researchMap.get(t.id))).length;
 const evidenceGaps=(data||[]).filter(t=>!['closed','converted'].includes(t.state)&&
   !isReviewedForManualContact(researchMap.get(t.id))).length;
 const view=query.view==='approved'?'approved':query.view==='needs-evidence'?'needs-evidence':'all';
 const visibleThreads=(data||[]).filter(t=>view==='approved'?isReviewedForManualContact(researchMap.get(t.id)):
   view==='needs-evidence'?!isReviewedForManualContact(researchMap.get(t.id)):true);
 const now=Date.now();
 let due=0;
 const items:LinkedInWorkItem[]=visibleThreads.map(t=>{
   let action='Contact on LinkedIn',priority=3,detail='',archived=false;
   const overdue=t.next_follow_up_at&&new Date(t.next_follow_up_at).getTime()<=now;
   if(t.state==='interested'){action='Interested · Convert to CRM';priority=0;}
   else if(t.state==='followup'&&overdue){action='Follow up now';detail=dateLabel(t.next_follow_up_at);priority=1;due++;}
   else if(t.state==='waiting'){action='Waiting for reply';priority=4;}
   else if(t.state==='followup'){action='Follow up later';detail=dateLabel(t.next_follow_up_at);priority=5;}
   else if(t.state==='converted'){action='In CRM';priority=6;archived=true;}
   else if(t.state==='closed'){action='Closed';priority=7;archived=true;}
   const research=researchMap.get(t.id);
   return {id:t.id,company:t.company_name,contact:t.contact_name,
     action,detail:detail||outreachPhase(t.state,research),
     priority:research?.review_status==='approved'?priority:priority+1,
     archived:archived||research?.review_status==='rejected',
     researchStatus:research?.review_status||'pending'};
 });
 const canWrite=['owner','admin','business_development','operator'].includes(String(profile.role));
 return <section className={styles.flow}>
   <header className={styles.top}>
    <div>
     <p className={styles.eyebrow}>EVIDENCE-LED RESEARCH / BEFORE CRM</p>
     <h1>Outreach</h1>
     <p className={styles.muted}>Research 25–30 genuinely relevant new accounts each week. Review 15–20 for personalized manual first contact when the evidence supports it. Only confirmed interest enters OPOS CRM.</p>
    </div>
    {canWrite?<Link className="button" href="/outreach?add=1#add-prospect">+ Add conversation</Link>:null}
   </header>
   <section className={styles.metrics} aria-label="Rolling seven-day outreach scorecard">
    <div><strong>{qualifiedSevenDays} / {OUTREACH_WEEKLY_TARGETS.qualifiedResearchLow}–{OUTREACH_WEEKLY_TARGETS.qualifiedResearchHigh}</strong><span>Evidence-qualified new accounts · last 7 days</span></div>
    <div><strong>{approvedSevenDays} / {OUTREACH_WEEKLY_TARGETS.firstContactLow}–{OUTREACH_WEEKLY_TARGETS.firstContactHigh}</strong><span>Reviewed and approved for manual contact · last 7 days</span></div>
    <div><strong>{evidenceGaps}</strong><span>Unapproved or evidence-gap records (all current)</span></div>
   </section>
   <nav aria-label="Outreach research views" className={styles.filters}>
    <Link href="/outreach" className={view==='all'?styles.activeFilter:undefined}>All conversations</Link>
    <Link href="/outreach?view=approved" className={view==='approved'?styles.activeFilter:undefined}>Approved for manual contact</Link>
    <Link href="/outreach?view=needs-evidence" className={view==='needs-evidence'?styles.activeFilter:undefined}>Needs evidence or review</Link>
    <Link href="/outreach/templates">Research and call templates</Link>
   </nav>
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
