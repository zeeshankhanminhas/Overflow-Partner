import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { isLinkedInFollowUpDue, linkedInFunnelStage, type LinkedInProspect } from '@/lib/acquisition/linkedinFunnel';
import { quickAddLinkedInProspectAction } from '../linkedin-actions';
import LinkedInProspectList, { type LinkedInWorkItem } from '@/components/workspace/LinkedInProspectList';
import styles from '../LinkedInFlow.module.css';

function dateLabel(value:string|null|undefined) {
  if(!value)return '';
  const date=new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(date)
    : '';
}

export default async function LinkedInAcquisitionFunnelPage({
  searchParams,
}:{searchParams?:Promise<{error?:string,add?:string}>}) {
  const query=searchParams?await searchParams:{};
  const {supabase,organisationId,profile}=await requireUserContext();
  const {data,error}=await supabase.from('prospects')
    .select('id,company_name,contact_name,status,source,outreach_status,response_outcome,next_follow_up_at,converted_lead_id')
    .eq('organisation_id',organisationId).eq('source','linkedin')
    .order('created_at',{ascending:false}).limit(500);
  if(error)throw new Error(error.message);
  const prospects=(data??[]) as LinkedInProspect[];
  const ids=prospects.map(item=>item.id);
  const {data:sessions,error:sessionsError}=ids.length
    ? await supabase.from('intake_sessions').select('prospect_id')
      .eq('organisation_id',organisationId).in('prospect_id',ids)
    : {data:[] as {prospect_id:string}[],error:null};
  if(sessionsError)throw new Error(sessionsError.message);
  const withIntake=new Set((sessions??[]).map(item=>String(item.prospect_id)));
  let dueCount=0;
  const items:LinkedInWorkItem[]=prospects.map(item=>{
    const stage=linkedInFunnelStage(item,withIntake.has(item.id));
    const due=isLinkedInFollowUpDue(item,stage);
    if(due)dueCount++;
    const archived=stage==='closed'||stage==='handoff';
    let action='Waiting for reply';
    let detail='';
    let priority=4;
    if(stage==='interested'){action='Ready for requirements';priority=0;}
    else if(due){action='Follow up now';priority=1;detail=dateLabel(item.next_follow_up_at);}
    else if(stage==='conversation'){action='Review conversation';priority=2;}
    else if(stage==='identified'){action='Send first message';priority=3;}
    else if(stage==='nurture'){action='Follow up later';priority=5;}
    else if(stage==='handoff'){action='Handed over';priority=6;}
    else if(stage==='closed'){action='Closed';priority=7;}
    if(!detail&&item.next_follow_up_at&&!archived&&!due)detail='Follow up '+dateLabel(item.next_follow_up_at);
    return {id:item.id,company:item.company_name,contact:item.contact_name||'',action,detail,archived,priority};
  });
  const canAdd=['owner','admin','business_development','operator'].includes(String(profile.role));

  return <section className={`saas-page acquisition-workspace ${styles.flow}`}>
    <header className={styles.top}>
      <div>
        <p className="vp-kicker">OPOS / LinkedIn</p>
        <h1>Prospects</h1>
        <p className={styles.muted}>Find a person, continue the conversation, record what happens next.</p>
      </div>
      {canAdd?<Link className="button" href="/workspace/acquisition/funnel?add=1#add-prospect">+ Add prospect</Link>:null}
    </header>
    {query.error?<div className="vp-callout" role="alert"><strong>Prospect not added</strong><p>{query.error}</p></div>:null}
    {dueCount>0?<p className={styles.actionHint}>{dueCount} follow-up{dueCount===1?'':'s'} need your attention.</p>:null}
    <LinkedInProspectList items={items}/>
    {canAdd?<details id="add-prospect" className={styles.newProspect} open={query.add==='1'||Boolean(query.error)}>
      <summary>Add someone new</summary>
      <form action={quickAddLinkedInProspectAction} className={styles.quickForm}>
        <label>Company<input name="company_name" minLength={2} maxLength={180} required placeholder="Company name"/></label>
        <label>Person<input name="contact_name" minLength={2} maxLength={180} required placeholder="Contact name"/></label>
        <label>LinkedIn profile (optional)<input name="linkedin_url" type="url" placeholder="https://www.linkedin.com/in/…"/></label>
        <label>Job title (optional)<input name="job_title" maxLength={180}/></label>
        <p>OPOS creates or reuses the company and contact automatically. It never sends a message on your behalf.</p>
        <button className="button" type="submit">Save prospect →</button>
      </form>
    </details>:null}
    {prospects.length===500?<p className={styles.small}>Showing up to 500 recent records. The full Prospect register retains older records.</p>:null}
  </section>;
}
