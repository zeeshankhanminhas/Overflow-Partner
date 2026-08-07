import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listProspects } from '@/lib/repositories/prospects';

export default async function ProspectRegisterPage(){
  const {supabase,organisationId}=await requireUserContext();
  const prospects=await listProspects(supabase,organisationId);
  const active=prospects.filter(item=>item.status!=='converted');
  const qualified=prospects.filter(item=>item.status==='qualified').length;
  return <section className="vp-page">
    <header className="vp-header"><div><p className="vp-kicker">Acquire · Prospects</p><h1>Incoming engineering opportunities.</h1><p className="vp-subtitle">Prospects remain here until the technical intake and qualification gates are complete.</p></div><Link className="button" href="/workspace/acquisition">Open acquisition workspace</Link></header>
    <section className="vp-object vp-object--hero"><p className="vp-label">Prospect position</p><div className="vp-compact-metrics"><div className="vp-metric"><span>Active</span><strong>{active.length}</strong></div><div className="vp-metric"><span>Qualified</span><strong>{qualified}</strong></div><div className="vp-metric"><span>Total</span><strong>{prospects.length}</strong></div></div></section>
    <section><div className="vp-section-title"><div><p className="vp-label">Acquisition register</p><h2>Prospects</h2></div></div><div className="vp-list">{prospects.length===0?<div className="vp-empty">No prospects have been captured yet.</div>:prospects.map(item=><article className="vp-row" key={item.id}><div><h3>{item.company_name}</h3><p>{item.contact_name||'Contact not recorded'} · {item.source}</p></div><div className="vp-row-status">{item.status.replaceAll('_',' ')}</div><div>{item.company_id?<Link href={`/workspace/companies/${item.company_id}`}>Open company →</Link>:<Link href="/workspace/acquisition">Open acquisition →</Link>}</div></article>)}</div></section>
  </section>;
}
