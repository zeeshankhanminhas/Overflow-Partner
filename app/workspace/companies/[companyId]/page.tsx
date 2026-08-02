import Link from 'next/link';
import { notFound } from 'next/navigation';
import ContactForm from '@/components/workspace/ContactForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies, getCompany360 } from '@/lib/repositories/companies';

export default async function CompanyDetailPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const { supabase, organisationId } = await requireUserContext();
  try {
    const [record, companies] = await Promise.all([getCompany360(supabase, organisationId, companyId), listCompanies(supabase, organisationId)]);
    const { company, contacts, prospects, leads, technicalIntakes, documents, activity } = record;
    return (
      <section>
        <Link href="/workspace/companies">← Companies</Link>
        <p className="eyebrow" style={{ marginTop: 24 }}>Company 360°</p>
        <h1>{company.name}</h1>
        <p className="lede">{[company.industry, company.country].filter(Boolean).join(' · ') || 'Company profile'}</p>
        <div className="metric-grid">
          <article className="metric"><span>Contacts</span><strong>{contacts.length}</strong></article>
          <article className="metric"><span>Prospects</span><strong>{prospects.length}</strong></article>
          <article className="metric"><span>Leads</span><strong>{leads.length}</strong></article>
          <article className="metric"><span>Technical intakes</span><strong>{technicalIntakes.length}</strong></article>
          <article className="metric"><span>Documents</span><strong>{documents.length}</strong></article>
        </div>
        <div className="card" style={{ marginTop: 24, width: '100%' }}>
          <h3>Company profile</h3>
          <p>{company.website || 'Website not added'} · {company.employee_count ? `${company.employee_count} employees` : 'Employee count not added'}</p>
          {company.notes ? <p>{company.notes}</p> : null}
        </div>
        <ContactForm companies={companies} defaultCompanyId={company.id} />
        <div style={{ marginTop: 32, display: 'grid', gap: 20 }}>
          <div><p className="eyebrow">Contacts</p>{contacts.length ? contacts.map((contact) => <article className="metric" key={contact.id}><strong>{contact.full_name}</strong><p>{[contact.job_title, contact.email, contact.phone].filter(Boolean).join(' · ')}</p></article>) : <p>No contacts yet.</p>}</div>
          <div><p className="eyebrow">Prospects and leads</p>{[...prospects.map((item) => ({ id: item.id, title: item.contact_name || item.company_name, meta: `Prospect · ${item.status}` })), ...leads.map((item) => ({ id: item.id, title: item.title || item.company_name, meta: `Lead · ${item.status}` }))].map((item) => <article className="metric" key={`${item.meta}-${item.id}`}><strong>{item.title}</strong><p>{item.meta}</p></article>)}</div>
          <div><p className="eyebrow">Documents</p>{documents.length ? documents.map((document) => <article className="metric" key={document.id}><strong>{document.reference} · {document.title}</strong><p>{document.document_type} · v{document.version} · {document.status}</p></article>) : <p>No linked documents yet.</p>}</div>
          <div><p className="eyebrow">Activity</p>{activity.length ? activity.map((event: any) => <article className="metric" key={event.id}><strong>{String(event.event_type).replaceAll('_', ' ')}</strong><p>{new Date(event.created_at).toLocaleString('en-GB')}</p></article>) : <p>No company activity recorded yet.</p>}</div>
        </div>
      </section>
    );
  } catch { notFound(); }
}
