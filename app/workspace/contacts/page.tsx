import Link from 'next/link';
import ContactForm from '@/components/workspace/ContactForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';
import { ContextActions, InteractionFact, InteractionFacts, WorkWindow, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

export default async function ContactsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params=searchParams?await searchParams:{};
  const {supabase,organisationId}=await requireUserContext();
  const [companies,contacts]=await Promise.all([listCompanies(supabase,organisationId),listContacts(supabase,organisationId)]);
  const linked=contacts.filter(contact=>contact.company_id).length;const withEmail=contacts.filter(contact=>contact.email).length;
  const addContact=<WorkWindow triggerLabel="Add contact" triggerClassName="button" eyebrow="CRM master" title="Add contact" description="Create a governed person record while keeping the contact register in context."><ContactForm companies={companies}/></WorkWindow>;
  return <section className="vp-page">
    <ProductPageHeader eyebrow="CRM · Contacts" title="Contact register" description="Maintain decision-makers and technical contacts once, then reuse the same governed person across Acquisition and Case records. Inspect contact context without leaving the register." actions={addContact} />
    {params.created?<ProductNotice title="Contact created" tone="complete"><p>The contact is now available across the workspace.</p></ProductNotice>:null}{params.error?<ProductNotice title="Contact could not be created" tone="blocked"><p>{String(params.error)}</p></ProductNotice>:null}
    <ProductMetrics label="Contact register summary"><ProductMetric label="Contacts" value={contacts.length} detail="Master contact records"/><ProductMetric label="Company linked" value={linked} detail="Contacts attached to a company"/><ProductMetric label="With email" value={withEmail} detail="Email address recorded"/><ProductMetric label="Profile coverage" value={contacts.length?`${Math.round((withEmail/contacts.length)*100)}%`:'—'} detail="Email completeness"/></ProductMetrics>
    <section><ProductSectionHeader eyebrow="CRM register" title="People" />{contacts.length?<ProductRegister>{contacts.map(contact=><ProductRegisterRow key={contact.id}>
      <div><strong>{contact.full_name}</strong><p>{[contact.job_title,contact.company?.name].filter(Boolean).join(' · ')||'No company assigned'}</p></div>
      <ProductStatus>{contact.company_id?'Company linked':'Unassigned'}</ProductStatus>
      <div><small>Contact</small><strong style={{display:'block',marginTop:3}}>{contact.email||contact.phone||'Not recorded'}</strong></div>
      <ContextActions label={`Actions for ${contact.full_name}`}>
        <WorkspaceDrawer triggerLabel="Inspect" eyebrow="Contact master" title={contact.full_name} description="Decision-maker and technical contact context shared across governed work." footer={contact.company_id?<Link className="button" href={`/workspace/companies/${contact.company_id}`}>Open company</Link>:undefined}>
          <InteractionFacts>
            <InteractionFact label="Job title">{contact.job_title||'Not recorded'}</InteractionFact>
            <InteractionFact label="Company">{contact.company?.name||'Unassigned'}</InteractionFact>
            <InteractionFact label="Email">{contact.email||'Not recorded'}</InteractionFact>
            <InteractionFact label="Phone">{contact.phone||'Not recorded'}</InteractionFact>
            <InteractionFact label="LinkedIn">{contact.linkedin_url||'Not recorded'}</InteractionFact>
          </InteractionFacts>
          {contact.notes?<div className="workspace-record-note"><small>Notes</small><p>{contact.notes}</p></div>:null}
        </WorkspaceDrawer>
        {contact.company_id?<Link className="button secondary" href={`/workspace/companies/${contact.company_id}`}>Company</Link>:null}
      </ContextActions>
    </ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title="No contacts yet" description="Add a decision-maker or technical contact to create the first master person record."/>}</section>
  </section>;
}
