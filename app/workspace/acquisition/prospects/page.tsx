import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listProspects } from '@/lib/repositories/prospects';
import { resolveAcquisitionState } from '@/lib/acquisition/state';
import { resolveAcquisitionPresentation } from '@/lib/presentation/operatingState';
import { ContextActions, InteractionFact, InteractionFacts, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

export default async function ProspectRegisterPage(){
  const {supabase,organisationId}=await requireUserContext();
  const allProspects=await listProspects(supabase,organisationId);
  const prospects=allProspects.filter(item=>item.status!=='converted');
  const ids=prospects.map(item=>item.id);

  const [sessionsResult,requestsResult]=await Promise.all([
    ids.length?supabase.from('intake_sessions').select('id,prospect_id,status,created_at').eq('organisation_id',organisationId).in('prospect_id',ids).order('created_at',{ascending:false}):Promise.resolve({data:[] as any[]}),
    ids.length?supabase.from('partner_review_requests').select('id,prospect_id,status,created_at').eq('organisation_id',organisationId).in('prospect_id',ids).order('created_at',{ascending:false}):Promise.resolve({data:[] as any[]}),
  ]);
  const sessions=(sessionsResult.data||[]) as any[];const requests=(requestsResult.data||[]) as any[];
  const sessionMap=new Map<string,any>();for(const session of sessions)if(!sessionMap.has(String(session.prospect_id)))sessionMap.set(String(session.prospect_id),session);
  const requestMap=new Map<string,any>();for(const request of requests)if(!requestMap.has(String(request.prospect_id)))requestMap.set(String(request.prospect_id),request);
  const sessionIds=[...sessionMap.values()].map(item=>item.id);const requestIds=[...requestMap.values()].map(item=>item.id);
  const [submissionsResult,responsesResult,decisionsResult,pricesResult]=await Promise.all([
    sessionIds.length?supabase.from('intake_submissions').select('id,intake_session_id').eq('organisation_id',organisationId).in('intake_session_id',sessionIds):Promise.resolve({data:[] as any[]}),
    requestIds.length?supabase.from('partner_review_responses').select('id,partner_review_request_id').eq('organisation_id',organisationId).in('partner_review_request_id',requestIds):Promise.resolve({data:[] as any[]}),
    requestIds.length?supabase.from('partner_review_internal_decisions').select('partner_review_request_id,decision,created_at').eq('organisation_id',organisationId).in('partner_review_request_id',requestIds).order('created_at',{ascending:false}):Promise.resolve({data:[] as any[]}),
    requestIds.length?supabase.from('partner_quotes').select('partner_review_request_id,price').eq('organisation_id',organisationId).in('partner_review_request_id',requestIds):Promise.resolve({data:[] as any[]}),
  ]);
  const submissionSet=new Set((submissionsResult.data||[]).map((item:any)=>String(item.intake_session_id)));
  const responseSet=new Set((responsesResult.data||[]).map((item:any)=>String(item.partner_review_request_id)));
  const decisionMap=new Map<string,any>();for(const decision of decisionsResult.data||[])if(!decisionMap.has(String((decision as any).partner_review_request_id)))decisionMap.set(String((decision as any).partner_review_request_id),decision);
  const priceSet=new Set((pricesResult.data||[]).filter((item:any)=>Number(item.price)>0).map((item:any)=>String(item.partner_review_request_id)));

  const rows=prospects.map(item=>{
    const session=sessionMap.get(String(item.id));const request=requestMap.get(String(item.id));const decision=request?decisionMap.get(String(request.id)):null;
    const acquisition=resolveAcquisitionState({prospectStatus:item.status,hasSession:Boolean(session),sessionStatus:session?.status,hasSubmission:Boolean(session&&submissionSet.has(String(session.id))),convertedCaseId:String((item as any).converted_lead_id||''),hasPartnerRequest:Boolean(request),partnerRequestStatus:request?.status,hasPartnerResponse:Boolean(request&&responseSet.has(String(request.id))),partnerDecision:decision?.decision,hasPartnerPricing:Boolean(request&&priceSet.has(String(request.id)))});
    return {item,presentation:resolveAcquisitionPresentation(acquisition),session,request};
  });
  const waiting=rows.filter(row=>row.presentation.tone==='waiting').length;const decisions=rows.filter(row=>row.presentation.approval?.required).length;const active=rows.filter(row=>!['complete','neutral'].includes(row.presentation.tone)).length;

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Work · Acquisition" title="Enquiries" description="Choose an enquiry from the register. Inspect its operating position in a drawer first; open the full Enquiry only when you need to perform work." actions={<Link className="button secondary" href="/workspace/acquisition">Acquisition overview</Link>} />
    <ProductMetrics label="Enquiry summary">
      <ProductMetric label="Active work" value={active} detail="Internal work or evidence in progress" tone={active?'active':'neutral'} />
      <ProductMetric label="Waiting" value={waiting} detail="Client or Partner owns the next move" tone={waiting?'waiting':'complete'} />
      <ProductMetric label="Approvals" value={decisions} detail="Go / No-Go decisions ready" tone={decisions?'waiting':'complete'} />
      <ProductMetric label="Active enquiries" value={rows.length} detail="Converted records leave this register" />
    </ProductMetrics>
    <section>
      <ProductSectionHeader eyebrow="Enquiry register" title="Active opportunities" />
      {rows.length===0?<ProductEmptyState title="No active enquiries" description="Capture an enquiry in Acquisition to start the governed intake workflow." action={<Link className="button secondary" href="/workspace/acquisition#manual-prospect">Add enquiry</Link>} />:<ProductRegister>
        {rows.map(({item,presentation,session,request})=><ProductRegisterRow key={item.id}>
          <div><strong>{item.company_name}</strong><p>{item.contact_name||'Contact not recorded'} · {item.source}</p><small>{presentation.summary}</small></div>
          <ProductStatus tone={presentation.tone}>{presentation.state}</ProductStatus>
          <div><small>{presentation.waitingOn?'Waiting on':'Owner'}</small><strong style={{display:'block',marginTop:3}}>{presentation.waitingOn?.label||'Overflow Partner'}</strong></div>
          <ContextActions label={`Actions for ${item.company_name}`}>
            <WorkspaceDrawer triggerLabel="Inspect" eyebrow="Enquiry" title={item.company_name} description={presentation.summary} footer={<Link className="button" href={`/workspace/acquisition/${item.id}`}>Open Enquiry</Link>}>
              <InteractionFacts>
                <InteractionFact label="Operating state">{presentation.state}</InteractionFact>
                <InteractionFact label="Owner / waiting on">{presentation.waitingOn?.label||'Overflow Partner'}</InteractionFact>
                <InteractionFact label="Next action">{presentation.nextAction.label}</InteractionFact>
                <InteractionFact label="Outreach">{String((item as any).outreach_status||'not_contacted').replaceAll('_',' ')}</InteractionFact>
                <InteractionFact label="Follow-up">{(item as any).next_follow_up_at?new Date((item as any).next_follow_up_at).toLocaleString('en-GB'):'Not scheduled'}</InteractionFact>
                <InteractionFact label="Technical intake">{session?String(session.status).replaceAll('_',' '):'Not started'}</InteractionFact>
                <InteractionFact label="Partner assessment">{request?String(request.status).replaceAll('_',' '):'Not started'}</InteractionFact>
              </InteractionFacts>
              <p className="interaction-summary__lead">{presentation.nextAction.reason||presentation.summary}</p>
            </WorkspaceDrawer>
            <Link className="button secondary" href={`/workspace/acquisition/${item.id}`}>Open</Link>
          </ContextActions>
        </ProductRegisterRow>)}
      </ProductRegister>}
    </section>
  </section>;
}
