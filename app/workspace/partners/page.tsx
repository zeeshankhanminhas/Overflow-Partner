import { requireUserContext } from '@/lib/auth/context';
import { listPartners } from '@/lib/repositories/workflow';
import { createPartnerFormAction } from '../workflow-actions';
import { approvePartnerAction, suspendPartnerAction } from './actions';
import { workspaceLabel } from '@/lib/presentation/vocabulary';
import { ActionDialog } from '@/components/workspace/InteractionPrimitives';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

const input='border border-white/10 rounded-lg bg-white px-3 py-2 text-black';
function tone(status:string):ProductTone{if(status==='approved')return 'complete';if(status==='suspended')return 'blocked';if(status==='prospective')return 'waiting';return 'neutral'}

export default async function PartnersPage({ searchParams }: { searchParams?: Promise<Record<string,string|undefined>> }) {
  const params=searchParams?await searchParams:{};
  const {supabase,organisationId}=await requireUserContext();
  const partners=await listPartners(supabase,organisationId);
  const approved=partners.filter(p=>p.status==='approved').length;
  const ndaReady=partners.filter(p=>p.nda_signed).length;

  return <section className="vp-page">
    <ProductPageHeader
      eyebrow="Commercial · Partners"
      title="Execution partner network"
      description="Maintain Partner identity and selection-relevant capability here. Approval and suspension are explicit authority actions; NDA and performance remain governed evidence."
      actions={<ActionDialog title="Add execution partner" triggerLabel="Add partner" description="Create the Partner identity and capability record. New Partners always start as Prospective."><form action={createPartnerFormAction} className="stack"><div className="grid gap-4 md:grid-cols-2"><input className={input} name="company_name" placeholder="Company name" required/><input className={input} name="country" placeholder="Country"/><input className={input} name="contact_name" placeholder="Contact name"/><input className={input} name="email" type="email" placeholder="Email"/><input className={input} name="phone" placeholder="Phone"/></div><textarea className={input} name="services" required rows={3} placeholder="Capabilities and services"/><textarea className={input} name="notes" rows={3} placeholder="Optional context"/><button className="button">Add prospective partner</button></form></ActionDialog>}
    />

    {params.created?<ProductNotice title="Partner added" tone="complete"><p>The Partner starts as Prospective. Approval is a separate authority decision after the relevant evidence is available.</p></ProductNotice>:null}
    {params.updated?<ProductNotice title="Partner authority updated" tone="complete"><p>{params.updated}</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Partner action could not be completed" tone="blocked"><p>{params.error}</p></ProductNotice>:null}

    <ProductMetrics label="Partner network summary">
      <ProductMetric label="Network" value={partners.length} detail="Execution partners on record" />
      <ProductMetric label="Approved" value={approved} detail="Currently approved for governed selection" tone={approved?'complete':'neutral'} />
      <ProductMetric label="NDA ready" value={ndaReady} detail="Signed confidentiality evidence on record" />
    </ProductMetrics>

    <section>
      <ProductSectionHeader eyebrow="Partner register" title="Execution partners" meta="Capability, authority and current readiness only. Performance is shown only where evidence exists." />
      {partners.length===0?<ProductEmptyState title="No execution partners yet" description="Add a Partner to begin their governed readiness process." />:<ProductRegister>
        {partners.map(p=><ProductRegisterRow key={p.id}>
          <div><strong>{p.company_name}</strong><p>{p.services||'Capabilities not recorded'}{p.country?` · ${p.country}`:''}</p></div>
          <ProductStatus tone={tone(p.status)}>{workspaceLabel(p.status)}</ProductStatus>
          <div><small>Readiness</small><strong style={{display:'block',marginTop:3}}>{p.nda_signed?'NDA evidence complete':'NDA evidence pending'}</strong>{p.rating!==null?<small style={{display:'block',marginTop:4}}>Performance evidence · {p.rating}/5</small>:null}</div>
          <div className="product-row-actions">
            {p.status!=='approved'?<ActionDialog title={p.status==='suspended'?'Restore Partner approval':'Approve Partner'} triggerLabel={p.status==='suspended'?'Restore approval':'Approve'} triggerTone="secondary" description="This is an explicit commercial authority action. It changes Partner availability for governed selection."><form action={approvePartnerAction} className="stack"><input type="hidden" name="partner_id" value={p.id}/><p><strong>{p.company_name}</strong></p><p>Confirm that the available Partner evidence supports approval.</p><button className="button">Confirm approval</button></form></ActionDialog>:null}
            {p.status==='approved'?<ActionDialog title="Suspend Partner" triggerLabel="Suspend" triggerTone="secondary" description="Suspension removes the Partner from normal governed selection without deleting their history or evidence."><form action={suspendPartnerAction} className="stack"><input type="hidden" name="partner_id" value={p.id}/><p><strong>{p.company_name}</strong></p><label>Reason<textarea name="reason" rows={3} required placeholder="Why is this Partner being suspended?"/></label><button className="button">Confirm suspension</button></form></ActionDialog>:null}
          </div>
        </ProductRegisterRow>)}
      </ProductRegister>}
    </section>
  </section>;
}
