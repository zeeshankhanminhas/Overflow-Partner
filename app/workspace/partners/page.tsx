import { requireUserContext } from '@/lib/auth/context';
import { listPartners } from '@/lib/repositories/workflow';
import { createPartnerFormAction } from '../workflow-actions';
import { workspaceLabel } from '@/lib/presentation/vocabulary';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

const input='border border-white/10 rounded-lg bg-white px-3 py-2 text-black';
function tone(status:string):ProductTone{if(status==='approved')return 'complete';if(status==='suspended')return 'blocked';if(status==='prospective')return 'waiting';return 'neutral'}

export default async function PartnersPage({ searchParams }: { searchParams?: Promise<Record<string,string|undefined>> }) {
  const params=searchParams?await searchParams:{};
  const {supabase,organisationId}=await requireUserContext();
  const partners=await listPartners(supabase,organisationId);
  const approved=partners.filter(p=>p.status==='approved').length;
  const ndaReady=partners.filter(p=>p.nda_signed).length;
  const needsNda=partners.filter(p=>p.status==='approved'&&!p.nda_signed).length;

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Commercial · Partners" title="Partner network" description="Manage approved Partners, NDA status and delivery capability in one place." actions={<details><summary className="button">Add partner</summary><div className="vp-toolbar-panel"><form action={createPartnerFormAction} className="stack"><div className="grid gap-4 md:grid-cols-2"><input className={input} name="company_name" placeholder="Company name" required/><input className={input} name="country" placeholder="Country"/><input className={input} name="contact_name" placeholder="Contact name"/><input className={input} name="email" type="email" placeholder="Email"/><input className={input} name="phone" placeholder="Phone"/><select className={input} name="status" defaultValue="prospective"><option value="prospective">Prospective</option><option value="approved">Approved</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select><select className={input} name="nda_signed" defaultValue="false"><option value="false">NDA not signed</option><option value="true">NDA signed</option></select><input className={input} name="rating" type="number" min="0" max="5" step="0.1" placeholder="Rating"/></div><textarea className={input} name="services" required rows={3} placeholder="Capabilities and services"/><textarea className={input} name="notes" rows={3} placeholder="Notes"/><button className="button">Add partner</button></form></div></details>} />

    {params.created?<ProductNotice title="Partner added" tone="complete"><p>The Partner is now available for assessment and project assignment.</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Partner could not be added" tone="blocked"><p>Review the Partner details and try again.</p></ProductNotice>:null}

    <ProductMetrics label="Partner network summary">
      <ProductMetric label="Network" value={partners.length} detail="Partners on record" />
      <ProductMetric label="Approved" value={approved} detail="Available for assignment" tone={approved?'complete':'neutral'} />
      <ProductMetric label="NDA ready" value={ndaReady} detail="Partners with signed NDA" />
      <ProductMetric label="Approved / NDA missing" value={needsNda} detail="Needs attention before sensitive work" tone={needsNda?'attention':'complete'} />
    </ProductMetrics>

    <section>
      <ProductSectionHeader eyebrow="Partner register" title="Partners" meta="Use Partner response history and delivery performance when comparing future assignments." />
      {partners.length===0?<ProductEmptyState title="No Partners yet" description="Add a Partner to make them available for technical assessment and project delivery." />:<ProductRegister>
        {partners.map(p=><ProductRegisterRow key={p.id}>
          <div><strong>{p.company_name}</strong><p>{p.services||'Capabilities not recorded'}{p.country?` · ${p.country}`:''}</p></div>
          <ProductStatus tone={tone(p.status)}>{workspaceLabel(p.status)}</ProductStatus>
          <div><small>Readiness</small><strong style={{display:'block',marginTop:3}}>{p.nda_signed?'NDA ready':'NDA required'}</strong></div>
          <div><small>Rating</small><strong style={{display:'block',marginTop:3}}>{p.rating!==null?`${p.rating}/5`:'Not rated'}</strong></div>
        </ProductRegisterRow>)}
      </ProductRegister>}
    </section>
  </section>;
}