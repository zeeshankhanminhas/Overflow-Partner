import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { linkedInFunnelStage, linkedinFunnelStages, type LinkedInProspect } from '@/lib/acquisition/linkedinFunnel';

function followUpLabel(value: string | null | undefined) {
  if (!value) return 'No follow-up scheduled';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No follow-up scheduled' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default async function LinkedInAcquisitionFunnelPage() {
  const { supabase, organisationId } = await requireUserContext();
  const { data, error } = await supabase.from('prospects')
    .select('id,company_name,contact_name,status,source,outreach_status,response_outcome,next_follow_up_at,converted_lead_id')
    .eq('organisation_id', organisationId)
    .eq('source', 'linkedin')
    .order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);

  const prospects = (data ?? []) as LinkedInProspect[];
  const ids = prospects.map(item => item.id);
  const { data: sessions, error: sessionsError } = ids.length
    ? await supabase.from('intake_sessions').select('prospect_id').eq('organisation_id', organisationId).in('prospect_id', ids)
    : { data: [] as { prospect_id: string }[], error: null };
  if (sessionsError) throw new Error(sessionsError.message);
  const withIntake = new Set((sessions ?? []).map(item => String(item.prospect_id)));
  const records = prospects.map(item => ({ ...item, funnelStage: linkedInFunnelStage(item, withIntake.has(item.id)) }));
  const due = records.filter(item => !['handoff','closed','nurture'].includes(item.funnelStage) && item.next_follow_up_at && new Date(item.next_follow_up_at).getTime() <= Date.now());
  const groups = linkedinFunnelStages.map(stage => ({ ...stage, prospects: records.filter(item => item.funnelStage === stage.key) }));
  const parked = records.filter(item => item.funnelStage === 'nurture');
  const closed = records.filter(item => item.funnelStage === 'closed');

  return <section className="saas-page acquisition-workspace linkedin-funnel">
    <div className="saas-hero"><div className="saas-hero__inner"><div className="saas-hero__copy">
      <p className="vp-kicker">Customer acquisition · LinkedIn</p>
      <h1>From first conversation to enquiry.</h1>
      <p className="vp-subtitle">Track cold outreach before requesting detailed engineering requirements. Marketing interest is not technical qualification or commercial approval.</p>
    </div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Link className="button" href="/workspace/acquisition#manual-prospect">Add prospect</Link>
      <Link className="button secondary" href="/workspace/acquisition/prospects">Formal enquiries</Link>
    </div></div></div>

    <div className="linkedin-funnel__summary" aria-label="LinkedIn acquisition summary">
      <div><strong>{records.length}</strong><span>LinkedIn prospects</span></div>
      <div><strong>{due.length}</strong><span>Follow-ups due</span></div>
      <div><strong>{groups.find(group => group.key === 'interested')?.prospects.length ?? 0}</strong><span>Ready for enquiry</span></div>
      <div><strong>{groups.find(group => group.key === 'handoff')?.prospects.length ?? 0}</strong><span>Handed off</span></div>
    </div>

    <section aria-labelledby="linkedin-path" className="linkedin-funnel__path">
      <div><p className="vp-kicker">Separate acquisition workflow</p><h2 id="linkedin-path">Prospect → outreach → conversation → interest → enquiry</h2>
        <p>Send LinkedIn messages manually and log the response. Only after a recorded interested reply can a LinkedIn prospect receive a secure requirements invitation. The existing partner review, technical qualification and commercial lifecycle remain unchanged.</p>
      </div>
      <ol className="linkedin-funnel__stages">
        {groups.map((stage, index) => <li key={stage.key}><small>0{index + 1}</small><strong>{stage.label}</strong><span>{stage.description}</span><b aria-label={`${stage.prospects.length} prospects`}>{stage.prospects.length}</b></li>)}
      </ol>
    </section>

    <section className="linkedin-funnel__work" aria-label="Prospect work queues">
      {due.length > 0 ? <div className="vp-callout"><strong>{due.length} follow-up{due.length === 1 ? '' : 's'} due</strong><p>{due.slice(0, 5).map((item, index) => <span key={item.id}>{index ? ' · ' : ''}<Link href={`/workspace/acquisition/${item.id}`}>{item.company_name}</Link></span>)} — open each prospect to log a LinkedIn action.</p></div> : null}
      {groups.map(group => <section className="linkedin-funnel__group" key={group.key} aria-label={group.label}>
        <header><div><h3>{group.label}</h3><p>{group.description}</p></div><strong>{group.prospects.length}</strong></header>
        {group.prospects.length ? <ul>{group.prospects.slice(0, 25).map(item => <li key={item.id}>
          <div><strong>{item.company_name}</strong><small>{item.contact_name || 'Contact not recorded'} · {followUpLabel(item.next_follow_up_at)}</small></div>
          <Link className="button secondary" href={`/workspace/acquisition/${item.id}`}>{group.key === 'interested' ? 'Start enquiry' : 'Open prospect'}</Link>
        </li>)}</ul> : <p className="linkedin-funnel__empty">No prospects at this stage.</p>}
        {group.prospects.length > 25 ? <small>Showing the most recent 25 of {group.prospects.length}. Use the Prospect register for other records.</small> : null}
      </section>)}
      <div className="linkedin-funnel__aside"><strong>Nurture / paused: {parked.length}</strong><span>Keep future opportunities available without forcing technical intake.</span><strong>Closed / not a fit: {closed.length}</strong><span>Excluded from the active campaign; historic evidence stays in the Prospect record.</span></div>
    </section>
  </section>;
}
