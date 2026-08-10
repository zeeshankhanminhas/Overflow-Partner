import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listProspects } from '@/lib/repositories/prospects';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

function tone(status:string):ProductTone{if(status==='qualified')return 'complete';if(['new','contacted'].includes(status))return 'active';if(['waiting','intake_sent'].includes(status))return 'waiting';return 'neutral'}

export default async function ProspectRegisterPage(){
  const {supabase,organisationId}=await requireUserContext();
  const allProspects=await listProspects(supabase,organisationId);
  const prospects=allProspects.filter(item=>item.status!=='converted');
  const qualified=prospects.filter(item=>item.status==='qualified').length;
  const inProgress=prospects.filter(item=>item.status!=='qualified').length;

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Work · Acquisition" title="Prospects" description="New opportunities stay here until qualification creates a governed Case. Converted records leave the active register automatically." actions={<Link className="button secondary" href="/workspace/acquisition">Acquisition overview</Link>} />
    <ProductMetrics label="Prospect summary">
      <ProductMetric label="In progress" value={inProgress} detail="Still being qualified" tone={inProgress?'active':'neutral'} />
      <ProductMetric label="Ready for Case" value={qualified} detail="Qualification complete" tone={qualified?'complete':'neutral'} />
      <ProductMetric label="Active prospects" value={prospects.length} detail="Current acquisition workload" />
      <ProductMetric label="Lifecycle owner" value="Acquisition" detail="Converted work moves to Cases" />
    </ProductMetrics>
    <section>
      <ProductSectionHeader eyebrow="Prospect register" title="Active opportunities" />
      {prospects.length===0?<ProductEmptyState title="No active prospects" description="Add or capture a prospect in Acquisition to start the qualification workflow." action={<Link className="button secondary" href="/workspace/acquisition#manual-prospect">Add prospect</Link>} />:<ProductRegister>
        {prospects.map(item=><ProductRegisterRow href={`/workspace/acquisition/${item.id}`} key={item.id}>
          <div><strong>{item.company_name}</strong><p>{item.contact_name||'Contact not recorded'} · {item.source}</p></div>
          <ProductStatus tone={tone(item.status)}>{item.status.replaceAll('_',' ')}</ProductStatus>
          <div><small>Requirement</small><strong style={{display:'block',marginTop:3}}>{item.requirement_summary||'Not defined'}</strong></div>
          <strong>Open Prospect →</strong>
        </ProductRegisterRow>)}
      </ProductRegister>}
    </section>
  </section>;
}
