import Link from 'next/link';
import { notFound } from 'next/navigation';
import ContactForm from '@/components/workspace/ContactForm';
import FileTypeThumbnail from '@/components/workspace/FileTypeThumbnail';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies, getCompany360 } from '@/lib/repositories/companies';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

function money(value:unknown,currency='GBP'){try{return new Intl.NumberFormat('en-GB',{style:'currency',currency,maximumFractionDigits:0}).format(Number(value||0))}catch{return `${currency} ${Number(value||0).toFixed(0)}`}}

export default async function CompanyDetailPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const { supabase, organisationId } = await requireUserContext();
  let record;try { record = await getCompany360(supabase, organisationId, companyId); } catch { notFound(); }
  const companies = await listCompanies(supabase, organisationId);
  const { company, contacts, prospects, leads: cases, documents, quotes, projects, invoices, activity } = record;
  const activeProjects=(projects as any[]).filter(item=>!['closed','completed','cancelled'].includes(String(item.status))).length;
  const openCases=cases.filter(item=>!['won','lost'].includes(String(item.status))).length;
  const outstanding=(invoices as any[]).reduce((sum,item)=>sum+Math.max(0,Number(item.total||0)-Number(item.amount_paid||0)),0);
  const acceptedValue=(quotes as any[]).filter(item=>item.status==='accepted').reduce((sum,item)=>sum+Number(item.total||0),0);
  const relationshipRows = [
    ...prospects.map((item) => ({ id:item.id, title:item.contact_name || item.company_name, meta:`Enquiry · ${item.status}`, href:`/workspace/acquisition/${item.id}`, kind:'Enquiry' })),
    ...cases.map((item) => ({ id:item.id, title:item.title || item.company_name, meta:`Case · ${item.status}`, href:`/workspace/leads/${item.id}`, kind:'Case' })),
    ...(projects as any[]).map(item=>({id:item.id,title:`${item.project_number} · ${item.title}`,meta:`Project · ${String(item.project_stage||item.status).replaceAll('_',' ')}`,href:`/workspace/projects/${item.id}`,kind:'Project'})),
  ];

  return <section className="vp-page">
    <ProductPageHeader eyebrow="CRM · Company 360" title={company.name} description={[company.industry, company.country].filter(Boolean).join(' · ') || undefined} backHref="/workspace/companies" backLabel="Companies" />
    <ProductMetrics label="Company relationship summary"><ProductMetric label="Active projects" value={activeProjects} detail={`${openCases} open Case${openCases===1?'':'s'}`} tone={activeProjects?'active':'neutral'}/><ProductMetric label="Contacts" value={contacts.length} detail="People linked to this company"/><ProductMetric label="Accepted value" value={money(acceptedValue)} detail="Accepted quoted value"/><ProductMetric label="Receivables" value={money(outstanding)} detail="Outstanding client balance" tone={outstanding?'waiting':'complete'}/></ProductMetrics>

    <section className="product-panel"><ProductSectionHeader eyebrow="Account" title="Company profile" actions={company.website?<a className="button secondary" href={company.website} target="_blank" rel="noreferrer">Website</a>:undefined}/><div className="vp-facts"><div className="vp-fact"><small>Industry</small><strong>{company.industry||'Not recorded'}</strong></div><div className="vp-fact"><small>Country</small><strong>{company.country||'Not recorded'}</strong></div><div className="vp-fact"><small>Employees</small><strong>{company.employee_count||'Not recorded'}</strong></div><div className="vp-fact"><small>Relationship</small><strong>{projects.length||cases.length?'Active':'Prospect / master data'}</strong></div></div>{company.notes?<p>{company.notes}</p>:null}</section>

    <section className="product-panel"><ProductSectionHeader eyebrow="People" title="Contacts" actions={<ContactForm companies={companies} defaultCompanyId={company.id}/>}/>{contacts.length?<ProductRegister>{contacts.map((contact,index)=><ProductRegisterRow key={contact.id} serial={index+1}><div><Link href={`/workspace/contacts/${contact.id}`}><strong>{contact.full_name}</strong></Link><p>{[contact.job_title,contact.email,contact.phone].filter(Boolean).join(' · ')||'Contact details not recorded'}</p></div><ProductStatus>Contact</ProductStatus><span/><Link className="button secondary" href={`/workspace/contacts/${contact.id}`}>Open</Link></ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No contacts yet" description="Add the first client or prospect contact."/>}</section>

    <section><ProductSectionHeader eyebrow="Commercial relationship" title="Current and historical work" />{relationshipRows.length?<ProductRegister>{relationshipRows.map((item,index)=><ProductRegisterRow href={item.href} serial={index+1} key={`${item.kind}-${item.id}`}><div><strong>{item.title}</strong><p>{item.meta}</p></div><ProductStatus tone={item.kind==='Project'?'active':item.kind==='Case'?'waiting':'neutral'}>{item.kind}</ProductStatus><span/><strong>Open →</strong></ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No linked work" description="Enquiries, Cases and Projects linked to this company will appear here."/>}</section>

    {(quotes as any[]).length|| (invoices as any[]).length?<section className="product-panel"><ProductSectionHeader eyebrow="Commercial" title="Quotes & receivables"/><div className="crm-relationship-grid">{(quotes as any[]).slice(0,6).map(item=><Link className="crm-relationship-card" href="/workspace/quotes" key={item.id}><small>Quote</small><strong>{item.quote_number}</strong><span>{money(item.total,item.currency)} · {String(item.status).replaceAll('_',' ')}</span></Link>)}{(invoices as any[]).slice(0,6).map(item=><Link className="crm-relationship-card" href={`/workspace/payments${item.project_id?`?project=${item.project_id}`:''}`} key={item.id}><small>Invoice</small><strong>{item.invoice_number}</strong><span>{money(Math.max(0,Number(item.total||0)-Number(item.amount_paid||0)),item.currency)} outstanding</span></Link>)}</div></section>:null}

    <section><ProductSectionHeader eyebrow="Controlled evidence" title="Documents" />{documents.length?<ProductRegister>{documents.map((document,index)=><ProductRegisterRow key={document.id} serial={index+1}><div className="file-identity"><FileTypeThumbnail name={document.storage_path||document.title} documentType={document.document_type}/><div className="file-identity__copy"><strong>{document.reference} · {document.title}</strong><small>{String(document.document_type).replaceAll('_',' ')} · v{document.version}</small></div></div><ProductStatus>{String(document.status).replaceAll('_',' ')}</ProductStatus><span/><Link href={`/workspace/documents?${document.project_id?`project=${document.project_id}`:`lead=${document.lead_id}`}`}>Open register →</Link></ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No linked documents" description="Controlled documents will appear as work generates them."/>}</section>

    <details className="vp-disclosure"><summary>Recent account activity · {activity.length}</summary><div style={{paddingTop:14}}>{activity.length?<ProductRegister>{activity.map((event: any)=><ProductRegisterRow key={event.id}><div><strong>{String(event.event_type).replaceAll('_',' ')}</strong><p>{new Date(event.created_at).toLocaleString('en-GB')}</p></div><ProductStatus>Audit</ProductStatus><span/><span/></ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No company activity recorded"/>}</div></details>
  </section>;
}
