import Link from 'next/link';
import ProspectForm from '@/components/workspace/ProspectForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';
import { resolveAcquisitionState } from '@/lib/acquisition/state';

function dateTime(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not yet';
}
function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="vp-fact"><small>{label}</small><strong>{value === null || value === undefined || value === '' ? 'Not specified' : String(value)}</strong></div>;
}

export default async function AcquisitionPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const activeProspects = supabase.from('prospects').select('*',{count:'exact'}).eq('organisation_id',organisationId).neq('status','converted');
  const [prospectsResult, waitingResult, technicalPendingResult, qualifiedResult, companies, contacts] = await Promise.all([
    activeProspects.order('created_at',{ascending:false}).range(0,11),
    supabase.from('intake_sessions').select('id,prospects!inner(status)',{count:'exact',head:true}).eq('organisation_id',organisationId).in('status',['invited','opened','in_progress']).neq('prospects.status','converted'),
    supabase.from('intake_sessions').select('id,prospects!inner(status)',{count:'exact',head:true}).eq('organisation_id',organisationId).eq('status','submitted').neq('prospects.status','converted'),
    supabase.from('prospects').select('id',{count:'exact',head:true}).eq('organisation_id',organisationId).eq('status','qualified'),
    listCompanies(supabase,organisationId),
    listContacts(supabase,organisationId),
  ]);
  const prospects=prospectsResult.data??[];
  const ids=prospects.map((prospect:any)=>prospect.id);
  const sessionsResult=ids.length?await supabase.from('intake_sessions').select('id,prospect_id,status,expires_at,sent_at,opened_at,submitted_at').eq('organisation_id',organisationId).in('prospect_id',ids).order('created_at',{ascending:false}):{data:[] as any[]};
  const sessionByProspect=new Map<string,any>();
  for(const session of sessionsResult.data??[]){if(!sessionByProspect.has(session.prospect_id))sessionByProspect.set(session.prospect_id,session);}

  return <section className="saas-page acquisition-workspace">
    <section className="saas-hero">
      <div className="saas-hero__inner">
        <div className="saas-hero__copy"><p className="vp-kicker">Acquisition</p><h1>Manage incoming opportunities.</h1><p className="vp-subtitle">Track active prospects, customer intake, partner review and readiness for Case creation.</p></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="button secondary" href="/workspace/acquisition/prospects">All prospects</Link><Link className="button secondary" href="/workspace/acquisition/intake">Customer intake</Link></div>
      </div>
    </section>

    {params.created ? <div className="vp-callout"><strong>Prospect added</strong><p>The new opportunity is ready to work.</p></div> : null}
    {params.error ? <div className="vp-callout"><strong>Couldn’t complete that action</strong><p>{String(params.error)}</p></div> : null}

    <section className="saas-metrics" aria-label="Acquisition summary">
      <article className="saas-metric"><span>Awaiting customer</span><strong>{waitingResult.count||0}</strong><small>Intake invitations still open</small></article>
      <article className="saas-metric"><span>Ready for review</span><strong>{technicalPendingResult.count||0}</strong><small>Customer submissions received</small></article>
      <article className="saas-metric"><span>Ready for Case</span><strong>{qualifiedResult.count||0}</strong><small>Qualified opportunities</small></article>
      <article className="saas-metric"><span>Active prospects</span><strong>{prospectsResult.count||0}</strong><small>Current acquisition workload</small></article>
    </section>

    <details className="vp-disclosure"><summary>Add prospect</summary><div>{companies.length ? <ProspectForm companies={companies} contacts={contacts} /> : <div className="vp-empty">Add a company before creating a prospect. <Link href="/workspace/companies">Add company →</Link></div>}</div></details>

    <section className="saas-section">
      <div className="saas-section__header"><div><p className="vp-label">Active opportunities</p><h2>Acquisition queue</h2></div><Link href="/workspace/acquisition/prospects">View all →</Link></div>
      <div className="vp-list">
        {prospects.length===0 ? <div className="vp-empty">No active acquisition records.</div> : prospects.map((prospect:any) => {
          const session=sessionByProspect.get(prospect.id);
          const resolved=resolveAcquisitionState({prospectStatus:prospect.status,hasSession:Boolean(session),sessionStatus:session?.status,hasSubmission:session?.status==='submitted',convertedCaseId:prospect.converted_lead_id});
          return <article className="acquisition-record" key={prospect.id}>
            <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:18,alignItems:'start'}}><div><h3 style={{margin:0}}>{prospect.company_name}</h3><p style={{margin:'5px 0 0',color:'var(--op-muted)'}}>{[prospect.contact_name, prospect.job_title].filter(Boolean).join(' · ') || 'Contact not added'} · {prospect.source}</p></div><span className="vp-row-status">{resolved.currentState}</span></div>
            <div className="vp-facts" style={{marginTop:14}}><Fact label="Status" value={resolved.currentState}/><Fact label="Requirement" value={prospect.requirement_summary}/><Fact label="Next action" value={resolved.nextAction}/><Fact label="Intake received" value={dateTime(session?.submitted_at)}/></div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16}}><Link className="button" href={`/workspace/acquisition/${prospect.id}`}>Open record</Link>{prospect.company_id?<Link className="button secondary" href={`/workspace/companies/${prospect.company_id}`}>Company</Link>:null}</div>
          </article>;
        })}
      </div>
    </section>
  </section>;
}
