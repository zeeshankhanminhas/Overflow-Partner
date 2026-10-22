import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { isLinkedInFollowUpDue, linkedInFunnelStage, type LinkedInProspect, type LinkedInFunnelStage } from '@/lib/acquisition/linkedinFunnel';
import { quickAddLinkedInProspectAction } from '../linkedin-actions';
import styles from '../LinkedInFlow.module.css';

function followUpLabel(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(date)
    : '';
}

const views = [
  {key:'work',label:'Needs attention'},
  {key:'all',label:'Active'},
  {key:'interested',label:'Interested'},
  {key:'nurture',label:'Later'},
  {key:'handoff',label:'Handed over'},
  {key:'closed',label:'Closed'},
] as const;

function stageLabel(stage: LinkedInFunnelStage) {
  const labels:Record<LinkedInFunnelStage,string>={
    identified:'Not contacted',outreach:'Waiting for reply',conversation:'In conversation',
    interested:'Interested',handoff:'Handed over',nurture:'Follow up later',closed:'Closed',
  };
  return labels[stage];
}
function priority(stage: LinkedInFunnelStage, due:boolean) {
  return stage==='interested' ? 0 : due ? 1 : stage==='conversation' ? 2
    : stage==='identified' ? 3 : stage==='outreach' ? 4 : 5;
}

export default async function LinkedInAcquisitionFunnelPage({
  searchParams,
}:{
  searchParams?:Promise<{view?:string,error?:string,add?:string}>,
}) {
  const query = searchParams ? await searchParams : {};
  const view = views.some(item=>item.key===query.view) ? query.view : 'work';
  const {supabase,organisationId,profile}=await requireUserContext();
  const {data,error}=await supabase.from('prospects')
    .select('id,company_name,contact_name,status,source,outreach_status,response_outcome,next_follow_up_at,converted_lead_id')
    .eq('organisation_id',organisationId).eq('source','linkedin')
    .order('created_at',{ascending:false}).limit(500);
  if(error)throw new Error(error.message);
  const prospects=(data??[]) as LinkedInProspect[];
  const ids=prospects.map(item=>item.id);
  const {data:sessions,error:sessionsError}=ids.length
    ? await supabase.from('intake_sessions').select('prospect_id').eq('organisation_id',organisationId).in('prospect_id',ids)
    : {data:[] as {prospect_id:string}[],error:null};
  if(sessionsError)throw new Error(sessionsError.message);
  const withIntake=new Set((sessions??[]).map(item=>String(item.prospect_id)));
  const records=prospects.map(item=>{
    const stage=linkedInFunnelStage(item,withIntake.has(item.id));
    return {...item,stage,due:isLinkedInFollowUpDue(item,stage)};
  });
  const active=records.filter(p=>p.stage!=='closed'&&p.stage!=='handoff');
  const due=active.filter(p=>p.due);
  const interested=active.filter(p=>p.stage==='interested');
  const selected=records.filter(item=>
    view==='work' ? (item.stage==='interested'||item.due||item.stage==='conversation'||item.stage==='identified')
    : view==='all' ? item.stage!=='closed'&&item.stage!=='handoff'
    : view==='interested' ? item.stage==='interested'
    : view==='nurture' ? item.stage==='nurture'
    : view==='handoff' ? item.stage==='handoff'
    : item.stage==='closed'
  ).sort((a,b)=>priority(a.stage,a.due)-priority(b.stage,b.due));
  const canAdd=['owner','admin','business_development','operator'].includes(String(profile.role));

  return <section className={`saas-page acquisition-workspace ${styles.flow}`}>
    <div className={styles.top}>
      <div>
        <p className="vp-kicker">Acquisition / LinkedIn</p>
        <h1>Keep conversations moving.</h1>
        <p className={styles.muted}>Work on the next prospect, record what happened, and hand over genuine interest. LinkedIn remains the messaging channel.</p>
      </div>
      <div className={styles.topActions}>
        {canAdd?<Link className="button" href="/workspace/acquisition/funnel?add=1#add-prospect">+ Add prospect</Link>:null}
        <Link className="button secondary" href="/workspace/acquisition">Formal acquisition</Link>
      </div>
    </div>

    {query.error?<div className="vp-callout" role="alert"><strong>Prospect not added</strong><p>{query.error}</p></div>:null}

    <div className={styles.metrics} aria-label="LinkedIn prospect summary">
      <div><strong>{due.length}</strong><span>Follow-ups due</span></div>
      <div><strong>{active.filter(p=>p.stage==='conversation').length}</strong><span>Conversations</span></div>
      <div><strong>{interested.length}</strong><span>Ready for enquiry</span></div>
    </div>

    <div className={styles.workPanel}>
      <div className={styles.workHead}>
        <div><p className="vp-kicker">Your worklist</p><h2>One clear next action.</h2></div>
        <span className={styles.count}>{selected.length} shown</span>
      </div>
      <nav className={styles.filters} aria-label="Filter LinkedIn prospects">
        {views.map(option=><Link
          key={option.key}
          href={`/workspace/acquisition/funnel?view=${option.key}`}
          aria-current={view===option.key?'page':undefined}
          className={view===option.key?styles.activeFilter:undefined}
        >{option.label}</Link>)}
      </nav>

      {selected.length ? <ul className={styles.prospectList}>
        {selected.map(item=><li key={item.id}>
          <Link className={styles.prospectRow} href={`/workspace/acquisition/${item.id}`}>
            <div className={styles.prospectText}>
              <strong>{item.company_name}</strong>
              <small>{item.contact_name||'Contact not recorded'}</small>
            </div>
            <div className={styles.rowContext}>
              <span className={item.stage==='interested'?styles.highlight:styles.stage}>{stageLabel(item.stage)}</span>
              {item.due?<small className={styles.due}>Follow-up due</small>
                : item.next_follow_up_at?<small>Next: {followUpLabel(item.next_follow_up_at)}</small>:null}
            </div>
            <span className={styles.rowAction}>{item.stage==='interested'?'Start enquiry':item.due?'Follow up':'Open'} <span aria-hidden="true">↗</span></span>
          </Link>
        </li>)}
      </ul> : <div className={styles.empty}>
        <strong>{view==='work'?'Nothing urgent to chase.':'No prospects in this view.'}</strong>
        <p>{view==='work'?'Add a new prospect or use Active to see conversations waiting for a response.':'Switch views to find another record.'}</p>
      </div>}
      {records.length>=500?<p className={styles.small}>Showing a maximum of 500 recently created LinkedIn prospects. Use the main Prospect register for older records.</p>:null}
    </div>

    {canAdd?<details id="add-prospect" className={styles.newProspect} open={query.add==='1'||Boolean(query.error)}>
      <summary>+ Add a LinkedIn prospect <span>One step · existing company/contact records are reused</span></summary>
      <form action={quickAddLinkedInProspectAction} className={styles.quickForm}>
        <label>Company <input name="company_name" minLength={2} maxLength={180} required placeholder="Engineering company name"/></label>
        <label>Contact <input name="contact_name" minLength={2} maxLength={180} required placeholder="Person you are speaking with"/></label>
        <label>Job title <input name="job_title" maxLength={180} placeholder="Optional"/></label>
        <label>LinkedIn profile <input name="linkedin_url" type="url" placeholder="https://www.linkedin.com/in/..." /></label>
        <p>We reuse existing company and contact records when they match. Nothing is sent automatically. Existing do-not-contact preferences are respected.</p>
        <button className="button" type="submit">Save prospect <span aria-hidden="true">↗</span></button>
      </form>
    </details>:null}
  </section>;
}
