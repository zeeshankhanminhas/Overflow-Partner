import { requireUserContext } from '@/lib/auth/context';
import { listActivity } from '@/lib/repositories/workflow';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

function human(value:string){return String(value||'record').replaceAll('_',' ').replaceAll('.',' · ').replace(/\b\w/g,c=>c.toUpperCase())}

export default async function Page(){
  const {supabase,organisationId}=await requireUserContext();
  const events=await listActivity(supabase,organisationId,200);
  const today=new Date().toDateString();
  const todayCount=events.filter(event=>new Date(event.created_at).toDateString()===today).length;
  const entityTypes=new Set(events.map(event=>event.entity_type)).size;
  return <section className="vp-page">
    <ProductPageHeader eyebrow="Admin · Audit" title="Activity audit" description="A cross-workspace trace of important operating events. Technical record identifiers stay below the normal operator view." />
    <ProductMetrics label="Audit summary"><ProductMetric label="Events shown" value={events.length} detail="Latest activity records"/><ProductMetric label="Today" value={todayCount} detail="Events recorded today"/><ProductMetric label="Record types" value={entityTypes} detail="Distinct record classes"/><ProductMetric label="Scope" value="Workspace" detail="Cross-record audit view"/></ProductMetrics>
    <section><ProductSectionHeader eyebrow="Audit register" title="Recent activity" />{events.length?<ProductRegister>{events.map(event=><ProductRegisterRow key={event.id}><div><strong>{human(event.event_type)}</strong><p>{human(event.entity_type)} event</p></div><ProductStatus>Audit</ProductStatus><div><small>Recorded</small><strong style={{display:'block',marginTop:3}}>{new Date(event.created_at).toLocaleString('en-GB')}</strong></div><span/></ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No activity events" description="Governed workflow actions will appear here as the workspace is used."/>}</section>
  </section>;
}
