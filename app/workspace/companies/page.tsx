import CompanyForm from '@/components/workspace/CompanyForm';
import { ActionDialog } from '@/components/workspace/InteractionPrimitives';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { ProductEmptyState, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader } from '@/components/workspace/ProductUI';

export default async function CompaniesPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const params=searchParams?await searchParams:{};
  const {supabase,organisationId}=await requireUserContext();
  const companies=await listCompanies(supabase,organisationId);
  return <section className="vp-page">
    <ProductPageHeader eyebrow="CRM · Companies" title="Company register" description="Find the master customer and prospect company record used across Acquisition, Cases, Projects and controlled documents." actions={<ActionDialog title="Add company" triggerLabel="Add company" description="Create the master organisation record once; lifecycle state remains owned by the records that use it."><CompanyForm/></ActionDialog>} />
    {params.created?<ProductNotice title="Company created" tone="complete"><p>The company is now available across the workspace.</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Company could not be created" tone="blocked"><p>{String(params.error)}</p></ProductNotice>:null}
    <section>
      <ProductSectionHeader eyebrow="CRM register" title={`${companies.length} compan${companies.length===1?'y':'ies'}`} />
      {companies.length===0?<ProductEmptyState title="No companies yet" description="Add the first client or prospect company to create the master record used by the rest of the workspace."/>:<ProductRegister>{companies.map(company=><ProductRegisterRow href={`/workspace/companies/${company.id}`} key={company.id}><div><strong>{company.name}</strong><p>{[company.industry,company.country].filter(Boolean).join(' · ')||'Company profile'}</p></div><div><small>Primary context</small><strong style={{display:'block',marginTop:3}}>{company.website?'Website recorded':'Open master record'}</strong></div><span/><strong>Open company →</strong></ProductRegisterRow>)}</ProductRegister>}
    </section>
  </section>;
}
