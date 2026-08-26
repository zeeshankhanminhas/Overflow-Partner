import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { WorkspaceContextLinks } from '@/components/workspace/WorkspaceRecordMenu';
import { ProductMetric, ProductMetrics, ProductPageHeader, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

function SettingRow({title,description,href,meta,related=[]}:{title:string;description:string;href:string;meta:string;related?:Array<{label:string;href:string;detail?:string}>}){
  return <div className="product-register-row"><div><strong>{title}</strong><p>{description}</p></div><ProductStatus>{meta}</ProductStatus><span/><div className="interaction-context-actions"><WorkspaceDrawer triggerLabel="Inspect" eyebrow="Workspace setting" title={title} description={description} footer={<Link className="button" href={href}>Open setting</Link>}><p className="interaction-summary__lead">Configuration stays bounded to this administrative area. Workflow authority remains with the operating record that owns the business rule.</p><WorkspaceContextLinks links={[{label:`Open ${title}`,href,detail:meta},...related]}/></WorkspaceDrawer><Link className="button secondary" href={href}>Open</Link></div></div>;
}

export default async function WorkspaceSettingsPage(){
  const {supabase,organisationId,profile}=await requireUserContext();const [{data:organisation},{data:developerDelete}]=await Promise.all([supabase.from('organisations').select('name').eq('id',organisationId).maybeSingle(),supabase.rpc('op_can_delete_test_data')]);const canDeleteTestData=developerDelete===true;
  return <section className="vp-page"><ProductPageHeader eyebrow="Admin · Settings" title="Workspace settings" description="Manage organisation-level preferences and supporting control surfaces without mixing configuration into day-to-day operating records." />
    <ProductMetrics label="Workspace account summary"><ProductMetric label="Organisation" value={organisation?.name||'Organisation'} detail="Current workspace tenant" /><ProductMetric label="User" value={profile.full_name||'Workspace user'} detail="Signed-in operator" /><ProductMetric label="Role" value={profile.role||'Not recorded'} detail="Workspace permission role" /><ProductMetric label="Account" value={profile.is_active===false?'Inactive':'Active'} detail="User access state" tone={profile.is_active===false?'blocked':'complete'} /></ProductMetrics>
    <section><ProductSectionHeader eyebrow="Administration" title="Manage the workspace" meta="Inspect context first; open a setting only when configuration work is required." /><div className="product-register">
      <SettingRow title="Attention Centre" meta="Messages" description="Review operational attention alongside sent, scheduled and failed workspace messages." href="/workspace/notifications" related={[{label:'Messages',href:'/workspace/communications',detail:'Business correspondence'},{label:'Issues',href:'/workspace/exceptions',detail:'Operational exceptions'}]} />
      <SettingRow title="Partner network" meta="Commercial" description="Manage execution partners, readiness and NDA status." href="/workspace/partners" related={[{label:'Partner assessments',href:'/workspace/assessments',detail:'Technical suitability'},{label:'Commercial control',href:'/workspace/commercial-control',detail:'Partner cost context'}]} />
      <SettingRow title="Document control" meta="Operations" description="Browse current revisions, controlled issues and historical records." href="/workspace/documents" related={[{label:'Approvals',href:'/workspace/approvals',detail:'Document authority decisions'},{label:'Projects',href:'/workspace/projects',detail:'Delivery-owned evidence'}]} />
      <SettingRow title="Risk & Compliance" meta="Assurance" description="Review business risks, controls and compliance requirements." href="/workspace/risk" related={[{label:'Executive view',href:'/workspace/intelligence',detail:'Management signals'},{label:'Issues',href:'/workspace/exceptions',detail:'Off-plan conditions'}]} />
      {canDeleteTestData?<SettingRow title="Test data cleanup" meta="Developer" description="Permanently remove selected test records from this workspace." href="/workspace/settings/developer-data" related={[{label:'Mission Control',href:'/workspace',detail:'Return to live operations'}]} />:null}
    </div></section>
    <div className="product-notice"><strong>Governance stays with the source record.</strong><div>Workflow stages, approvals, pricing gates and document status rules are controlled in the operating area that owns them, not through global settings.</div></div>
  </section>;
}
