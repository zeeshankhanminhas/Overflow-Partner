import Link from 'next/link';
import {requireUserContext} from '@/lib/auth/context';
import {OperatorPageIntro} from '../OperatorViews';
import css from '../opos.module.css';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function label(value:string){if(value==='sent')return 'Accepted by provider';if(value==='delivered')return 'Provider confirmed delivery';if(value==='failed'||value==='dead_letter')return 'Failed';if(value==='pending'||value==='queued')return 'Queued';return value.replaceAll('_',' ');}
function when(value:string|null|undefined){return value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(value)):'Not recorded';}

export default async function NotificationEvidencePage({
  searchParams,
}:{searchParams:Promise<{prospect?:string}>}){
  const {prospect:requested}=await searchParams;
  const prospect=uuid.test(requested||'')?requested!:null;
  const {supabase,organisationId}=await requireUserContext();
  const [result,sessionResult]=await Promise.all([
    supabase.rpc('op_list_notification_delivery',{p_status:null,p_category:null,p_limit:150}),
    prospect?supabase.from('intake_sessions').select('id,created_at,status,email_status,email_error')
      .eq('organisation_id',organisationId).eq('prospect_id',prospect)
      .order('created_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null,error:null}),
  ]);
  if(result.error)throw new Error('Notification delivery evidence could not be loaded.');
  if(sessionResult.error)throw new Error('Requirements session evidence could not be loaded.');
  const messages=(result.data||[]).filter((row:{entity_type:string;entity_id:string;event_key:string})=>
    row.entity_type==='prospect' && row.entity_id===prospect &&
    (row.event_key==='requirements.requested'||row.event_key==='requirements.reminder'||row.event_key==='partner_review.requested'));
  const session=sessionResult.data;
  return <section>
    <OperatorPageIntro eyebrow="OPERATIONS / COMMUNICATIONS" title="Delivery evidence"
      subtitle="This is the recorded notification outbox state, not a promise of inbox delivery. Messages accepted by the provider are not automatically confirmed as read." count={messages.length}/>
    {prospect?<Link className={css.backLink} href={'/opos-next/opportunities/'+prospect}>← Back to Opportunity</Link>
      :<p className={css.empty}>Open this view from an Opportunity record to see its communications.</p>}
    {session?<section className={css.card} aria-label="Latest customer requirements session">
      <span className={css.overline}>MOST RECENT SECURE REQUIREMENTS SESSION</span>
      <h2 className={css.cardTitle}>{label(String(session.email_status||'unverified'))}</h2>
      <p className={css.cardDescription}>Intake state: {String(session.status).replaceAll('_',' ')} · Created {when(session.created_at)}</p>
      {session.email_error?<p role="alert" className={css.meta}>Queue error: {String(session.email_error).slice(0,300)}</p>:null}
    </section>:null}
    <section className={css.section} aria-label="Outbound notification evidence">
      <div className={css.sectionHeading}><h2>Recent delivery attempts</h2><span className={css.meta}>Organisation-scoped records · newest first</span></div>
      {messages.length?<ul className={css.queue}>{messages.map((item:{id:string;event_key:string;status:string;attempts:number;sent_at:string|null;last_error:string|null;created_at:string})=>
        <li key={item.id}><div style={{padding:'18px 0'}}>
          <strong>{item.event_key.replaceAll('.',' · ')} — {label(item.status)}</strong>
          <p className={css.meta}>Queued {when(item.created_at)} · Attempts {item.attempts} · Provider accepted {when(item.sent_at)}</p>
          {item.last_error?<p className={css.meta} role="alert">Latest error: {String(item.last_error).slice(0,300)}</p>:null}
        </div></li>)}</ul>
      :<p className={css.empty}>No recent delivery-outbox record is available for this Opportunity in the bounded history. This is not evidence that a message was sent.</p>}
    </section>
    <p className={css.meta} style={{marginTop:24}}>Evidence is limited to the latest 150 organisation notifications exposed by the existing authorised delivery query. Safe reissue/replay requires an idempotent workflow and is deliberately not a button on this page.</p>
  </section>;
}
