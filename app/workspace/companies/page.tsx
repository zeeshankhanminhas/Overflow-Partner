import Link from 'next/link';
import CompanyForm from '@/components/workspace/CompanyForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { developerDeleteRecordAction } from '@/app/workspace/developer-actions';
import WorkspaceConsequenceGuard from '@/components/workspace/WorkspaceConsequenceGuard';
import { ContextActions, DecisionDialog, InteractionFact, InteractionFacts, WorkWindow, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

export default async function CompaniesPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const params=searchParams?await searchParams:{};const {supabase,organisationId,profile}=await requireUserContext();const companies=await listCompanies(supabase,organisationId);const developerDeleteEnabled=Boolean(profile.developer_delete_enabled);
  const uk=companies.filter(company=>company.country==='United Kingdom').length;const profiled=companies.filter(company=>company.industry).length;const accountReviews=companies.filter(company=>company.next_account_review_at&&new Date(company.next_account_review_at).getTime()<=Date.now()).length;const recurring=companies.filter(company=>['repeat','retained'].includes(String(company.account_status))).length;
  const addCompany=<WorkWindow triggerLabel="Add company" triggerClassName="button" eyebrow="CRM master" title="Add company" description="Create the shared company master record without expanding the register into a form page."><CompanyForm/></WorkWindow>;
  return <section className="vp-page">
    <ProductPageHeader eyebrow="CRM · Companies" title="Company register" description="The master customer and prospect company record used by Acquisition, Cases, quotes, Projects and controlled documents. Inspect a company in context before opening Company 360." actions={addCompany} />
    {params.created?<ProductNotice title="Company created" tone="complete"><p>The company is now available across the workspace.</p></ProductNotice>:null}{params.error?<ProductNotice title="Company could not be created" tone="blocked"><p>{String(params.error)}</p></ProductNotice>:null}
    <ProductMetrics label="Company register summary"><ProductMetric label="Companies" value={companies.length} detail="Master company records"/><ProductMetric label="Account reviews due" value={accountReviews} detail="Commercial follow-ups ready" tone={accountReviews?'waiting':'complete'}/><ProductMetric label="Recurring clients" value={recurring} detail="Repeat or retained relationships" tone={recurring?'complete':'neutral'}/><ProductMetric label="Profile coverage" value={companies.length?`${Math.round((profiled/companies.length)*100)}%`:'—'} detail={`${uk} UK · ${profiled} industry profiled`}/></ProductMetrics>
    <section><ProductSectionHeader eyebrow="CRM register" title="Companies" />{companies.length===0?<ProductEmptyState title="No companies yet" description="Add the first client or prospect company to create the master record used by the rest of the workspace."/>:<ProductRegister>{companies.map(company=><ProductRegisterRow key={company.id}>
      <div><strong>{company.name}</strong><p>{[company.industry,company.country].filter(Boolean).join(' · ')||'Profile details not added'}</p></div>
      <ProductStatus tone={['repeat','retained'].includes(String(company.account_status))?'complete':company.next_account_review_at&&new Date(company.next_account_review_at).getTime()<=Date.now()?'waiting':'neutral'}>{String(company.account_status||'new').replaceAll('_',' ')}</ProductStatus>
      <div><small>Website</small><strong style={{display:'block',marginTop:3}}>{company.website?'Recorded':'Not recorded'}</strong></div>
      <ContextActions label={`Actions for ${company.name}`}>
        <WorkspaceDrawer triggerLabel="Inspect" eyebrow="Company master" title={company.name} description="Customer and prospect master data shared across the workspace." footer={<Link className="button" href={`/workspace/companies/${company.id}`}>Open Company 360</Link>}>
          <InteractionFacts>
            <InteractionFact label="Industry">{company.industry||'Not recorded'}</InteractionFact>
            <InteractionFact label="Country">{company.country||'Not recorded'}</InteractionFact>
            <InteractionFact label="Website">{company.website||'Not recorded'}</InteractionFact>
            <InteractionFact label="Employees">{company.employee_count??'Not recorded'}</InteractionFact>
          </InteractionFacts>
          {company.notes?<div className="workspace-record-note"><small>Notes</small><p>{company.notes}</p></div>:null}
          <nav className="workspace-record-context" aria-label={`Related work for ${company.name}`}><small>Relationship context</small><div className="workspace-record-context__links"><Link href={`/workspace/companies/${company.id}`}>Company 360<span>→</span></Link><Link href="/workspace/contacts">Contacts<span>→</span></Link><Link href="/workspace/leads">Cases<span>→</span></Link><Link href="/workspace/projects">Projects<span>→</span></Link></div></nav>
        </WorkspaceDrawer>
        <Link className="button secondary" href={`/workspace/companies/${company.id}`}>Open</Link>
        {developerDeleteEnabled?<DecisionDialog triggerLabel="Delete test client" triggerClassName="button secondary product-action product-action--destructive" eyebrow="Developer test control" title={`Delete ${company.name}?`} description="Permanent test-data cleanup for this client company master record. Linked Cases and Projects remain as historical operating records."><form action={developerDeleteRecordAction} className="stack"><input type="hidden" name="entity_type" value="company"/><input type="hidden" name="entity_id" value={company.id}/><input type="hidden" name="return_to" value="/workspace/companies"/><div className="product-notice product-notice--critical"><strong>Permanent client deletion</strong><div>{company.name} will be removed. Linked contacts, enquiries and Cases will remain but will no longer reference this company master.</div></div><WorkspaceConsequenceGuard actionLabel="Delete test client" pendingLabel="Deleting client…" confirmationLabel={`I understand the ${company.name} company master will be permanently deleted.`} consequence="The company profile and company-specific commercial profile will be removed." recovery="Historical operating records remain, but this company link cannot be restored automatically." className="button product-action product-action--destructive"/></form></DecisionDialog>:null}
      </ContextActions>
    </ProductRegisterRow>)}</ProductRegister>}</section>
  </section>;
}
