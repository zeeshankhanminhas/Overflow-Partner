import Link from 'next/link';
import ProspectForm from '@/components/workspace/ProspectForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';

function dateTime(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not yet';
}
function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="vp-fact"><small>{label}</small><strong>{value === null || value === undefined || value === '' ? 'Not specified' : String(value)}</strong></div>;
}

export default async function AcquisitionPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const [prospectsResult, waitingResult, technicalPendingResult, qualifiedResult, companies, contacts] = await Promise.all([
    supabase.from('prospects').select('*',{count:'exact'}).eq('organisation_id',organisationId).order('created_at',{ascending:false}).range(0,11),
    supabase.from('intake_sessions').select('id',{count:'exact',head:true}).eq('organisation_id',organisationId).in('status',['invited','opened','in_progress']),
    supabase.from('intake_sessions').select('id',{count:'exact',head:true}).eq('organisation_id',organisationId).eq('status','submitted'),
    supabase.from('prospects').select('id',{count:'exact',head:true}).eq('organisation_id',organisationId).eq('status','qualified'),
    listCompanies(supabase,organisationId),
    listContacts(supabase,organisationId),
  ]);
  const prospects=prospectsResult.data??[];
  const ids=prospects.map((prospect:any)=>prospect.id);
  const sessionsResult=ids.length?await supabase.from('intake_sessions').select('id,prospect_id,status,expires_at,sent_at,opened_at,submitted_at').eq('organisation_id',organisationId).in('prospect_id',ids).order('created_at',{ascending:false}):{data:[] as any[]};
  const sessionByProspect=new Map<string,any>();
  for(const session of sessionsResult.data??[]){if(!sessionByProspect.has(session.prospect_id))sessionByProspect.set(session.prospect_id,session);}

  return <section className="vp-page acquisition-workspace">
    <header className="vp-header">
      <div><p className="vp-kicker">Acquire · Control surface</p><h1>Acquisition.</h1><p className="vp-subtitle">See what needs attention, then open the individual Acquisition Record to review evidence or make a governed decision.</p></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="button secondary" href="/workspace/acquisition/prospects">Prospect register</Link><Link className="button secondary" href="/workspace/acquisition/intake">Technical intake</Link></div>
    </header>

    {params.created ? <div className="vp-callout"><strong>Prospect added</strong><p>The acquisition record is available in the queue.</p></div> : null}
    {params.error ? <div className="vp-callout"><strong>Action could not be completed</strong><p>{String(params.error)}</p></div> : null}

    <section className="vp-object vp-object--hero"><p className="vp-label">Acquisition position</p><div className="vp-compact-metrics"><div className="vp-metric"><span>Awaiting customer</span><strong>{waitingResult.count||0}</strong></div><div className="vp-metric"><span>Technical review pending</span><strong>{technicalPendingResult.count||0}</strong></div><div className="vp-metric"><span>Qualified for conversion</span><strong>{qualifiedResult.count||0}</strong></div><div className="vp-metric"><span>Total prospects</span><strong>{prospectsResult.count||0}</strong></div></div></section>

    <details className="vp-disclosure"><summary>Add a prospect manually</summary><div>{companies.length ? <ProspectForm companies={companies} contacts={contacts} /> : <div className="vp-empty">Create the first company before adding a manual prospect. <Link href="/workspace/companies">Add company →</Link></div>}</div></details>

    <section>
      <div className="vp-section-title"><div><p className="vp-label">Attention queue</p><h2>Recent acquisition records</h2></div><Link href="/workspace/acquisition/prospects">View full register →</Link></div>
      <div className="vp-list">
        {prospects.length===0 ? <div className="vp-empty">No prospects have been captured yet.</div> : prospects.map((prospect:any) => {
          const session=sessionByProspect.get(prospect.id);
          const status=String(prospect.status||'new').replaceAll('_',' ');
          const state=prospect.status==='qualified'?'Ready to create Case 360':prospect.status==='converted'?'Converted':session?.status==='submitted'?'Technical review required':session?`Intake ${String(session.status).replaceAll('_',' ')}`:'Technical intake required';
          return <article className="acquisition-record" key={prospect.id} style={{padding:'18px 20px',borderTop:'1px solid var(--op-line)'}}>
            <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:18,alignItems:'start'}}><div><h3 style={{margin:0}}>{prospect.company_name}</h3><p style={{margin:'5px 0 0',color:'var(--op-muted)'}}>{[prospect.contact_name, prospect.job_title].filter(Boolean).join(' · ') || 'Contact not added'} · {prospect.source}</p></div><span className="vp-row-status">{status}</span></div>
            <div className="vp-facts" style={{marginTop:14}}><Fact label="Current acquisition state" value={state}/><Fact label="Initial requirement" value={prospect.requirement_summary}/><Fact label="Next movement" value={prospect.next_action}/><Fact label="Intake submitted" value={dateTime(session?.submitted_at)}/></div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16}}><Link className="button" href={`/workspace/acquisition/${prospect.id}`}>Open acquisition record</Link>{prospect.company_id?<Link className="button secondary" href={`/workspace/companies/${prospect.company_id}`}>Company</Link>:null}</div>
          </article>;
        })}
      </div>
    </section>
  </section>;
}
