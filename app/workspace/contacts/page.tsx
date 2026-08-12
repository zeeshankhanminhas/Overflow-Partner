import Link from 'next/link';
import ContactForm from '@/components/workspace/ContactForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';
import { ProductEmptyState, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

export default async function ContactsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params=searchParams?await searchParams:{};
  const {supabase,organisationId}=await requireUserContext();
  const [companies,contacts]=await Promise.all([listCompanies(supabase,organisationId),listContacts(supabase,organisationId)]);
  return <section className="vp-page">
    <ProductPageHeader eyebrow="CRM · Contacts" title="Contact register" description="Find decision-makers and technical contacts once and reuse the same governed person across the workspace." actions={<details><summary className="button">Add contact</summary><div className="vp-toolbar-panel"><ContactForm companies={companies}/></div></details>} />
    {params.created?<ProductNotice title="Contact created" tone="complete"><p>The contact is now available across the workspace.</p></ProductNotice>:null}{params.error?<ProductNotice title="Contact could not be created" tone="blocked"><p>{String(params.error)}</p></ProductNotice>:null}
    <section><ProductSectionHeader eyebrow="CRM register" title={`${contacts.length} contact${contacts.length===1?'':'s'}`} />{contacts.length?<ProductRegister>{contacts.map(contact=><ProductRegisterRow key={contact.id}><div><strong>{contact.full_name}</strong><p>{[contact.job_title,contact.company?.name].filter(Boolean).join(' · ')||'No company assigned'}</p></div><ProductStatus>{contact.company_id?'Company linked':'Unassigned'}</ProductStatus><div><small>Contact</small><strong style={{display:'block',marginTop:3}}>{contact.email||contact.phone||'Not recorded'}</strong></div>{contact.company_id?<Link href={`/workspace/companies/${contact.company_id}`}>Open company →</Link>:<span/>}</ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No contacts yet" description="Add a decision-maker or technical contact to create the first master person record."/>}</section>
  </section>;
}
