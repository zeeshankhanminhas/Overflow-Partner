import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import css from '../opos.module.css';

function statusLabel(status: string | null) {
  return (status || 'Unknown').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export default async function OpportunityRegister({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, organisationId } = await requireUserContext();
  const { q = '' } = await searchParams;
  const search = q.trim().slice(0,80);
  let query = supabase.from('prospects')
    .select('id,company_name,source,status,next_action,created_at')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false }).limit(100);
  if (search) query = query.ilike('company_name', '%' + search.replace(/[%_]/g, '') + '%');
  const { data, error } = await query;
  if (error) throw new Error('Opportunity register could not be loaded.');
  const items = data || [];

  return <section aria-labelledby="opos-opportunities-heading">
    <header className={css.pageHeader}>
      <p className={css.eyebrow}>WORK / OPPORTUNITIES</p>
      <h1 className={css.title} id="opos-opportunities-heading">Opportunities</h1>
      <p className={css.subhead}>Find inbound enquiries and qualified prospect work. Each record opens into its current operating position.</p>
    </header>
    <form method="GET" className={css.searchRow} role="search" aria-label="Search opportunities">
      <label htmlFor="opos-find" className={css.eyebrow}>Find a company</label>
      <input id="opos-find" type="search" name="q" defaultValue={search}
        placeholder="Company name" className={css.searchInput} maxLength={80} />
      <button type="submit" className={css.searchButton}>Search</button>
    </form>
    <div className={css.sectionHeading}>
      <h2>{search ? 'Search results' : 'Recent opportunities'}</h2>
      <span className={css.meta}>{items.length}{items.length === 100 ? '+' : ''} record(s){items.length === 100 ? ' · newest first' : ''}</span>
    </div>
    {items.length ? <div className={css.tableWrap}>
      <table className={css.table}>
        <thead><tr><th scope="col">Company</th><th scope="col">Source</th><th scope="col">State</th><th scope="col">Next operational step</th></tr></thead>
        <tbody>{items.map(item => <tr key={item.id}>
          <td><Link href={'/opos-next/opportunities/' + item.id}>{item.company_name || 'Unnamed opportunity'}</Link></td>
          <td>{item.source === 'linkedin' ? 'LinkedIn' : item.source === 'website' ? 'Website' : item.source || 'Other'}</td>
          <td>{statusLabel(item.status)}</td>
          <td>{item.next_action || 'Review current position'}</td>
        </tr>)}</tbody>
      </table>
    </div> : <p className={css.empty}>No opportunities matched your search.</p>}
    <p className={css.meta} style={{marginTop:24}}>New UI preview · existing secure workflows remain available in the current operating workspace until parity is verified.</p>
  </section>;
}
