import Link from 'next/link';
import { notFound } from 'next/navigation';
import ContactForm from '@/components/workspace/ContactForm';
import { requireUserContext } from '@/lib/auth/context';
import { getContactById } from '@/lib/repositories/contacts';
import { listCompanies } from '@/lib/repositories/companies';
import { WorkWindow } from '@/components/workspace/InteractionSurface';
import { ProductNotice, ProductPageHeader, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

export default async function ContactDetailPage({params,searchParams}:{params:Promise<{contactId:string}>;searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const {contactId}=await params;const query=searchParams?await searchParams:{};const {supabase,organisationId}=await requireUserContext();
  let contact;try{contact=await getContactById(supabase,organisationId,contactId)}catch{notFound()}
  const [companies,leadsResult,prospectsResult]=await Promise.all([
    listCompanies(supabase,organisationId),
    supabase.from('leads').select('id,title,company_name,status,reference').eq('organisation_id',organisationId).eq('contact_id',contactId).order('created_at',{ascending:false}),
    supabase.from('prospects').select('id,company_name,status').eq('organisation_id',organisationId).eq('contact_id',contactId).order('created_at',{ascending:false}),
  ]);
  const cases=leadsResult.data||[];const enquiries=prospectsResult.data||[];
  const editContact=<WorkWindow triggerLabel="Edit contact" triggerClassName="button" eyebrow="CRM master" title={`Edit ${contact.full_name}`} description="Update the authoritative contact record used across enquiries, cases and projects."><ContactForm companies={companies} contact={contact}/></WorkWindow>;
  const headerActions=<>{editContact}{contact.company_id?<Link className="button secondary" href={`/workspace/companies/${contact.company_id}`}>Company 360</Link>:null}</>;
  return <section className="vp-page">
    <ProductPageHeader eyebrow="CRM · Contact" title={contact.full_name} description={[contact.job_title,contact.company?.name].filter(Boolean).join(' · ')||undefined} backHref="/workspace/contacts" backLabel="Contacts" actions={headerActions}/>
    {query.updated?<ProductNotice title="Contact updated" tone="complete"><p>The authoritative contact record has been updated across the workspace.</p></ProductNotice>:null}
    {query.error?<ProductNotice title="Contact could not be updated" tone="blocked"><p>{String(query.error)}</p></ProductNotice>:null}
    <section className="product-panel"><ProductSectionHeader eyebrow="Identity" title="Contact details" actions={editContact}/><div className="vp-facts"><div className="vp-fact"><small>Company</small><strong>{contact.company?.name||'Unassigned'}</strong></div><div className="vp-fact"><small>Role</small><strong>{contact.job_title||'Not recorded'}</strong></div><div className="vp-fact"><small>Email</small><strong>{contact.email?<a href={`mailto:${contact.email}`}>{contact.email}</a>:'Not recorded'}</strong></div><div className="vp-fact"><small>Phone</small><strong>{contact.phone?<a href={`tel:${contact.phone}`}>{contact.phone}</a>:'Not recorded'}</strong></div><div className="vp-fact"><small>LinkedIn</small><strong>{contact.linkedin_url?<a href={contact.linkedin_url} target="_blank" rel="noreferrer">Open profile</a>:'Not recorded'}</strong></div></div></section>
    <section className="product-panel"><ProductSectionHeader eyebrow="Relationship" title="Linked work"/><div className="crm-relationship-grid">{cases.map((item:any)=><Link className="crm-relationship-card" href={`/workspace/leads/${item.id}`} key={item.id}><small>Case</small><strong>{item.reference||item.title||item.company_name}</strong><span>{String(item.status).replaceAll('_',' ')}</span></Link>)}{enquiries.map((item:any)=><Link className="crm-relationship-card" href={`/workspace/acquisition/${item.id}`} key={item.id}><small>Enquiry</small><strong>{item.company_name}</strong><span>{String(item.status).replaceAll('_',' ')}</span></Link>)}</div>{!cases.length&&!enquiries.length?<ProductStatus>No linked work</ProductStatus>:null}</section>
    <section className="product-panel"><ProductSectionHeader eyebrow="Context" title="Notes" actions={editContact}/><p>{contact.notes||'No notes recorded.'}</p></section>
  </section>;
}
