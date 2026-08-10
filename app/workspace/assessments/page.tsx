import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { ProductEmptyState, ProductFilterBar, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductStatus } from '@/components/workspace/ProductUI';
import { workspaceLabel } from '@/lib/presentation/vocabulary';

type View = 'technical' | 'partner';
type QueueRow = { id:string; title:string|null; company_name:string; contact_name:string|null; lead_status:string; workflow_stage:string; created_at:string; total_count:number|string };

export default async function AssessmentsPage({ searchParams }: { searchParams?: Promise<Record<string,string|undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const view: View = params.view === 'partner' ? 'partner' : 'technical';
  const { supabase, organisationId } = await requireUserContext();
  const [technicalResult, partnerResult] = await Promise.all([
    supabase.rpc('op_case_queue',{p_organisation_id:organisationId,p_view:'assessment',p_limit:100,p_offset:0}),
    supabase.rpc('op_case_queue',{p_organisation_id:organisationId,p_view:'partner-review',p_limit:100,p_offset:0}),
  ]);
  if (technicalResult.error) throw new Error(`Technical assessment queue could not be loaded: ${technicalResult.error.message}`);
  if (partnerResult.error) throw new Error(`Partner assessment queue could not be loaded: ${partnerResult.error.message}`);
  const technical=(technicalResult.data||[]) as QueueRow[];
  const partner=(partnerResult.data||[]) as QueueRow[];
  const rows=view==='technical'?technical:partner;

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Work · Assessments" title="Assessment queue" description="Separate technical definition and execution-partner review from the general Case register, so specialists can work the queue without hunting through every case." actions={<Link className="button secondary" href="/workspace/leads">All cases</Link>} />
    <ProductMetrics label="Assessment workload">
      <ProductMetric label="Technical definition" value={technical.length} detail="Cases requiring scope or feasibility work" />
      <ProductMetric label="Partner review" value={partner.length} detail="Approved scope requiring partner evidence" />
      <ProductMetric label="Assessment workload" value={technical.length+partner.length} detail="Current specialist queue" tone={technical.length+partner.length?'attention':'complete'} />
      <ProductMetric label="Current view" value={view==='technical'?'Technical':'Partner'} detail="Use the tabs below to switch queue" />
    </ProductMetrics>
    <ProductFilterBar>
      <Link className={`button ${view==='technical'?'':'secondary'}`} href="/workspace/assessments?view=technical">Technical assessment</Link>
      <Link className={`button ${view==='partner'?'':'secondary'}`} href="/workspace/assessments?view=partner">Partner review</Link>
    </ProductFilterBar>
    {rows.length===0 ? <ProductEmptyState title="No cases in this assessment queue" description="Cases appear here automatically when their lifecycle reaches the selected assessment state." action={<Link className="button secondary" href="/workspace/leads">Open Cases</Link>} /> : <ProductRegister>
      {rows.map(row=><ProductRegisterRow key={row.id} href={`/workspace/leads/${row.id}`}>
        <div><strong>{row.title||row.company_name}</strong><p>{row.company_name}{row.contact_name?` · ${row.contact_name}`:''}</p></div>
        <ProductStatus tone="active">{workspaceLabel(row.workflow_stage as any,'lead')}</ProductStatus>
        <div><small>Workstream</small><strong style={{display:'block',marginTop:3}}>{view==='technical'?'Technical definition':'Partner evidence'}</strong></div>
        <strong>Open Case →</strong>
      </ProductRegisterRow>)}
    </ProductRegister>}
  </section>;
}
