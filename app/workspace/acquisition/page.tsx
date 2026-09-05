import Link from 'next/link';
import ProspectForm from '@/components/workspace/ProspectForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';
import { resolveAcquisitionState } from '@/lib/acquisition/state';
import { resolveAcquisitionPresentation } from '@/lib/presentation/operatingState';
import { SignalStrip, WorkQueue } from '@/components/workspace/OperationalUI';

function dateTime(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not yet';
}
function ownerLabel(presentation:any){
  if(presentation.waitingOn?.actor==='partner')return 'Delivery Partner';
  if(presentation.waitingOn?.actor==='client')return 'Client';
  return 'Your team';
}

export default async function AcquisitionPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const activeProspects = supabase.from('prospects').select('*',{count:'exact'}).eq('organisation_id',organisationId).neq('status','converted');
  const [prospectsResult, companies, contacts] = await Promise.all([
    activeProspects.order('created_at',{ascending:false}).limit(500),
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
  const rows=prospects.slice(0,12).map((prospect:any)=>{
    const session=sessionByProspect.get(prospect.id);const request=requestByProspect.get(prospect.id);const decision=request?decisionMap.get(String(request.id)):null;
    const state=resolveAcquisitionState({prospectStatus:prospect.status,hasSession:Boolean(session),sessionStatus:session?.status,hasSubmission:Boolean(session&&submissionSet.has(String(session.id))),convertedCaseId:prospect.converted_lead_id,hasPartnerRequest:Boolean(request),partnerRequestStatus:request?.status,hasPartnerResponse:Boolean(request&&responseSet.has(String(request.id))),partnerDecision:decision?.decision,hasPartnerPricing:Boolean(request&&priceSet.has(String(request.id)))});
    return {prospect,session,presentation:resolveAcquisitionPresentation(state)};
  });
  const approvalCount=rows.filter(row=>row.presentation.approval?.required).length;
  const now=Date.now();
  const followUpsDue=prospects.filter((item:any)=>item.next_follow_up_at&&new Date(item.next_follow_up_at).getTime()<=now&&!['paused','replied'].includes(String(item.outreach_status))).length;
  const repliesWaiting=prospects.filter((item:any)=>item.outreach_status==='replied'&&item.response_outcome==='interested').length;
  const linksSent=(sessionsResult.data||[]).filter((item:any)=>item.sent_at).length;
  const outreachStarted=prospects.filter((item:any)=>item.outreach_status&&item.outreach_status!=='not_contacted').length;
  const queueItems=rows.map(({prospect,session,presentation}:any)=>({
    id:prospect.id,
    label:presentation.state,
    title:prospect.company_name,
    detail:presentation.summary,
    owner:ownerLabel(presentation),
    meta:session?.submitted_at?`Requirements received ${dateTime(session.submitted_at)}`:prospect.requirement_summary||prospect.source,
    href:`/workspace/acquisition/${prospect.id}`,
    actionLabel:presentation.nextAction.label,
    tone:presentation.tone,
  }));

  return <section className="saas-page acquisition-workspace">
    <section className="saas-hero">
      <div className="saas-hero__inner">
        <div className="saas-hero__copy"><p className="vp-kicker">Opportunities</p><h1>Move incoming work forward.</h1><p className="vp-subtitle">See who owns the next step, what is waiting, and which opportunity can move now.</p></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="button secondary" href="/workspace/acquisition/prospects">All opportunities</Link><Link className="button secondary" href="/workspace/assessments?view=partner">Delivery reviews</Link><Link className="button secondary" href="/workspace/approvals">Approvals{approvalCount?` · ${approvalCount}`:''}</Link></div>
      </div>
    </section>

    {params.created ? <div className="vp-callout" data-continuity-notice><strong>Opportunity added</strong><p>The new opportunity is ready to work.</p></div> : null}
    {params.error ? <div className="vp-callout" data-continuity-notice><strong>Couldn’t complete that action</strong><p>{String(params.error)}</p></div> : null}

    <SignalStrip items={[
      {label:'Follow-ups due',value:followUpsDue,detail:'LinkedIn actions due now',tone:followUpsDue?'attention':'complete'},
      {label:'Replies to progress',value:repliesWaiting,detail:'Interested replies awaiting action',tone:repliesWaiting?'active':'neutral'},
      {label:'Secure links sent',value:linksSent,detail:'Requirements requests created',tone:linksSent?'complete':'neutral'},
      {label:'Outreach started',value:outreachStarted,detail:`${prospects.length} active opportunities`,tone:outreachStarted?'active':'neutral'},
    ]}/>

    <details id="manual-prospect" className="vp-disclosure"><summary>Add opportunity</summary><div>{companies.length ? <ProspectForm companies={companies} contacts={contacts} /> : <div className="vp-empty">Add a company before creating an opportunity. <Link href="/workspace/companies">Add company →</Link></div>}</div></details>

    <WorkQueue title="Opportunity queue" eyebrow="Active work" items={queueItems} empty="No active opportunities." viewAllHref="/workspace/acquisition/prospects" viewAllLabel="View all opportunities" />
  </section>;
}
