import { requireUserContext } from '@/lib/auth/context';
import { listActivity } from '@/lib/repositories/workflow';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

export default async function Page(){
  const {supabase,organisationId}=await requireUserContext();
  const events=await listActivity(supabase,organisationId,200);
  const today=new Date().toDateString();
  const todayCount=events.filter(event=>new Date(event.created_at).toDateString()===today).length;
  const entityTypes=new Set(events.map(event=>event.entity_type)).size;
  return <section className="vp-page">
    <ProductPageHeader eyebrow="Admin · Audit" title="Activity audit" description="A cross-workspace audit trail of important operating events. Record-specific history remains attached to the Prospect, Case or Project that owns it." />
    <ProductMetrics label="Audit summary"><ProductMetric label="Events shown" value={events.length} detail="Latest activity records"/><ProductMetric label="Today" value={todayCount} detail="Events recorded today"/><ProductMetric label="Record types" value={entityTypes} detail="Distinct entity classes"/><ProductMetric label="Scope" value="Workspace" detail="Cross-record audit view"/></ProductMetrics>
    <section><ProductSectionHeader eyebrow="Audit register" title="Recent activity" />{events.length?<ProductRegister>{events.map(event=><ProductRegisterRow key={event.id}><div><strong>{event.event_type.replaceAll('_',' ').replaceAll('.',' · ')}</strong><p>{event.entity_type} · {event.entity_id}</p></div><ProductStatus>Audit</ProductStatus><div><small>Recorded</small><strong style={{display:'block',marginTop:3}}>{new Date(event.created_at).toLocaleString('en-GB')}</strong></div><span/></ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No activity events" description="Governed workflow actions will appear here as the workspace is used."/>}</section>
  </section>;
}
