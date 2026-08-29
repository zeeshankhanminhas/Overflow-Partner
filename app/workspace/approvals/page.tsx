import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { getApprovalQueue, summariseApprovalQueue } from '@/lib/presentation/approvals';
import { ContextActions, InteractionFact, InteractionFacts, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { WorkspaceContextLinks } from '@/components/workspace/WorkspaceRecordMenu';
import { ProductPageHeader } from '@/components/workspace/ProductUI';
import { NextActionRail, SignalStrip, WorkQueue } from '@/components/workspace/OperationalUI';

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

  const readyItems=ready.map(item=>{
    const related=[{label:'Open decision',href:item.href,detail:item.recordLabel},...sourceLinks(item.source)];
    return {
      id:item.id,
      label:'Needs decision',
      title:item.title,
      detail:item.reason,
      owner:'Your team',
      meta:item.value!==undefined?`${sourceLabel(item.source)} · ${money(item.value,item.currency)}`:`${sourceLabel(item.source)} · ${age(item.createdAt)}`,
      href:item.href,
      actionLabel:'Open decision',
      tone:'waiting' as const,
      inspect:<ContextActions label={`Inspect ${item.title}`}><WorkspaceDrawer triggerLabel="Inspect" eyebrow="Decision context" title={item.title} description={item.reason} footer={<Link className="button" href={item.href}>Open decision</Link>}><InteractionFacts><InteractionFact label="Decision">{item.type}</InteractionFact><InteractionFact label="Record">{item.recordLabel}</InteractionFact><InteractionFact label="Source">{sourceLabel(item.source)}</InteractionFact><InteractionFact label="Waiting">{age(item.createdAt)}</InteractionFact><InteractionFact label="Value">{item.value!==undefined?money(item.value,item.currency):'Not value-based'}</InteractionFact></InteractionFacts><WorkspaceContextLinks title="Related context" links={related}/></WorkspaceDrawer></ContextActions>,
    };
  });
  const blockedItems=blocked.map(item=>({
    id:item.id,
    label:'Information needed',
    title:item.title,
    detail:item.reason,
    owner:'Your team',
    meta:`${sourceLabel(item.source)} · ${age(item.createdAt)}`,
    href:item.href,
    actionLabel:'Resolve',
    tone:'attention' as const,
  }));

  return <section className="vp-page approvals-workspace approvals-reference-workspace">
    <ProductPageHeader eyebrow="Decisions" title="Approvals" description="Review decisions that need your authority, understand why they are required, then act on the owning record." actions={<Link className="button secondary" href="/workspace">Workspace</Link>} />

    <SignalStrip items={[
      {label:'Ready for decision',value:summary.ready,detail:'Evidence complete',tone:summary.ready?'waiting':'complete'},
      {label:'Needs information',value:summary.blocked,detail:'Cannot be approved yet',tone:summary.blocked?'attention':'complete'},
      {label:'Total decisions',value:summary.total,detail:'Across active work',tone:summary.total?'active':'complete'},
      {label:'Value represented',value:money(summary.value),detail:'Commercial and payment decisions'},
    ]}/>

    <div className="approval-reference-grid">
      <main className="approval-reference-grid__queue">
        <WorkQueue title="Needs your attention" eyebrow="Decision queue" items={readyItems} empty="No approvals are ready for decision." />
        <WorkQueue title="Not ready to decide" eyebrow="Waiting for information" items={blockedItems} empty="No decisions are blocked by missing information." />
      </main>

      {focus?<NextActionRail
        title="Decision focus"
        actionLabel={focus.status==='ready'?'Open decision':'Resolve missing information'}
        href={focus.href}
        reason={focus.reason}
        owner="Your team"
        deadline={age(focus.createdAt)}
        consequence={focus.status==='ready'?'Approve, request changes or decline on the source record.':'Complete the missing information before making the decision.'}
        secondary={sourceLinks(focus.source).map(item=>({label:item.label,href:item.href}))}
      />:<NextActionRail title="Decision focus" actionLabel="Open workspace" href="/workspace" reason="Nothing needs approval right now." owner="Your team" consequence="The next ready decision will appear here automatically." />}
    </div>
  </section>;
}
