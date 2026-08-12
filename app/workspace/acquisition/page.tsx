import Link from 'next/link';
import ProspectForm from '@/components/workspace/ProspectForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';
import { resolveAcquisitionState } from '@/lib/acquisition/state';
import { resolveAcquisitionPresentation } from '@/lib/presentation/operatingState';
import { ProductStatus } from '@/components/workspace/ProductUI';

function dateTime(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not yet';
}
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="vp-fact"><small>{label}</small><strong>{value === null || value === undefined || value === '' ? 'Not specified' : value}</strong></div>;
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
  const [sessionsResult,requestsResult]=await Promise.all([
    ids.length?supabase.from('intake_sessions').select('id,prospect_id,status,expires_at,sent_at,opened_at,submitted_at,created_at').eq('organisation_id',organisationId).in('prospect_id',ids).order('created_at',{ascending:false}):Promise.resolve({data:[] as any[]}),
    ids.length?supabase.from('partner_review_requests').select('id,prospect_id,status,created_at').eq('organisation_id',organisationId).in('prospect_id',ids).order('created_at',{ascending:false}):Promise.resolve({data:[] as any[]}),
  ]);
  const sessionByProspect=new Map<string,any>();for(const session of sessionsResult.data??[]){if(!sessionByProspect.has(session.prospect_id))sessionByProspect.set(session.prospect_id,session);}
  const requestByProspect=new Map<string,any>();for(const request of requestsResult.data??[]){if(!requestByProspect.has(request.prospect_id))requestByProspect.set(request.prospect_id,request);}
  const sessionIds=[...sessionByProspect.values()].map(item=>item.id);const requestIds=[...requestByProspect.values()].map(item=>item.id);
  const [submissionResult,responseResult,decisionResult,priceResult]=await Promise.all([
    sessionIds.length?supabase.from('intake_submissions').select('intake_session_id').eq('organisation_id',organisationId).in('intake_session_id',sessionIds):Promise.resolve({data:[] as any[]}),
    requestIds.length?supabase.from('partner_review_responses').select('partner_review_request_id').eq('organisation_id',organisationId).in('partner_review_request_id',requestIds):Promise.resolve({data:[] as any[]}),
    requestIds.length?supabase.from('partner_review_internal_decisions').select('partner_review_request_id,decision,created_at').eq('organisation_id',organisationId).in('partner_review_request_id',requestIds).order('created_at',{ascending:false}):Promise.resolve({data:[] as any[]}),
    requestIds.length?supabase.from('partner_quotes').select('partner_review_request_id,price').eq('organisation_id',organisationId).in('partner_review_request_id',requestIds):Promise.resolve({data:[] as any[]}),
  ]);
  const submissionSet=new Set((submissionResult.data||[]).map((item:any)=>String(item.intake_session_id)));
  const responseSet=new Set((responseResult.data||[]).map((item:any)=>String(item.partner_review_request_id)));
  const decisionMap=new Map<string,any>();for(const item of decisionResult.data||[])if(!decisionMap.has(String((item as any).partner_review_request_id)))decisionMap.set(String((item as any).partner_review_request_id),item);
  const priceSet=new Set((priceResult.data||[]).filter((item:any)=>Number(item.price)>0).map((item:any)=>String(item.partner_review_request_id)));
  const rows=prospects.map((prospect:any)=>{
    const session=sessionByProspect.get(prospect.id);const request=requestByProspect.get(prospect.id);const decision=request?decisionMap.get(String(request.id)):null;
    const state=resolveAcquisitionState({prospectStatus:prospect.status,hasSession:Boolean(session),sessionStatus:session?.status,hasSubmission:Boolean(session&&submissionSet.has(String(session.id))),convertedCaseId:prospect.converted_lead_id,hasPartnerRequest:Boolean(request),partnerRequestStatus:request?.status,hasPartnerResponse:Boolean(request&&responseSet.has(String(request.id))),partnerDecision:decision?.decision,hasPartnerPricing:Boolean(request&&priceSet.has(String(request.id)))});
    return {prospect,session,presentation:resolveAcquisitionPresentation(state)};
  });
  const approvalCount=rows.filter(row=>row.presentation.approval?.required).length;

  return <section className="saas-page acquisition-workspace">
    <section className="saas-hero">
      <div className="saas-hero__inner">
        <div className="saas-hero__copy"><p className="vp-kicker">Acquisition</p><h1>Manage incoming opportunities.</h1><p className="vp-subtitle">Move each enquiry through client intake, Partner Assessment and Go / No-Go without duplicating decisions in Case 360.</p></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="button secondary" href="/workspace/acquisition/prospects">All enquiries</Link><Link className="button secondary" href="/workspace/assessments?view=partner">Partner Assessments</Link><Link className="button secondary" href="/workspace/approvals">Approvals{approvalCount?` · ${approvalCount}`:''}</Link></div>
      </div>
    </section>

    {params.created ? <div className="vp-callout" data-continuity-notice><strong>Enquiry added</strong><p>The new opportunity is ready to work.</p></div> : null}
    {params.error ? <div className="vp-callout" data-continuity-notice><strong>Couldn’t complete that action</strong><p>{String(params.error)}</p></div> : null}

    <section className="saas-metrics" aria-label="Acquisition summary">
      <article className="saas-metric"><span>Waiting on client</span><strong>{waitingResult.count||0}</strong><small>Technical intake invitations still open</small></article>
      <article className="saas-metric"><span>Intake received</span><strong>{technicalPendingResult.count||0}</strong><small>Client submissions ready for controlled work</small></article>
      <article className="saas-metric"><span>Approvals</span><strong>{approvalCount}</strong><small>Go / No-Go authority decisions visible here</small></article>
      <article className="saas-metric"><span>Ready for Case</span><strong>{qualifiedResult.count||0}</strong><small>Governed acquisition complete</small></article>
    </section>

    <details id="manual-prospect" className="vp-disclosure"><summary>Add enquiry</summary><div>{companies.length ? <ProspectForm companies={companies} contacts={contacts} /> : <div className="vp-empty">Add a company before creating an enquiry. <Link href="/workspace/companies">Add company →</Link></div>}</div></details>

    <section className="saas-section">
      <div className="saas-section__header"><div><p className="vp-label">Active opportunities</p><h2>Acquisition queue</h2></div><Link href="/workspace/acquisition/prospects">View all →</Link></div>
      <div className="vp-list">
        {rows.length===0 ? <div className="vp-empty">No active acquisition records.</div> : rows.map(({prospect,session,presentation}) => <article className="acquisition-record" key={prospect.id}>
          <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:18,alignItems:'start'}}><div><h3 style={{margin:0}}>{prospect.company_name}</h3><p style={{margin:'5px 0 0',color:'var(--op-muted)'}}>{[prospect.contact_name, prospect.job_title].filter(Boolean).join(' · ') || 'Contact not added'} · {prospect.source}</p></div><ProductStatus tone={presentation.tone}>{presentation.state}</ProductStatus></div>
          <p style={{margin:'12px 0 0',color:'var(--op-muted)'}}>{presentation.summary}</p>
          <div className="vp-facts" style={{marginTop:14}}><Fact label={presentation.waitingOn?'Waiting on':'Owner'} value={presentation.waitingOn?.label||'Overflow Partner'}/><Fact label="What happens next" value={presentation.nextAction.label}/><Fact label="Requirement" value={prospect.requirement_summary}/><Fact label="Intake received" value={dateTime(session?.submitted_at)}/></div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16}}><Link className="button" href={`/workspace/acquisition/${prospect.id}`}>Open enquiry</Link>{prospect.company_id?<Link className="button secondary" href={`/workspace/companies/${prospect.company_id}`}>Company</Link>:null}</div>
        </article>)}
      </div>
    </section>
  </section>;
}
