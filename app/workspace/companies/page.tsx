import CompanyForm from '@/components/workspace/CompanyForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

export default async function CompaniesPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const params=searchParams?await searchParams:{};const {supabase,organisationId}=await requireUserContext();const companies=await listCompanies(supabase,organisationId);
  const uk=companies.filter(company=>company.country==='United Kingdom').length;const profiled=companies.filter(company=>company.industry).length;
  return <section className="vp-page">
    <ProductPageHeader eyebrow="CRM · Companies" title="Company register" description="The master customer and prospect company record used by Acquisition, Cases, quotes, Projects and controlled documents." actions={<details><summary className="button">Add company</summary><div className="vp-toolbar-panel"><CompanyForm/></div></details>} />
    {params.created?<ProductNotice title="Company created" tone="complete"><p>The company is now available across the workspace.</p></ProductNotice>:null}{params.error?<ProductNotice title="Company could not be created" tone="blocked"><p>{String(params.error)}</p></ProductNotice>:null}
    <ProductMetrics label="Company register summary"><ProductMetric label="Companies" value={companies.length} detail="Master company records"/><ProductMetric label="United Kingdom" value={uk} detail="UK company records"/><ProductMetric label="Industry profiled" value={profiled} detail="Records with industry context"/><ProductMetric label="Profile coverage" value={companies.length?`${Math.round((profiled/companies.length)*100)}%`:'—'} detail="Industry data completeness"/></ProductMetrics>
    <section><ProductSectionHeader eyebrow="CRM register" title="Companies" />{companies.length===0?<ProductEmptyState title="No companies yet" description="Add the first client or prospect company to create the master record used by the rest of the workspace."/>:<ProductRegister>{companies.map(company=><ProductRegisterRow href={`/workspace/companies/${company.id}`} key={company.id}><div><strong>{company.name}</strong><p>{[company.industry,company.country].filter(Boolean).join(' · ')||'Profile details not added'}</p></div><ProductStatus>{company.industry?'Profiled':'Needs profile'}</ProductStatus><div><small>Website</small><strong style={{display:'block',marginTop:3}}>{company.website?'Recorded':'Not recorded'}</strong></div><strong>Open company →</strong></ProductRegisterRow>)}</ProductRegister>}</section>
  </section>;
}
