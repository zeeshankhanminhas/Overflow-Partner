import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { resolvePartnerAssessmentQueuePresentation } from '@/lib/presentation/queueState';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductStatus } from '@/components/workspace/ProductUI';

export default async function AssessmentsPage() {
  const { supabase, organisationId } = await requireUserContext();
  const partnerRequestResult = await supabase.from('partner_review_requests')
    .select('id,prospect_id,status,created_at,submitted_at,partner:partners(company_name),prospect:prospects(company_name,contact_name)')
    .eq('organisation_id',organisationId)
    .not('prospect_id','is',null)
    .in('status',['invited','opened','in_progress','clarification_required','submitted'])
    .order('created_at',{ascending:false})
    .limit(100);

  if (partnerRequestResult.error) throw new Error(`Partner assessment queue could not be loaded: ${partnerRequestResult.error.message}`);

  const requests=(partnerRequestResult.data||[]) as any[];
  const requestIds=requests.map(item=>item.id);
  const [responsesResult,decisionsResult,pricesResult]=await Promise.all([
    requestIds.length?supabase.from('partner_review_responses').select('id,partner_review_request_id').eq('organisation_id',organisationId).in('partner_review_request_id',requestIds):Promise.resolve({data:[] as any[]}),
    requestIds.length?supabase.from('partner_review_internal_decisions').select('id,partner_review_request_id').eq('organisation_id',organisationId).in('partner_review_request_id',requestIds):Promise.resolve({data:[] as any[]}),
    requestIds.length?supabase.from('partner_quotes').select('id,partner_review_request_id,price').eq('organisation_id',organisationId).in('partner_review_request_id',requestIds):Promise.resolve({data:[] as any[]}),
  ]);
  const responseSet=new Set((responsesResult.data||[]).map((item:any)=>String(item.partner_review_request_id)));
  const decisionSet=new Set((decisionsResult.data||[]).map((item:any)=>String(item.partner_review_request_id)));
  const positivePriceSet=new Set((pricesResult.data||[]).filter((item:any)=>Number(item.price)>0).map((item:any)=>String(item.partner_review_request_id)));
  const partner=requests.map(request=>({request,presentation:resolvePartnerAssessmentQueuePresentation({requestStatus:request.status,hasResponse:responseSet.has(String(request.id)),hasDecision:decisionSet.has(String(request.id)),hasPositivePrice:positivePriceSet.has(String(request.id))})}));
  const approvals=partner.filter(item=>item.presentation.approval?.required).length;
  const waiting=partner.filter(item=>item.presentation.tone==='waiting'&&!item.presentation.approval?.required).length;
  const clarification=partner.filter(item=>item.request.status==='clarification_required').length;

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Work · Partner Assessments" title="Partner Assessments" description="Review Partner capability, capacity, timing and price before an enquiry becomes a Case." actions={<><Link className="button secondary" href="/workspace/approvals">Approvals{approvals?` · ${approvals}`:''}</Link><Link className="button secondary" href="/workspace/leads?view=assessment">Case technical work</Link></>} />
    <ProductMetrics label="Partner assessment workload">
      <ProductMetric label="Active assessments" value={partner.length} detail="Current Partner requests" tone={partner.length?'active':'neutral'} />
      <ProductMetric label="Waiting on Partner" value={waiting} detail="Waiting for a Partner response" tone={waiting?'waiting':'complete'} />
      <ProductMetric label="Clarification needed" value={clarification} detail="Partner needs more information" tone={clarification?'attention':'complete'} />
      <ProductMetric label="Decisions ready" value={approvals} detail="Go / No-Go decisions" tone={approvals?'waiting':'complete'} />
    </ProductMetrics>

    {partner.length===0 ? <ProductEmptyState title="No Partner Assessments are active" description="Assessments appear here when an enquiry is sent to a Partner for review." action={<Link className="button secondary" href="/workspace/acquisition/prospects">Open Enquiries</Link>} /> : <ProductRegister>
      {partner.map(({request,presentation})=><ProductRegisterRow key={request.id} href={`/workspace/acquisition/${request.prospect_id}`}>
        <div><strong>{request.prospect?.company_name||'Enquiry'}</strong><p>{request.partner?.company_name||'Execution Partner'}{request.prospect?.contact_name?` · ${request.prospect.contact_name}`:''}</p><small>{presentation.summary}</small></div>
        <ProductStatus tone={presentation.tone}>{presentation.state}</ProductStatus>
        <div><small>{presentation.waitingOn?'Waiting on':'Owner'}</small><strong style={{display:'block',marginTop:3}}>{presentation.waitingOn?.label||'Overflow Partner'}</strong></div>
        <strong>{presentation.nextAction.label}{presentation.nextAction.available?' →':''}</strong>
      </ProductRegisterRow>)}
    </ProductRegister>}
  </section>;
}