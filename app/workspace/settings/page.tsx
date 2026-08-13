import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { ProductMetric, ProductMetrics, ProductPageHeader, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

function SettingRow({title,description,href,meta}:{title:string;description:string;href:string;meta:string}){
  return <Link href={href} className="product-register-row"><div><strong>{title}</strong><p>{description}</p></div><ProductStatus>{meta}</ProductStatus><span/><strong>Open →</strong></Link>;
}

export default async function WorkspaceSettingsPage(){
  const {supabase,organisationId,profile}=await requireUserContext();
  const [{data:organisation},{data:developerDelete}]=await Promise.all([
    supabase.from('organisations').select('name').eq('id',organisationId).maybeSingle(),
    supabase.rpc('op_can_delete_test_data'),
  ]);
  const canDeleteTestData=developerDelete===true;

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Admin · Settings" title="Workspace settings" description="Administration only. Day-to-day operating areas stay in the workspace navigation instead of being duplicated here." />
    <ProductMetrics label="Workspace account summary">
      <ProductMetric label="Organisation" value={organisation?.name||'Organisation'} detail="Current workspace tenant" />
      <ProductMetric label="User" value={profile.full_name||'Workspace user'} detail="Signed-in operator" />
      <ProductMetric label="Role" value={profile.role||'Not recorded'} detail="Workspace permission role" />
      <ProductMetric label="Account" value={profile.is_active===false?'Inactive':'Active'} detail="User access state" tone={profile.is_active===false?'blocked':'complete'} />
    </ProductMetrics>
    <section>
      <ProductSectionHeader eyebrow="Administration" title="Manage access and developer controls" meta="Operational modules are intentionally not repeated in Settings." />
      <div className="product-register">
        <SettingRow title="Users & roles" meta="Access" description="Review workspace membership and permission roles." href="/workspace/users" />
        {canDeleteTestData?<SettingRow title="Test data cleanup" meta="Developer" description="Permanently remove selected test records from this workspace." href="/workspace/settings/developer-data" />:null}
      </div>
    </section>
    <div className="product-notice"><strong>Governance stays with the source record.</strong><div>Workflow stages, approvals, pricing gates and document status rules remain controlled in the operating area that owns them.</div></div>
  </section>;
}
