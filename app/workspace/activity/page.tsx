import { requireUserContext } from '@/lib/auth/context';
import { listActivity } from '@/lib/repositories/workflow';
import { BusinessActivityTimeline } from '@/components/workspace/OperationalObjects';
import { SignalStrip } from '@/components/workspace/OperationalUI';
import { ProductPageHeader } from '@/components/workspace/ProductUI';

export default async function Page(){
  const {supabase,organisationId}=await requireUserContext();
  const events=await listActivity(supabase,organisationId,200);
  const today=new Date().toDateString();
  const todayCount=events.filter(event=>new Date(event.created_at).toDateString()===today).length;
  const entityTypes=new Set(events.map(event=>event.entity_type)).size;
  const items=events.map(event=>({
    id:event.id,
    at:event.created_at,
    eventType:event.event_type,
    detail:<span>{event.entity_type==='lead'?'Opportunity':event.entity_type==='project'?'Project':event.entity_type==='document'?'Document':event.entity_type} · {event.entity_id}</span>,
    source:event.entity_type==='lead'?'Opportunity':event.entity_type==='project'?'Project':event.entity_type==='document'?'Document':'Workspace',
  }));
  return <section className="vp-page activity-workspace">
    <ProductPageHeader eyebrow="Activity" title="What changed across the workspace" description="A business-readable history of important actions. Technical event names stay behind the presentation layer; each object keeps the same activity language." />
    <SignalStrip items={[
      {label:'Events shown',value:events.length,detail:'Latest business activity',tone:events.length?'active':'complete'},
      {label:'Today',value:todayCount,detail:'Actions recorded today',tone:todayCount?'active':'neutral'},
      {label:'Object types',value:entityTypes,detail:'Opportunities, projects and documents'},
      {label:'Language',value:'Business',detail:'Technical event names translated'},
    ]}/>
    <section className="op-ui-panel activity-workspace__timeline"><header className="op-ui-panel__header"><div><p className="op-ui-eyebrow">Timeline</p><h3>Recent activity</h3></div><span>{events.length} events</span></header><BusinessActivityTimeline items={items}/></section>
  </section>;
}
