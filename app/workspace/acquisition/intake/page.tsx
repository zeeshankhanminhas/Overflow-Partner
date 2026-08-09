import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';

function formatDate(value:string|null){return value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Not recorded'}

export default async function TechnicalIntakeRegisterPage(){
  const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('intake_sessions')
    .select('id,status,sent_at,opened_at,submitted_at,expires_at,prospect_id,prospects(company_name,contact_name,email)')
    .eq('organisation_id',organisationId)
    .order('created_at',{ascending:false});
  if(error)throw new Error(`Technical intake register could not be loaded: ${error.message}`);
  const rows=(data||[]) as any[];
  const waiting=rows.filter(row=>['invited','opened','in_progress'].includes(row.status)).length;
  const submitted=rows.filter(row=>row.status==='submitted').length;
  const expired=rows.filter(row=>row.status==='expired').length;
  return <section className="vp-page">
    <header className="vp-header"><div><p className="vp-kicker">Acquire · Internal intake register</p><h1>Technical intake control register.</h1><p className="vp-subtitle">This is an internal monitoring surface, not the customer Step 2 form. Open the Prospect record to manage the intake or generate a secure customer test link.</p></div><Link className="button" href="/workspace/acquisition">Open acquisition workspace</Link></header>
    <section className="vp-object vp-object--hero"><p className="vp-label">Intake position</p><div className="vp-compact-metrics"><div className="vp-metric"><span>Waiting</span><strong>{waiting}</strong></div><div className="vp-metric"><span>Submitted</span><strong>{submitted}</strong></div><div className="vp-metric"><span>Expired</span><strong>{expired}</strong></div></div></section>
    <section><div className="vp-section-title"><div><p className="vp-label">Internal register</p><h2>Technical intake sessions</h2></div></div><div className="vp-list">{rows.length===0?<div className="vp-empty">No technical intake sessions have been created yet.</div>:rows.map(row=>{const prospect=Array.isArray(row.prospects)?row.prospects[0]:row.prospects;return <article className="vp-row" key={row.id}><div><h3>{prospect?.company_name||'Unknown prospect'}</h3><p>{prospect?.contact_name||prospect?.email||'Contact not recorded'} · Sent {formatDate(row.sent_at)}</p></div><div className="vp-row-status">{String(row.status).replaceAll('_',' ')}</div><div><strong>{row.submitted_at?`Submitted ${formatDate(row.submitted_at)}`:`Expires ${formatDate(row.expires_at)}`}</strong></div><div><Link className="button secondary" href={`/workspace/acquisition/${row.prospect_id}`}>Open Prospect</Link></div></article>})}</div></section>
  </section>;
}
