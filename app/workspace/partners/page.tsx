import { requireUserContext } from '@/lib/auth/context';
import { listPartners } from '@/lib/repositories/workflow';
import { createPartnerFormAction } from '../workflow-actions';
import { workspaceLabel } from '@/lib/presentation/vocabulary';
import { ContextActions, InteractionFact, InteractionFacts, WorkWindow, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
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

  const addPartner=<WorkWindow triggerLabel="Add partner" triggerClassName="button" eyebrow="Partner master" title="Add Execution Partner" description="Create the controlled Partner master record without expanding the directory page into a form workspace.">
    <form action={createPartnerFormAction} className="stack">
      <div className="grid gap-4 md:grid-cols-2">
        <input className={input} name="company_name" placeholder="Company name" required/>
        <input className={input} name="country" placeholder="Country"/>
        <input className={input} name="contact_name" placeholder="Contact name"/>
        <input className={input} name="email" type="email" placeholder="Email"/>
        <input className={input} name="phone" placeholder="Phone"/>
        <select className={input} name="status" defaultValue="prospective"><option value="prospective">Prospective</option><option value="approved">Approved</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select>
        <select className={input} name="nda_signed" defaultValue="false"><option value="false">NDA not signed</option><option value="true">NDA signed</option></select>
        <input className={input} name="rating" type="number" min="0" max="5" step="0.1" placeholder="Rating"/>
      </div>
      <textarea className={input} name="services" required rows={3} placeholder="Capabilities and services"/>
      <textarea className={input} name="notes" rows={3} placeholder="Notes"/>
      <button className="button">Add partner</button>
    </form>
  </WorkWindow>;

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Commercial · Partners" title="Execution partner network" description="Choose a Partner from the controlled directory. Inspect readiness and capability without leaving the register; use the focused work window only to create a new Partner record." actions={addPartner} />

    {params.created?<ProductNotice title="Partner added" tone="complete"><p>The partner is now available for governed review and assignment.</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Partner could not be added" tone="blocked"><p>Review the partner details and try again.</p></ProductNotice>:null}

    <ProductMetrics label="Partner network summary">
      <ProductMetric label="Network" value={partners.length} detail="Execution partners on record" />
      <ProductMetric label="Approved" value={approved} detail="Available for governed assignment" tone={approved?'complete':'neutral'} />
      <ProductMetric label="NDA ready" value={ndaReady} detail="Partners with signed confidentiality control" />
      <ProductMetric label="Approved / NDA missing" value={needsNda} detail="Readiness gap requiring attention" tone={needsNda?'attention':'complete'} />
    </ProductMetrics>

    <section>
      <ProductSectionHeader eyebrow="Partner register" title="Execution partners" meta="Use partner performance in Executive Intelligence when comparing response reliability." />
      {partners.length===0?<ProductEmptyState title="No execution partners yet" description="Add a partner to make them available for technical review and delivery assignment." />:<ProductRegister>
        {partners.map(p=><ProductRegisterRow key={p.id}>
          <div><strong>{p.company_name}</strong><p>{p.services||'Capabilities not recorded'}{p.country?` · ${p.country}`:''}</p></div>
          <ProductStatus tone={tone(p.status)}>{workspaceLabel(p.status)}</ProductStatus>
          <div><small>Commercial readiness</small><strong style={{display:'block',marginTop:3}}>{p.nda_signed?'NDA ready':'NDA required'}</strong></div>
          <ContextActions label={`Actions for ${p.company_name}`}>
            <WorkspaceDrawer triggerLabel="Inspect" eyebrow="Execution Partner" title={p.company_name} description="Partner master data and readiness context." >
              <InteractionFacts>
                <InteractionFact label="Status">{workspaceLabel(p.status)}</InteractionFact>
                <InteractionFact label="NDA">{p.nda_signed?'Signed':'Required'}</InteractionFact>
                <InteractionFact label="Country">{p.country||'Not recorded'}</InteractionFact>
                <InteractionFact label="Rating">{p.rating!==null?`${p.rating}/5`:'Not rated'}</InteractionFact>
                <InteractionFact label="Contact">{p.contact_name||'Not recorded'}</InteractionFact>
                <InteractionFact label="Email">{p.email||'Not recorded'}</InteractionFact>
              </InteractionFacts>
              <p className="interaction-summary__lead">{p.services||'Capabilities have not been recorded yet.'}</p>
              {p.notes?<div className="product-panel" style={{marginTop:14}}><p className="product-eyebrow">Notes</p><p style={{margin:'6px 0 0',color:'var(--saas-muted)',fontSize:12,lineHeight:1.6}}>{p.notes}</p></div>:null}
            </WorkspaceDrawer>
          </ContextActions>
        </ProductRegisterRow>)}
      </ProductRegister>}
    </section>
  </section>;
}
