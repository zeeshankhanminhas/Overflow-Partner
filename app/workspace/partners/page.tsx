import { requireUserContext } from '@/lib/auth/context';
import { listPartners } from '@/lib/repositories/workflow';
import { createPartnerFormAction } from '../workflow-actions';
import { workspaceLabel } from '@/lib/presentation/vocabulary';

const input='border border-white/10 rounded-lg bg-white px-3 py-2 text-black';
export default async function PartnersPage({ searchParams }: { searchParams?: Promise<Record<string,string|undefined>> }) {
  const params=searchParams?await searchParams:{};
  const {supabase,organisationId}=await requireUserContext();
  const partners=await listPartners(supabase,organisationId);
  const approved=partners.filter(p=>p.status==='approved').length;
  const ndaReady=partners.filter(p=>p.nda_signed).length;

  return <section className="vp-page">
    <header className="vp-header">
      <div><p className="vp-kicker">Partners</p><h1>Approved execution capacity.</h1><p className="vp-subtitle">Inspect partner readiness, NDA state and engineering capability. Partner assignment remains inside the case where the decision belongs.</p></div>
      <div className="vp-toolbar"><details><summary>Add partner</summary><div className="vp-toolbar-panel"><form action={createPartnerFormAction} className="stack"><div className="grid gap-4 md:grid-cols-2"><input className={input} name="company_name" placeholder="Company name" required/><input className={input} name="country" placeholder="Country"/><input className={input} name="contact_name" placeholder="Contact name"/><input className={input} name="email" type="email" placeholder="Email"/><input className={input} name="phone" placeholder="Phone"/><select className={input} name="status" defaultValue="prospective"><option value="prospective">Prospective</option><option value="approved">Approved</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select><select className={input} name="nda_signed" defaultValue="false"><option value="false">NDA not signed</option><option value="true">NDA signed</option></select><input className={input} name="rating" type="number" min="0" max="5" step="0.1" placeholder="Rating"/></div><textarea className={input} name="services" required rows={3} placeholder="Capabilities and services"/><textarea className={input} name="notes" rows={3} placeholder="Notes"/><button className="button">Add partner</button></form></div></details></div>
    </header>

    {params.created?<div className="vp-callout"><strong>Partner created</strong><p>The supplier is now available in the directory.</p></div>:null}
    {params.error?<div className="vp-callout"><strong>Action could not be completed</strong><p>{params.error}</p></div>:null}

    <section className="vp-object vp-object--hero"><p className="vp-label">Directory readiness</p><div className="vp-compact-metrics"><div className="vp-metric"><span>Total partners</span><strong>{partners.length}</strong></div><div className="vp-metric"><span>Approved</span><strong>{approved}</strong></div><div className="vp-metric"><span>NDA ready</span><strong>{ndaReady}</strong></div></div></section>

    <section><div className="vp-section-title"><div><p className="vp-label">Primary object</p><h2>Execution partners</h2></div></div><div className="vp-list">{partners.length===0?<div className="vp-empty">No execution partners recorded.</div>:partners.map(p=><article className="vp-row" key={p.id}><div><h3>{p.company_name}</h3><p>{p.services || 'Capabilities not recorded'}</p></div><div className="vp-row-status">{workspaceLabel(p.status)} · {p.nda_signed?'NDA ready':'NDA outstanding'}</div><div><strong>{p.rating!==null?`${p.rating}/5`:'Not rated'}</strong></div></article>)}</div></section>
  </section>;
}
