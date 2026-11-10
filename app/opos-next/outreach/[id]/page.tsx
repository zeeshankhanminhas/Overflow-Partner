import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {isKnownIsolatedQaFixtureBackend} from '@/lib/qa/isolation';
import {promoteOutreachToCrmAction} from '@/app/outreach/actions';
import {addOutreachNoteAction} from '@/app/outreach/note-actions';
import {OperatorPageIntro} from '../../OperatorViews';
import OutreachNextAction from '../OutreachNextAction';
import css from '../outreach.module.css';
import layout from '../../opos.module.css';

function date(value:string|null){return value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(value)):'Not scheduled';}
export default async function OutreachThreadPage({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<{error?:string;updated?:string}>}){
 const {id}=await params;
 const query=searchParams?await searchParams:{};
 const {supabase,organisationId,profile}=await requireUserContext();
 const [threadResult,messageResult]=await Promise.all([
   supabase.from('linkedin_outreach_threads')
     .select('id,company_name,contact_name,state,job_title,linkedin_url,next_follow_up_at,crm_prospect_id')
     .eq('organisation_id',organisationId).eq('id',id).maybeSingle(),
   supabase.from('linkedin_outreach_messages').select('id,source,body,created_at')
     .eq('organisation_id',organisationId).eq('outreach_id',id)
     .order('created_at',{ascending:true}).limit(200),
 ]);
 if(threadResult.error||!threadResult.data)notFound();
 if(messageResult.error)throw new Error('Conversation history could not be loaded.');
 const thread=threadResult.data;
 const state=String(thread.state||'new');
 const canWrite=isKnownIsolatedQaFixtureBackend()&&['owner','admin','business_development','operator'].includes(String(profile.role));
 const converted=state==='converted';
 const closed=state==='closed';
 const interested=state==='interested';
 const status=converted?'In CRM':interested?'Interest confirmed':state==='waiting'?'Awaiting reply':state==='followup'?'Follow-up scheduled':closed?'Closed':'Not yet qualified';
 const linkedin=String(thread.linkedin_url||'');
 const validLinkedin=/^https:\/\/(www\.)?linkedin\.com\//i.test(linkedin);
 return <article>
   <Link href="/opos-next/outreach" className={layout.backLink}>← Back to Outreach</Link>
   <OperatorPageIntro eyebrow="OUTREACH / LINKEDIN CONVERSATION" title={thread.company_name} subtitle={thread.contact_name+(thread.job_title?' · '+thread.job_title:'')}/>
   {query.error?<p role="alert" className={css.notice+' '+css.error}>{String(query.error).slice(0,450)}</p>:null}
   {query.updated?<p role="status" className={css.notice}>{String(query.updated).slice(0,450)}</p>:null}
   <div className={css.layout}>
     <section className={css.panel} aria-label="Current outreach position">
       <p className={css.kicker}>CURRENT OPERATING POSITION</p>
       <h2>{status}</h2>
       <div className={css.metadata}><span>Follow-up: {date(thread.next_follow_up_at)}</span><span>CRM: {converted?'Converted':'Not created by this thread'}</span></div>
       {interested?<p>The prospect has expressed interest. A controlled CRM handoff is now eligible; it will not automatically issue technical intake.</p>:
         converted?<p>The thread has been handed over to CRM. Its original LinkedIn history remains here.</p>:
         <p>Keep personal prospecting outside CRM until interest is explicitly confirmed. Notes do not send LinkedIn messages or create enquiries.</p>}
       <div className={css.actions}>
         {converted&&thread.crm_prospect_id?<Link href={'/opos-next/opportunities/'+thread.crm_prospect_id} className={css.button}>Open Opportunity 360 →</Link>:null}
         {interested&&canWrite?<form action={promoteOutreachToCrmAction}>
           <input type="hidden" name="opos_next" value="1"/><input type="hidden" name="id" value={id}/>
           <button type="submit" className={css.button}>Convert to CRM →</button>
         </form>:null}
         {validLinkedin?<a className={css.secondary} href={linkedin} target="_blank" rel="noopener noreferrer">Open LinkedIn profile ↗</a>:null}
       </div>
       {!canWrite&&!converted&&!closed?<p className={css.notice}>Write controls are unavailable until the isolated QA fixture gate and operator permissions are enabled.</p>:null}
     </section>
     {canWrite&&!converted&&!closed&&!interested?<section className={css.panel} aria-label="Record next outreach action">
       <p className={css.kicker}>NEXT OPERATOR DECISION</p><h2>What happens next?</h2>
       <OutreachNextAction id={id} state={state} nextFollowUp={thread.next_follow_up_at}/>
     </section>:null}
     <section className={css.panel} aria-label="Conversation history">
       <p className={css.kicker}>LINKEDIN / SALES NAVIGATOR</p><h2>Conversation history</h2>
       <p>{(messageResult.data||[]).length} saved entr{(messageResult.data||[]).length===1?'y':'ies'}. Pasted text is an internal archive, not a message sent by OPOS.</p>
       {(messageResult.data||[]).length?<ol className={css.history}>{(messageResult.data||[]).map(entry=><li key={entry.id}>
         <strong>{entry.source==='sales_navigator'?'Sales Navigator':entry.source==='linkedin'?'LinkedIn':'Internal note'}</strong>
         <small> · {date(entry.created_at)}</small><p>{entry.body}</p>
       </li>)}</ol>:<p className={css.notice}>No conversation entries yet. Save a manual LinkedIn exchange below.</p>}
       {canWrite&&!converted&&!closed?<form action={addOutreachNoteAction} className={css.form}>
         <input type="hidden" name="opos_next" value="1"/><input type="hidden" name="outreach_id" value={id}/>
         <label>Source<select name="source" defaultValue="linkedin"><option value="linkedin">LinkedIn</option><option value="sales_navigator">Sales Navigator</option><option value="note">Internal note</option></select></label>
         <label>Conversation or internal note<textarea name="body" rows={5} required maxLength={60000} placeholder="Paste a relevant exchange or record an internal note."/></label>
         <button type="submit">Save to conversation →</button>
       </form>:null}
     </section>
   </div>
 </article>;
}
