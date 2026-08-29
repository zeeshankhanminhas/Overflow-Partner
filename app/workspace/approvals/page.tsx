import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getApprovalQueue, summariseApprovalQueue } from '@/lib/presentation/approvals';
import { ContextActions, InteractionFact, InteractionFacts, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { WorkspaceContextLinks, WorkspaceRecordMenu } from '@/components/workspace/WorkspaceRecordMenu';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

function money(value:number,currency='GBP'){try{return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(value)}catch{return `${currency} ${value.toFixed(2)}`}}
function age(value:string){const ms=Math.max(0,Date.now()-new Date(value).getTime());const hours=Math.floor(ms/3600000);if(hours<1)return 'Just now';if(hours<24)return `${hours}h`;const days=Math.floor(hours/24);return `${days}d`;}
function sourceLabel(source:string){return source==='acquisition'?'Opportunity':source==='commercial'?'Commercial review':source==='document'?'Document':'Payment'}
function sourceLinks(source:string){if(source==='commercial')return [{label:'Opportunities',href:'/workspace/leads',detail:'Commercial source records'},{label:'Client quotes',href:'/workspace/quotes',detail:'Approved and issued quotes'}];if(source==='document')return [{label:'Documents',href:'/workspace/documents',detail:'Document register'},{label:'Opportunities',href:'/workspace/leads',detail:'Related pre-project work'}];if(source==='payments')return [{label:'Payments',href:'/workspace/payments',detail:'Payment evidence'},{label:'Commercials',href:'/workspace/commercial-control',detail:'Commercial authority'}];return [{label:'Opportunities',href:'/workspace/acquisition',detail:'Pre-project work'},{label:'Commercial workspace',href:'/workspace/leads',detail:'Qualified opportunities'}]}

export default async function ApprovalsPage(){
  const {supabase,organisationId}=await requireUserContext();
  const approvals=await getApprovalQueue(supabase,organisationId);
  const summary=summariseApprovalQueue(approvals);
  const ready=approvals.filter(item=>item.status==='ready');
  const blocked=approvals.filter(item=>item.status==='blocked');
  const focus=ready[0]||blocked[0]||null;

  return <section className="vp-page approvals-workspace approvals-reference-workspace">
    <ProductPageHeader eyebrow="Decisions" title="Approvals" description="Review decisions that need your authority, understand why they are required, then act on the owning record." actions={<Link className="button secondary" href="/workspace">Workspace</Link>} />

    <ProductMetrics label="Approval position">
      <ProductMetric label="Ready for decision" value={summary.ready} detail="Evidence complete" tone={summary.ready?'waiting':'complete'} />
      <ProductMetric label="Needs information" value={summary.blocked} detail="Cannot be approved yet" tone={summary.blocked?'attention':'complete'} />
      <ProductMetric label="Total decisions" value={summary.total} detail="Across active work" tone={summary.total?'active':'complete'} />
      <ProductMetric label="Value represented" value={money(summary.value)} detail="Commercial and payment decisions" tone="neutral" />
    </ProductMetrics>

    <section className="approval-principle" aria-label="Approval operating rule"><strong>One decision, one source of truth.</strong><p>This queue gives the approver enough context to decide confidently. The final action remains on the owning opportunity, document, commercial or payment record so the audit trail is never split.</p></section>

    <div className="approval-reference-grid">
      <main className="approval-reference-grid__queue">
        <ProductSectionHeader eyebrow="Decision queue" title="Needs your attention" meta={`${ready.length} ready · ${blocked.length} waiting for information`} />
        {ready.length?<ProductRegister className="approvals-register">
          {ready.map(item=>{const related=[{label:'Open decision',href:item.href,detail:item.recordLabel},...sourceLinks(item.source)];return <ProductRegisterRow key={item.id}>
            <ProductStatus tone="waiting">Needs decision</ProductStatus>
            <div><strong>{item.title}</strong><p>{item.recordLabel}</p><small>{item.reason}</small></div>
            <div><small>Decision</small><strong style={{display:'block',marginTop:3}}>{item.type}</strong></div>
            <div><small>Waiting</small><strong style={{display:'block',marginTop:3}}>{age(item.createdAt)}</strong></div>
            <div>{item.value!==undefined?<><small>Value</small><strong style={{display:'block',marginTop:3}}>{money(item.value,item.currency)}</strong></>:<><small>Source</small><strong style={{display:'block',marginTop:3}}>{sourceLabel(item.source)}</strong></>}</div>
            <ContextActions label={`Approval actions for ${item.title}`}>
              <WorkspaceDrawer triggerLabel="Inspect" eyebrow="Decision context" title={item.title} description={item.reason} footer={<Link className="button" href={item.href}>Open decision</Link>}>
                <InteractionFacts><InteractionFact label="Decision">{item.type}</InteractionFact><InteractionFact label="Record">{item.recordLabel}</InteractionFact><InteractionFact label="Source">{sourceLabel(item.source)}</InteractionFact><InteractionFact label="Waiting">{age(item.createdAt)}</InteractionFact><InteractionFact label="Value">{item.value!==undefined?money(item.value,item.currency):'Not value-based'}</InteractionFact><InteractionFact label="Readiness">Ready for decision</InteractionFact></InteractionFacts>
                <p className="interaction-summary__lead">Review the reason, value and source here. Open the decision only when you are ready to approve, request changes or decline on the authoritative record.</p>
                <WorkspaceContextLinks title="Related context" links={related}/>
              </WorkspaceDrawer>
              <Link className="button secondary" href={item.href}>Open</Link>
              <WorkspaceRecordMenu label={`More context for ${item.title}`} links={related}/>
            </ContextActions>
          </ProductRegisterRow>})}
        </ProductRegister>:<ProductEmptyState title="No approvals waiting" description="Decisions will appear here when their underlying evidence is ready." />}

        {blocked.length?<section className="approval-reference-grid__blocked"><ProductSectionHeader eyebrow="Waiting for information" title="Not ready to decide" meta={`${blocked.length} blocked`} /><ProductRegister className="approvals-register approvals-register--blocked">
          {blocked.map(item=>{const related=[{label:'Open source record',href:item.href,detail:'Resolve missing information'},...sourceLinks(item.source)];return <ProductRegisterRow key={item.id}>
            <ProductStatus tone="attention">Information needed</ProductStatus><div><strong>{item.title}</strong><p>{item.recordLabel}</p><small>{item.reason}</small></div><div><small>Decision</small><strong style={{display:'block',marginTop:3}}>{item.type}</strong></div><div><small>Waiting</small><strong style={{display:'block',marginTop:3}}>{age(item.createdAt)}</strong></div><div />
            <ContextActions label={`Blocked approval actions for ${item.title}`}>
              <WorkspaceDrawer triggerLabel="Why blocked?" eyebrow="Decision blocked" title={item.title} description="See what is missing before opening the source record." footer={<Link className="button" href={item.href}>Resolve on source record</Link>}>
                <InteractionFacts><InteractionFact label="Decision">{item.type}</InteractionFact><InteractionFact label="Record">{item.recordLabel}</InteractionFact><InteractionFact label="Source">{sourceLabel(item.source)}</InteractionFact><InteractionFact label="Waiting">{age(item.createdAt)}</InteractionFact></InteractionFacts>
                <div className="product-notice product-notice--attention"><strong>Information still required</strong><div>{item.reason}</div></div><WorkspaceContextLinks title="Resolve through" links={related}/>
              </WorkspaceDrawer>
              <Link className="button secondary" href={item.href}>Resolve</Link><WorkspaceRecordMenu label={`More context for ${item.title}`} links={related}/>
            </ContextActions>
          </ProductRegisterRow>})}
        </ProductRegister></section>:null}
      </main>

      <aside className="approval-reference-rail" aria-label="Decision focus">
        {focus?<>
          <ProductStatus tone={focus.status==='ready'?'waiting':'attention'}>{focus.status==='ready'?'Needs decision':'Information needed'}</ProductStatus>
          <p className="vp-kicker">Decision focus</p><h2>{focus.title}</h2><p className="approval-reference-rail__lead">{focus.reason}</p>
          <div className="approval-reference-rail__facts"><div><small>Decision</small><strong>{focus.type}</strong></div><div><small>Record</small><strong>{focus.recordLabel}</strong></div><div><small>Source</small><strong>{sourceLabel(focus.source)}</strong></div><div><small>Waiting</small><strong>{age(focus.createdAt)}</strong></div>{focus.value!==undefined?<div><small>Value</small><strong>{money(focus.value,focus.currency)}</strong></div>:null}</div>
          <div className="approval-reference-rail__rule"><strong>{focus.status==='ready'?'Why you can decide now':'Why you cannot decide yet'}</strong><p>{focus.status==='ready'?'The required evidence is complete. Review the source record before making the final decision.':focus.reason}</p></div>
          <Link className="button" href={focus.href}>{focus.status==='ready'?'Open decision':'Resolve missing information'}</Link>
          <WorkspaceContextLinks title="Related records" links={sourceLinks(focus.source)}/>
        </>:<ProductEmptyState title="Nothing needs approval" description="The approval rail will focus the next decision when one becomes available." />}
      </aside>
    </div>
  </section>;
}
