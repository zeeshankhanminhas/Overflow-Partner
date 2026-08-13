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
    <ProductPageHeader eyebrow="Admin · Settings" title="Workspace settings" description="Manage organisation preferences and admin tools without mixing setup into day-to-day work." />
    <ProductMetrics label="Workspace account summary">
      <ProductMetric label="Organisation" value={organisation?.name||'Organisation'} detail="Current workspace" />
      <ProductMetric label="User" value={profile.full_name||'Workspace user'} detail="Signed-in operator" />
      <ProductMetric label="Role" value={profile.role||'Not recorded'} detail="Workspace permission role" />
      <ProductMetric label="Account" value={profile.is_active===false?'Inactive':'Active'} detail="User access state" tone={profile.is_active===false?'blocked':'complete'} />
    </ProductMetrics>
    <section>
      <ProductSectionHeader eyebrow="Administration" title="Manage the workspace" meta="Business rules stay with the records that use them." />
      <div className="product-register">
        <SettingRow title="Attention Centre" meta="Messages" description="Review operational attention alongside sent, scheduled and failed workspace messages." href="/workspace/notifications" />
        <SettingRow title="Partner network" meta="Commercial" description="Manage Partners, readiness and NDA status." href="/workspace/partners" />
        <SettingRow title="Documents" meta="Operations" description="Browse current revisions, issued documents and history." href="/workspace/documents" />
        <SettingRow title="Risk & Compliance" meta="Assurance" description="Review business risks and compliance requirements." href="/workspace/risk" />
        {canDeleteTestData?<SettingRow title="Test data cleanup" meta="Developer" description="Permanently remove selected test records from this workspace." href="/workspace/settings/developer-data" />:null}
      </div>
    </section>
    <div className="product-notice"><strong>Business rules stay with the source record.</strong><div>Workflow stages, approvals, pricing rules and document statuses are managed in the area that owns them, not in global settings.</div></div>
  </section>;
}