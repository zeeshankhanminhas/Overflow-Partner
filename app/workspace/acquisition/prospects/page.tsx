import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listProspects } from '@/lib/repositories/prospects';

export default async function ProspectRegisterPage(){
  const {supabase,organisationId}=await requireUserContext();
  const allProspects=await listProspects(supabase,organisationId);
  const prospects=allProspects.filter(item=>item.status!=='converted');
  const qualified=prospects.filter(item=>item.status==='qualified').length;
  const inProgress=prospects.filter(item=>item.status!=='qualified').length;

  return <section className="vp-page">
    <header className="vp-header"><div><p className="vp-kicker">Acquisition</p><h1>Prospects</h1><p className="vp-subtitle">Track new opportunities that are still in Acquisition. Once a prospect becomes a Case, it moves out of this list automatically.</p></div><Link className="button" href="/workspace/acquisition">Open acquisition overview</Link></header>
    <section className="vp-object vp-object--hero"><p className="vp-label">Overview</p><div className="vp-compact-metrics"><div className="vp-metric"><span>In progress</span><strong>{inProgress}</strong></div><div className="vp-metric"><span>Ready for Case</span><strong>{qualified}</strong></div><div className="vp-metric"><span>Active prospects</span><strong>{prospects.length}</strong></div></div></section>
    <section><div className="vp-section-title"><div><p className="vp-label">Prospect list</p><h2>Active opportunities</h2></div></div><div className="vp-list">{prospects.length===0?<div className="vp-empty">No active prospects right now.</div>:prospects.map(item=><article className="vp-row" key={item.id}><div><h3>{item.company_name}</h3><p>{item.contact_name||'Contact not recorded'} · {item.source}</p></div><div className="vp-row-status">{item.status.replaceAll('_',' ')}</div><div><Link href={`/workspace/acquisition/${item.id}`}>Open prospect →</Link></div></article>)}</div></section>
  </section>;
}
