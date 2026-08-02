import Link from 'next/link';
import CompanyForm from '@/components/workspace/CompanyForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';

export default async function CompaniesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const companies = await listCompanies(supabase, organisationId);
  return (
    <section>
      <p className="eyebrow">CRM</p><h1>Companies</h1>
      <p className="lede">Maintain the master company record used by prospects, contacts, leads, quotes, projects and documents.</p>
      {params.created ? <p className="card" style={{ marginTop: 20, width: '100%' }}>Company created successfully.</p> : null}
      {params.error ? <p className="card" style={{ marginTop: 20, width: '100%' }}>{String(params.error)}</p> : null}
      <div className="metric-grid">
        <article className="metric"><span>Total companies</span><strong>{companies.length}</strong></article>
        <article className="metric"><span>UK companies</span><strong>{companies.filter((company) => company.country === 'United Kingdom').length}</strong></article>
        <article className="metric"><span>With industry data</span><strong>{companies.filter((company) => company.industry).length}</strong></article>
      </div>
      <CompanyForm />
      <div style={{ marginTop: 32, display: 'grid', gap: 12 }}>
        {companies.length === 0 ? <div className="card" style={{ width: '100%' }}><h3>No companies yet</h3><p className="lede" style={{ fontSize: 16 }}>Add the first client or prospect company above.</p></div> : companies.map((company) => (
          <article className="metric" key={company.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
              <div><Link href={`/workspace/companies/${company.id}`}><strong style={{ marginTop: 0, fontSize: 22 }}>{company.name}</strong></Link><p>{[company.industry, company.country].filter(Boolean).join(' · ') || 'Profile details not added'}</p></div>
              <div style={{ display: 'flex', gap: 12 }}>{company.website ? <a href={company.website} target="_blank" rel="noreferrer">Website</a> : null}<Link href={`/workspace/companies/${company.id}`}>Open 360°</Link></div>
            </div>
            {company.notes ? <p>{company.notes}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
