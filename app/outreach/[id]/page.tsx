import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { promoteOutreachToCrmAction } from '@/app/outreach/actions';
import OutreachDisposition from '@/components/workspace/OutreachDisposition';
import OutreachConversationJournal from '@/components/workspace/OutreachConversationJournal';
import styles from '@/app/workspace/acquisition/LinkedInFlow.module.css';

export default async function OutreachThreadPage({
 params,searchParams,
}:{
 params:Promise<{id:string}>;
 searchParams?:Promise<{error?:string;updated?:string}>;
}) {
 const {id}=await params;
 const query=searchParams?await searchParams:{};
 const {supabase,organisationId,profile}=await requireUserContext();
 const [threadResult,messageResult]=await Promise.all([
  supabase.from('linkedin_outreach_threads')
    .select('id,company_name,contact_name,job_title,linkedin_url,state,next_follow_up_at,crm_prospect_id')
    .eq('organisation_id',organisationId).eq('id',id).maybeSingle(),
  supabase.from('linkedin_outreach_messages')
    .select('id,source,body,created_at')
    .eq('organisation_id',organisationId).eq('outreach_id',id)
    .order('created_at',{ascending:true}).order('id',{ascending:true}).limit(200),
 ]);
 if(threadResult.error||!threadResult.data)notFound();
 if(messageResult.error)throw new Error('Could not read outreach messages.');
 const t=threadResult.data;
 const canWrite=['owner','admin','business_development','operator'].includes(String(profile.role));
 const stage=t.state;
 const converted=stage==='converted';
 const stateLabel=stage==='interested'?'Interest confirmed':stage==='converted'?'In CRM':
   stage==='followup'?'Follow up':stage==='waiting'?'Waiting for reply':
   stage==='closed'?'Closed':'New conversation';
 const feedback=String(query.error||query.updated||'').slice(0,500);
 const isError=Boolean(query.error);
 return <article className={`${styles.record} ${styles.simpleRecord}`}>
  <header className={styles.recordTop}>
   <div>
    <Link className={styles.back} href="/outreach">← All outreach conversations</Link>
    <h1>{t.company_name}</h1>
    <p>{t.contact_name}{t.job_title?' · '+t.job_title:''}</p>
   </div>
   <div className={styles.threadActions}>
    <span className={styles.pill}>{stateLabel}</span>
    {t.linkedin_url?<a className={styles.sourceLink} href={t.linkedin_url} target="_blank" rel="noopener noreferrer">Open LinkedIn ↗</a>:null}
   </div>
  </header>
  {feedback?<p role={isError?'alert':'status'} className={styles.actionHint}>{feedback}</p>:null}
  {stage==='interested'&&canWrite?<section className={styles.simpleNext}>
   <div><strong>Ready to enter CRM</strong>
    <p>Only now will OPOS create or reuse a Company, Contact and Prospect. All technical and commercial approvals stay governed.</p>
   </div>
   <form action={promoteOutreachToCrmAction}>
    <input type="hidden" name="id" value={id}/>
    <button type="submit" className="button">Convert to CRM ↗</button>
   </form>
  </section>:null}
  {converted&&t.crm_prospect_id?<section className={styles.simpleNext}>
    <div><strong>Handed over to CRM</strong><p>This conversation remains available here as an independent history.</p></div>
    <Link className="button" href={`/workspace/acquisition/${t.crm_prospect_id}`}>Open Prospect ↗</Link>
   </section>:null}
  <OutreachConversationJournal outreachId={id} entries={messageResult.data||[]} canWrite={canWrite&&!converted}/>
  {canWrite&&!converted&&stage!=='closed'&&stage!=='interested'?<section className={styles.simpleDecision}>
   <div><p className={styles.eyebrow}>NEXT ACTION</p><h2>What happened next?</h2></div>
   <OutreachDisposition id={id} state={stage} nextFollowUp={t.next_follow_up_at}/>
  </section>:null}
  {stage==='interested'?<p className={styles.nextNote}>Interest is confirmed. CRM records still do not exist for this conversation until you select Convert to CRM.</p>:null}
 </article>;
}
