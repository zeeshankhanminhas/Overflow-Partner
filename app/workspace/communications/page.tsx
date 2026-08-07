import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

function formatDate(value:string|null){
  if(!value)return 'Not sent';
  return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(value));
}
function words(value:string){return value.replace(/[._-]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase())}

export default async function CommunicationsPage(){
  const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('notification_outbox')
    .select('id,event_key,category,recipient_email,recipient_name,subject,entity_type,entity_id,status,scheduled_for,sent_at,created_at')
    .eq('organisation_id',organisationId)
    .in('category',['transactional','reminder','nurture'])
    .order('created_at',{ascending:false})
    .limit(150);
  if(error)throw new Error(`Communications register could not be loaded: ${error.message}`);
  const rows=data||[];
  const sent=rows.filter(row=>row.status==='sent').length;
  const scheduled=rows.filter(row=>['pending','processing'].includes(row.status)).length;
  const failed=rows.filter(row=>row.status==='failed').length;

  return <section className="vp-page">
    <header className="vp-header"><div><p className="vp-kicker">Control · Communications</p><h1>Business communication record.</h1><p className="vp-subtitle">Transactional emails, reminders and nurture messages linked back to the case or project that caused them.</p></div><Link href="/workspace/notifications">Open Notification Centre</Link></header>
    <section className="vp-object vp-object--hero"><p className="vp-label">Communication position</p><div className="vp-compact-metrics"><div className="vp-metric"><span>Sent</span><strong>{sent}</strong></div><div className="vp-metric"><span>Scheduled</span><strong>{scheduled}</strong></div><div className="vp-metric"><span>Failed</span><strong>{failed}</strong></div></div></section>
    <section><div className="vp-section-title"><div><p className="vp-label">Governed record</p><h2>Recent communications</h2></div></div><div className="vp-list">{rows.length===0?<div className="vp-empty">No business communications have been recorded yet.</div>:rows.map(row=>{
      const href=row.entity_type==='lead'&&row.entity_id?`/workspace/communications/lead/${row.entity_id}`:row.entity_type==='project'&&row.entity_id?`/workspace/communications/project/${row.entity_id}`:null;
      const content=<><div><h3>{row.subject}</h3><p>{row.recipient_name||row.recipient_email} · {words(row.category)}</p></div><div className="vp-row-status">{words(row.status)}</div><div><strong>{formatDate(row.sent_at||row.scheduled_for)}</strong></div></>;
      return href?<Link href={href} className="vp-row" key={row.id}>{content}</Link>:<article className="vp-row" key={row.id}>{content}</article>;
    })}</div></section>
  </section>;
}
