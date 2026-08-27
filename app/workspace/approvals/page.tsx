import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getApprovalQueue, summariseApprovalQueue } from '@/lib/presentation/approvals';
import { ContextActions, InteractionFact, InteractionFacts, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { WorkspaceContextLinks, WorkspaceRecordMenu } from '@/components/workspace/WorkspaceRecordMenu';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

function money(value:number,currency='GBP'){try{return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(value)}catch{return `${currency} ${value.toFixed(2)}`}}
function age(value:string){const ms=Math.max(0,Date.now()-new Date(value).getTime());const hours=Math.floor(ms/3600000);if(hours<1)return 'Just now';if(hours<24)return `${hours}h`;const days=Math.floor(hours/24);return `${days}d`;}
function sourceLabel(source:string){return source==='acquisition'?'Acquisition':source==='commercial'?'Commercial':source==='document'?'Document control':'Payments'}
function sourceLinks(source:string){if(source==='commercial')return [{label:'Cases',href:'/workspace/leads',detail:'Commercial source records'},{label:'Client quotes',href:'/workspace/quotes',detail:'Controlled quote register'}];if(source==='document')return [{label:'Documents',href:'/workspace/documents',detail:'Controlled document register'},{label:'Cases',href:'/workspace/leads',detail:'Pre-project source records'}];if(source==='payments')return [{label:'Payments',href:'/workspace/payments',detail:'Settlement evidence'},{label:'Commercial control',href:'/workspace/commercial-control',detail:'Commercial authority'}];return [{label:'Enquiries',href:'/workspace/acquisition',detail:'Qualification source'},{label:'Cases',href:'/workspace/leads',detail:'Qualified work'}]}

export default async function ApprovalsPage(){
  const {supabase,organisationId}=await requireUserContext();
  const approvals=await getApprovalQueue(supabase,organisationId);
  const summary=summariseApprovalQueue(approvals);
  const ready=approvals.filter(item=>item.status==='ready');
  const blocked=approvals.filter(item=>item.status==='blocked');

  return <section className="vp-page approvals-workspace">
    <ProductPageHeader eyebrow="Authority · Decisions" title="Approvals" description="One place for decisions that require explicit authority. Inspect the evidence here; the owning record remains the source of truth." actions={<Link className="button secondary" href="/workspace">Mission Control</Link>} />

    <ProductMetrics label="Approval position">
      <ProductMetric label="Ready for decision" value={summary.ready} detail="Evidence complete" tone={summary.ready?'waiting':'complete'} />
      <ProductMetric label="Blocked approvals" value={summary.blocked} detail="Evidence still required" tone={summary.blocked?'attention':'complete'} />
      <ProductMetric label="Total decisions" value={summary.total} detail="Across the operating system" tone={summary.total?'active':'complete'} />
      <ProductMetric label="Value represented" value={money(summary.value)} detail="Commercial and payable decisions" tone="neutral" />
    </ProductMetrics>

    <section className="approval-principle" aria-label="Approval operating rule"><strong>Approvals do not create a second workflow.</strong><p>Inspect the decision and evidence without leaving this queue. Open the authoritative Case, document, commercial or payment record only when you are ready to perform the decision.</p></section>

    <section>
      <ProductSectionHeader eyebrow="Decision queue" title="Ready for approval" meta={`${ready.length} ready`} />
      {ready.length?<ProductRegister className="approvals-register">
        {ready.map(item=>{const related=[{label:'Open authoritative record',href:item.href,detail:item.recordLabel},...sourceLinks(item.source)];return <ProductRegisterRow key={item.id}>
          <ProductStatus tone="waiting">{item.type}</ProductStatus>
          <div><strong>{item.title}</strong><p>{item.recordLabel}</p><small>{item.reason}</small></div>
          <div><small>Source</small><strong style={{display:'block',marginTop:3}}>{sourceLabel(item.source)}</strong></div>
          <div><small>Waiting</small><strong style={{display:'block',marginTop:3}}>{age(item.createdAt)}</strong></div>
          <div>{item.value!==undefined?<><small>Value</small><strong style={{display:'block',marginTop:3}}>{money(item.value,item.currency)}</strong></>:null}</div>
          <ContextActions label={`Approval actions for ${item.title}`}>
            <WorkspaceDrawer triggerLabel="Inspect" eyebrow="Ready for approval" title={item.title} description={item.reason} footer={<Link className="button" href={item.href}>Open authoritative record</Link>}>
              <InteractionFacts><InteractionFact label="Decision">{item.type}</InteractionFact><InteractionFact label="Record">{item.recordLabel}</InteractionFact><InteractionFact label="Source">{sourceLabel(item.source)}</InteractionFact><InteractionFact label="Waiting">{age(item.createdAt)}</InteractionFact><InteractionFact label="Value">{item.value!==undefined?money(item.value,item.currency):'Not value-based'}</InteractionFact><InteractionFact label="Readiness">Evidence complete</InteractionFact></InteractionFacts>
              <p className="interaction-summary__lead">The drawer is review context only. The actual governed decision stays on the owning record so there is still one source of truth.</p>
              <WorkspaceContextLinks title="Decision context" links={related}/>
            </WorkspaceDrawer>
            <Link className="button secondary" href={item.href}>Open</Link>
            <WorkspaceRecordMenu label={`More context for ${item.title}`} links={related}/>
          </ContextActions>
        </ProductRegisterRow>})}
      </ProductRegister>:<ProductEmptyState title="No approvals waiting" description="Authority decisions will appear here only when their underlying evidence is ready." />}
    </section>

    {blocked.length?<section><ProductSectionHeader eyebrow="Not ready" title="Blocked approvals" meta={`${blocked.length} blocked`} /><ProductRegister className="approvals-register approvals-register--blocked">
      {blocked.map(item=>{const related=[{label:'Open source record',href:item.href,detail:'Resolve missing evidence'},...sourceLinks(item.source)];return <ProductRegisterRow key={item.id}>
        <ProductStatus tone="attention">Evidence needed</ProductStatus><div><strong>{item.title}</strong><p>{item.recordLabel}</p><small>{item.reason}</small></div><div><small>Approval</small><strong style={{display:'block',marginTop:3}}>{item.type}</strong></div><div><small>Waiting</small><strong style={{display:'block',marginTop:3}}>{age(item.createdAt)}</strong></div><div />
        <ContextActions label={`Blocked approval actions for ${item.title}`}>
          <WorkspaceDrawer triggerLabel="Why blocked?" eyebrow="Approval blocked" title={item.title} description="Inspect the missing evidence without leaving the approval queue." footer={<Link className="button" href={item.href}>Open source record</Link>}>
            <InteractionFacts><InteractionFact label="Decision">{item.type}</InteractionFact><InteractionFact label="Record">{item.recordLabel}</InteractionFact><InteractionFact label="Source">{sourceLabel(item.source)}</InteractionFact><InteractionFact label="Waiting">{age(item.createdAt)}</InteractionFact></InteractionFacts>
            <div className="product-notice product-notice--attention"><strong>Evidence still required</strong><div>{item.reason}</div></div><WorkspaceContextLinks title="Resolve through" links={related}/>
          </WorkspaceDrawer>
          <Link className="button secondary" href={item.href}>Resolve</Link><WorkspaceRecordMenu label={`More context for ${item.title}`} links={related}/>
        </ContextActions>
      </ProductRegisterRow>})}
    </ProductRegister></section>:null}
  </section>;
}
