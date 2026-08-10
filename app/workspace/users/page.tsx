import { requireUserContext } from '@/lib/auth/context';
import { listProfiles } from '@/lib/repositories/workflow';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

function tone(active:boolean):ProductTone{return active?'complete':'blocked'}

export default async function Page(){
  const {supabase,organisationId}=await requireUserContext();
  const users=await listProfiles(supabase,organisationId);
  const active=users.filter(user=>user.is_active).length;
  const admins=users.filter(user=>user.role==='admin'||user.role==='owner').length;
  return <section className="vp-page">
    <ProductPageHeader eyebrow="Admin · Access" title="Users & roles" description="Review workspace membership, account state and current permission role. Full SaaS organisation administration belongs to the multi-tenant platform phase." />
    <ProductMetrics label="Workspace user summary"><ProductMetric label="Users" value={users.length} detail="Organisation members"/><ProductMetric label="Active" value={active} detail="Accounts currently enabled" tone={active?'complete':'neutral'}/><ProductMetric label="Admins / owners" value={admins} detail="Elevated workspace roles"/><ProductMetric label="Inactive" value={users.length-active} detail="Accounts not enabled" tone={users.length-active?'attention':'complete'}/></ProductMetrics>
    <section><ProductSectionHeader eyebrow="Access register" title="Organisation members" />{users.length?<ProductRegister>{users.map(user=><ProductRegisterRow key={user.id}><div><strong>{user.full_name||[user.first_name,user.last_name].filter(Boolean).join(' ')||user.email||'Unnamed user'}</strong><p>{user.email||'No email recorded'}</p></div><ProductStatus tone={tone(Boolean(user.is_active))}>{user.is_active?'Active':'Inactive'}</ProductStatus><div><small>Role</small><strong style={{display:'block',marginTop:3}}>{user.role.replaceAll('_',' ')}</strong></div><span/></ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No workspace users" description="Organisation membership will appear here when user profiles are available."/>}</section>
  </section>;
}
