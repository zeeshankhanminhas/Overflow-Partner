import Link from 'next/link';
import ContactForm from '@/components/workspace/ContactForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';

export default async function ContactsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const [companies, contacts] = await Promise.all([listCompanies(supabase, organisationId), listContacts(supabase, organisationId)]);
  return (
    <section>
      <p className="eyebrow">CRM</p><h1>Contacts</h1>
      <p className="lede">Maintain decision-makers and technical contacts once, then link them to acquisition and lead records.</p>
      {params.created ? <p className="card" style={{ marginTop: 20, width: '100%' }}>Contact created successfully.</p> : null}
      {params.error ? <p className="card" style={{ marginTop: 20, width: '100%' }}>{String(params.error)}</p> : null}
      <div className="metric-grid">
        <article className="metric"><span>Total contacts</span><strong>{contacts.length}</strong></article>
        <article className="metric"><span>Linked to companies</span><strong>{contacts.filter((contact) => contact.company_id).length}</strong></article>
        <article className="metric"><span>With email</span><strong>{contacts.filter((contact) => contact.email).length}</strong></article>
      </div>
      <ContactForm companies={companies} />
      <div style={{ marginTop: 32, display: 'grid', gap: 12 }}>
        {contacts.length === 0 ? <div className="card" style={{ width: '100%' }}><h3>No contacts yet</h3></div> : contacts.map((contact) => (
          <article className="metric" key={contact.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div><strong style={{ marginTop: 0, fontSize: 22 }}>{contact.full_name}</strong><p>{[contact.job_title, contact.company?.name].filter(Boolean).join(' · ') || 'No company assigned'}</p></div>
              {contact.company_id ? <Link href={`/workspace/companies/${contact.company_id}`}>Company</Link> : null}
            </div>
            <p>{[contact.email, contact.phone].filter(Boolean).join(' · ') || 'No contact details added'}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
