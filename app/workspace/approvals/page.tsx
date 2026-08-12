import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getApprovalQueue, summariseApprovalQueue } from '@/lib/presentation/approvals';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

function money(value:number,currency='GBP'){try{return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(value)}catch{return `${currency} ${value.toFixed(2)}`}}
function age(value:string){const ms=Math.max(0,Date.now()-new Date(value).getTime());const hours=Math.floor(ms/3600000);if(hours<1)return 'Just now';if(hours<24)return `${hours}h`;const days=Math.floor(hours/24);return `${days}d`;}
function sourceLabel(source:string){return source==='acquisition'?'Acquisition':source==='commercial'?'Commercial':source==='document'?'Document control':'Payments'}

export default async function ApprovalsPage(){
  const {supabase,organisationId}=await requireUserContext();
  const approvals=await getApprovalQueue(supabase,organisationId);
  const summary=summariseApprovalQueue(approvals);
  const ready=approvals.filter(item=>item.status==='ready');
  const blocked=approvals.filter(item=>item.status==='blocked');

  return <section className="vp-page approvals-workspace">
    <ProductPageHeader
      eyebrow="Authority · Decisions"
      title="Approvals"
      description="One place for decisions that require explicit authority. The underlying record remains the source of truth."
      actions={<Link className="button secondary" href="/workspace">Mission Control</Link>}
    />

    <ProductMetrics label="Approval position">
      <ProductMetric label="Ready for decision" value={summary.ready} detail="Evidence complete" tone={summary.ready?'waiting':'complete'} />
      <ProductMetric label="Blocked approvals" value={summary.blocked} detail="Evidence still required" tone={summary.blocked?'attention':'complete'} />
      <ProductMetric label="Total decisions" value={summary.total} detail="Across the operating system" tone={summary.total?'active':'complete'} />
      <ProductMetric label="Value represented" value={money(summary.value)} detail="Commercial and payable decisions" tone="neutral" />
    </ProductMetrics>

    <section className="approval-principle" aria-label="Approval operating rule">
      <strong>Approvals do not create a second workflow.</strong>
      <p>Each decision is completed in its authoritative Case, document, commercial or payment record. This queue only tells authorised operators what needs a decision now.</p>
    </section>

    <section>
      <ProductSectionHeader eyebrow="Decision queue" title="Ready for approval" meta={`${ready.length} ready`} />
      {ready.length?<ProductRegister className="approvals-register">
        {ready.map(item=><ProductRegisterRow href={item.href} key={item.id}>
          <ProductStatus tone="waiting">{item.type}</ProductStatus>
          <div><strong>{item.title}</strong><p>{item.recordLabel}</p><small>{item.reason}</small></div>
          <div><small>Source</small><strong style={{display:'block',marginTop:3}}>{sourceLabel(item.source)}</strong></div>
          <div><small>Waiting</small><strong style={{display:'block',marginTop:3}}>{age(item.createdAt)}</strong></div>
          <div>{item.value!==undefined?<><small>Value</small><strong style={{display:'block',marginTop:3}}>{money(item.value,item.currency)}</strong></>:null}</div>
          <strong>Review →</strong>
        </ProductRegisterRow>)}
      </ProductRegister>:<ProductEmptyState title="No approvals waiting" description="Authority decisions will appear here only when their underlying evidence is ready." />}
    </section>

    {blocked.length?<section>
      <ProductSectionHeader eyebrow="Not ready" title="Blocked approvals" meta={`${blocked.length} blocked`} />
      <ProductRegister className="approvals-register approvals-register--blocked">
        {blocked.map(item=><ProductRegisterRow href={item.href} key={item.id}>
          <ProductStatus tone="attention">Evidence needed</ProductStatus>
          <div><strong>{item.title}</strong><p>{item.recordLabel}</p><small>{item.reason}</small></div>
          <div><small>Approval</small><strong style={{display:'block',marginTop:3}}>{item.type}</strong></div>
          <div><small>Waiting</small><strong style={{display:'block',marginTop:3}}>{age(item.createdAt)}</strong></div>
          <div />
          <strong>Resolve →</strong>
        </ProductRegisterRow>)}
      </ProductRegister>
    </section>:null}
  </section>;
}
