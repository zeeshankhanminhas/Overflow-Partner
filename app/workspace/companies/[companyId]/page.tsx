import Link from 'next/link';
import { notFound } from 'next/navigation';
import ContactForm from '@/components/workspace/ContactForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies, getCompany360 } from '@/lib/repositories/companies';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

export default async function CompanyDetailPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const { supabase, organisationId } = await requireUserContext();
  let record;
  try { record = await getCompany360(supabase, organisationId, companyId); } catch { notFound(); }
  const companies = await listCompanies(supabase, organisationId);
  const { company, contacts, prospects, leads: cases, technicalIntakes, documents, activity } = record;
  const relationshipRows = [
    ...prospects.map((item) => ({ id:item.id, title:item.contact_name || item.company_name, meta:`Prospect · ${item.status}`, href:`/workspace/acquisition/${item.id}`, kind:'Prospect' })),
    ...cases.map((item) => ({ id:item.id, title:item.title || item.company_name, meta:`Case · ${item.status}`, href:`/workspace/leads/${item.id}`, kind:'Case' })),
  ];

  return <section className="vp-page">
    <ProductPageHeader eyebrow="CRM · Company 360" title={company.name} description={[company.industry, company.country].filter(Boolean).join(' · ') || 'Master customer and prospect company record.'} backHref="/workspace/companies" backLabel="Companies" />
    <ProductMetrics label="Company relationship summary">
      <ProductMetric label="Contacts" value={contacts.length} detail="People linked to this company" />
      <ProductMetric label="Prospects" value={prospects.length} detail="Pre-qualification opportunities" />
      <ProductMetric label="Cases" value={cases.length} detail="Qualified Case-owned work" />
      <ProductMetric label="Documents" value={documents.length} detail={`${technicalIntakes.length} technical intake${technicalIntakes.length===1?'':'s'}`} />
    </ProductMetrics>

    <section className="product-panel">
      <ProductSectionHeader eyebrow="Company profile" title="Master record" actions={company.website?<a className="button secondary" href={company.website} target="_blank" rel="noreferrer">Website</a>:undefined}/>
      <div className="vp-facts"><div className="vp-fact"><small>Industry</small><strong>{company.industry||'Not recorded'}</strong></div><div className="vp-fact"><small>Country</small><strong>{company.country||'Not recorded'}</strong></div><div className="vp-fact"><small>Employees</small><strong>{company.employee_count||'Not recorded'}</strong></div></div>
      {company.notes?<p style={{margin:'14px 0 0',color:'var(--saas-muted)',fontSize:11,lineHeight:1.6}}>{company.notes}</p>:null}
    </section>

    <section className="product-panel"><ProductSectionHeader eyebrow="CRM" title="Add contact"/><ContactForm companies={companies} defaultCompanyId={company.id}/></section>

    <section><ProductSectionHeader eyebrow="People" title="Contacts" />{contacts.length?<ProductRegister>{contacts.map(contact=><ProductRegisterRow key={contact.id}><div><strong>{contact.full_name}</strong><p>{[contact.job_title,contact.email,contact.phone].filter(Boolean).join(' · ')||'Contact details not recorded'}</p></div><ProductStatus>Contact</ProductStatus><span/><span/></ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No contacts yet" description="Add the first customer or prospect contact above."/>}</section>

    <section><ProductSectionHeader eyebrow="Commercial relationship" title="Prospects and Cases" />{relationshipRows.length?<ProductRegister>{relationshipRows.map(item=><ProductRegisterRow href={item.href} key={`${item.kind}-${item.id}`}><div><strong>{item.title}</strong><p>{item.meta}</p></div><ProductStatus tone={item.kind==='Case'?'active':'neutral'}>{item.kind}</ProductStatus><span/><strong>Open →</strong></ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No active commercial records" description="Prospects and qualified Cases linked to this company will appear here."/>}</section>

    <section><ProductSectionHeader eyebrow="Controlled evidence" title="Documents" />{documents.length?<ProductRegister>{documents.map(document=><ProductRegisterRow key={document.id}><div><strong>{document.reference} · {document.title}</strong><p>{String(document.document_type).replaceAll('_',' ')} · v{document.version}</p></div><ProductStatus>{String(document.status).replaceAll('_',' ')}</ProductStatus><span/><Link href={`/workspace/documents?${document.project_id?`project=${document.project_id}`:`lead=${document.lead_id}`}`}>Open register →</Link></ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No linked documents" description="Controlled documents will appear as Prospect, Case and Project workflows generate them."/>}</section>

    <details className="vp-disclosure"><summary>Company activity · {activity.length}</summary><div style={{paddingTop:14}}>{activity.length?<ProductRegister>{activity.map((event: any)=><ProductRegisterRow key={event.id}><div><strong>{String(event.event_type).replaceAll('_',' ')}</strong><p>{new Date(event.created_at).toLocaleString('en-GB')}</p></div><ProductStatus>Audit</ProductStatus><span/><span/></ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No company activity recorded"/>}</div></details>
  </section>;
}
