import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { resolveCaseQueuePresentation, resolvePartnerAssessmentQueuePresentation } from '@/lib/presentation/queueState';
import { ProductEmptyState, ProductFilterBar, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductStatus } from '@/components/workspace/ProductUI';

type View = 'technical' | 'partner';
type QueueRow = { id:string; title:string|null; company_name:string; contact_name:string|null; lead_status:string; workflow_stage:string; created_at:string; total_count:number|string };

export default async function AssessmentsPage({ searchParams }: { searchParams?: Promise<Record<string,string|undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const view: View = params.view === 'partner' ? 'partner' : 'technical';
  const { supabase, organisationId } = await requireUserContext();
  const [technicalResult,partnerRequestResult] = await Promise.all([
    supabase.rpc('op_case_queue',{p_organisation_id:organisationId,p_view:'assessment',p_limit:100,p_offset:0}),
    supabase.from('partner_review_requests').select('id,prospect_id,status,created_at,submitted_at,partner:partners(company_name),prospect:prospects(company_name,contact_name)').eq('organisation_id',organisationId).not('prospect_id','is',null).in('status',['invited','opened','in_progress','clarification_required','submitted']).order('created_at',{ascending:false}).limit(100),
  ]);
  if (technicalResult.error) throw new Error(`Technical assessment queue could not be loaded: ${technicalResult.error.message}`);
  if (partnerRequestResult.error) throw new Error(`Partner assessment queue could not be loaded: ${partnerRequestResult.error.message}`);

  const technicalCandidates=(technicalResult.data||[]) as QueueRow[];
  const technicalIds=technicalCandidates.map(row=>row.id);
  const projectLinks=technicalIds.length?await supabase.from('projects').select('lead_id').eq('organisation_id',organisationId).in('lead_id',technicalIds):{data:[] as any[]};
  const projectOwned=new Set((projectLinks.data||[]).map((item:any)=>String(item.lead_id)));
  const technical=technicalCandidates.filter(row=>!projectOwned.has(String(row.id))).map(row=>({row,presentation:resolveCaseQueuePresentation(row.workflow_stage)}));

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
  const rows=view==='technical'?technical:partner;
  const approvals=partner.filter(item=>item.presentation.approval?.required).length;
  const waiting=partner.filter(item=>item.presentation.tone==='waiting'&&!item.presentation.approval?.required).length;

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Work · Assessments" title="Assessment queue" description="Technical definition stays with Case 360. Pre-commercial Execution Partner assessment stays with Acquisition. The two workstreams are visible together without duplicating ownership." actions={<><Link className="button secondary" href="/workspace/approvals">Approvals{approvals?` · ${approvals}`:''}</Link><Link className="button secondary" href="/workspace/leads">All Cases</Link></>} />
    <ProductMetrics label="Assessment workload">
      <ProductMetric label="Technical basis" value={technical.length} detail="Case-owned technical work" tone={technical.length?'active':'neutral'} />
      <ProductMetric label="Partner assessments" value={partner.length} detail="Acquisition-owned external assessment" tone={partner.length?'active':'neutral'} />
      <ProductMetric label="Waiting on Partner" value={waiting} detail="Normal external dependency" tone={waiting?'waiting':'complete'} />
      <ProductMetric label="Decisions ready" value={approvals} detail="Go / No-Go authority" tone={approvals?'waiting':'complete'} />
    </ProductMetrics>
    <ProductFilterBar>
      <Link className={`button ${view==='technical'?'':'secondary'}`} href="/workspace/assessments?view=technical">Technical basis</Link>
      <Link className={`button ${view==='partner'?'':'secondary'}`} href="/workspace/assessments?view=partner">Partner Assessments</Link>
    </ProductFilterBar>

    {view==='technical' ? (technical.length===0 ? <ProductEmptyState title="No Cases need technical work" description="Cases appear here only while their technical basis needs definition or approval." action={<Link className="button secondary" href="/workspace/leads">Open Cases</Link>} /> : <ProductRegister>
      {technical.map(({row,presentation})=><ProductRegisterRow key={row.id} href={`/workspace/leads/${row.id}`}>
        <div><strong>{row.title||row.company_name}</strong><p>{row.company_name}{row.contact_name?` · ${row.contact_name}`:''}</p><small>{presentation.summary}</small></div>
        <ProductStatus tone={presentation.tone}>{presentation.state}</ProductStatus>
        <div><small>Owner</small><strong style={{display:'block',marginTop:3}}>Case 360</strong></div>
        <strong>{presentation.nextAction.label} →</strong>
      </ProductRegisterRow>)}
    </ProductRegister>) : (partner.length===0 ? <ProductEmptyState title="No Partner Assessments are active" description="Partner assessments appear here when Acquisition has released a technical package to an Execution Partner." action={<Link className="button secondary" href="/workspace/acquisition/prospects">Open Enquiries</Link>} /> : <ProductRegister>
      {partner.map(({request,presentation})=><ProductRegisterRow key={request.id} href={`/workspace/acquisition/${request.prospect_id}`}>
        <div><strong>{request.prospect?.company_name||'Enquiry'}</strong><p>{request.partner?.company_name||'Execution Partner'}{request.prospect?.contact_name?` · ${request.prospect.contact_name}`:''}</p><small>{presentation.summary}</small></div>
        <ProductStatus tone={presentation.tone}>{presentation.state}</ProductStatus>
        <div><small>{presentation.waitingOn?'Waiting on':'Owner'}</small><strong style={{display:'block',marginTop:3}}>{presentation.waitingOn?.label||'Acquisition'}</strong></div>
        <strong>{presentation.nextAction.label}{presentation.nextAction.available?' →':''}</strong>
      </ProductRegisterRow>)}
    </ProductRegister>)}
  </section>;
}
