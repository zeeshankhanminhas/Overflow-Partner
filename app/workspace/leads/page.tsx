import Link from 'next/link';
import LeadForm from '@/components/workspace/LeadForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';
import { resolveCaseQueuePresentation } from '@/lib/presentation/queueState';
import { ProductEmptyState, ProductFilterBar, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

type View='all'|'assessment'|'partner-review'|'partner-pricing'|'commercial-review'|'client-quotes';
type QueueRow={id:string;title:string|null;company_name:string;contact_name:string|null;lead_status:string;workflow_stage:string;created_at:string;total_count:number|string};
const PAGE_SIZE=25;
const viewMeta:Record<View,{label:string;title:string;subtitle:string}>={
  all:{label:'All active',title:'Cases',subtitle:'Qualified work owned by Case 360. Project-owned delivery is excluded automatically.'},
  assessment:{label:'Technical basis',title:'Technical basis',subtitle:'Cases requiring controlled technical definition or approval.'},
  'partner-review':{label:'Partner evidence',title:'Partner evidence',subtitle:'Compatibility view for inherited Acquisition Partner evidence that needs attention. Case 360 does not start another Partner Assessment.'},
  'partner-pricing':{label:'Partner price',title:'Partner price',subtitle:'Inherited governed Partner cost ready for the commercial position.'},
  'commercial-review':{label:'Commercial decision',title:'Commercial decision',subtitle:'Controlled Partner cost being converted into the approved client selling position.'},
  'client-quotes':{label:'Client Quotes',title:'Client Quotes',subtitle:'Controlled quotation preparation, issue and client decision before Project 360 handoff.'},
};
function pageHref(view:View,page:number){const p=new URLSearchParams();if(view!=='all')p.set('view',view);if(page>1)p.set('page',String(page));const q=p.toString();return `/workspace/leads${q?`?${q}`:''}`}

export default async function LeadsPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const params=searchParams?await searchParams:{};const requested=String(params.view||'all');const view=(Object.keys(viewMeta).includes(requested)?requested:'all') as View;const requestedPage=Number.parseInt(String(params.page||'1'),10);const page=Number.isFinite(requestedPage)&&requestedPage>0?requestedPage:1;const meta=viewMeta[view];
  const {supabase,organisationId}=await requireUserContext();
  const [{data,error},companies,contacts]=await Promise.all([
    supabase.rpc('op_case_queue',{p_organisation_id:organisationId,p_view:view,p_limit:PAGE_SIZE,p_offset:(page-1)*PAGE_SIZE}),
    listCompanies(supabase,organisationId),listContacts(supabase,organisationId),
  ]);if(error)throw new Error(`Case queue could not be loaded: ${error.message}`);
  const candidateRows=(data||[]) as QueueRow[];const caseIds=candidateRows.map(row=>row.id);const projectLinks=caseIds.length?await supabase.from('projects').select('lead_id').eq('organisation_id',organisationId).in('lead_id',caseIds):{data:[] as {lead_id:string}[],error:null};if(projectLinks.error)throw new Error(`Lifecycle ownership could not be resolved: ${projectLinks.error.message}`);const projectOwned=new Set((projectLinks.data||[]).map(item=>item.lead_id));const rows=candidateRows.filter(row=>!projectOwned.has(row.id)).map(row=>({row,presentation:resolveCaseQueuePresentation(row.workflow_stage)}));const sourceTotal=candidateRows.length?Number(candidateRows[0].total_count||0):0;const total=Math.max(0,sourceTotal-(candidateRows.length-rows.length));const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const approvals=rows.filter(item=>item.presentation.approval?.required).length;const attention=rows.filter(item=>['attention','blocked','critical'].includes(item.presentation.tone)).length;const waiting=rows.filter(item=>item.presentation.tone==='waiting'&&!item.presentation.approval?.required).length;

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Work · Cases" title={meta.title} description={meta.subtitle} actions={<><Link className="button secondary" href="/workspace/approvals">Approvals{approvals?` · ${approvals}`:''}</Link><Link className="button secondary" href="/workspace/assessments">Assessments</Link></>} />

    {params.created?<ProductNotice title="Case created" tone="complete"><p>The direct Case is now available in the operating register.</p></ProductNotice>:null}
    {params.converted?<ProductNotice title="Enquiry converted" tone="complete"><p>The qualified opportunity is now a governed Case.</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Case action could not be completed" tone="blocked"><p>{String(params.error)}</p></ProductNotice>:null}

    <ProductMetrics label="Case queue summary">
      <ProductMetric label="Records in view" value={rows.length} detail="Visible on this page" />
      <ProductMetric label="Approvals" value={approvals} detail="Authority decisions due" tone={approvals?'waiting':'complete'} />
      <ProductMetric label="Needs attention" value={attention} detail="Integrity or evidence issues" tone={attention?'attention':'complete'} />
      <ProductMetric label="Waiting" value={waiting} detail="Normal external dependency" tone={waiting?'waiting':'neutral'} />
    </ProductMetrics>

    <ProductFilterBar>{(Object.keys(viewMeta) as View[]).map(key=><Link key={key} className={`button ${view===key?'':'secondary'}`} href={pageHref(key,1)}>{viewMeta[key].label}</Link>)}</ProductFilterBar>

    <section>
      <ProductSectionHeader eyebrow="Operating register" title={`${total} Case${total===1?'':'s'}`} meta="Every row describes the operating state, not the underlying queue enum." />
      {rows.length===0?<ProductEmptyState title="No Cases in this view" description="The queue updates automatically as lifecycle ownership and state change." />:<ProductRegister>
        {rows.map(({row,presentation})=><ProductRegisterRow href={`/workspace/leads/${row.id}`} key={row.id}>
          <div><strong>{row.title||row.company_name}</strong><p>{row.company_name}{row.contact_name?` · ${row.contact_name}`:''}</p><small>{presentation.summary}</small></div>
          <ProductStatus tone={presentation.tone}>{presentation.state}</ProductStatus>
          <div><small>{presentation.waitingOn?'Waiting on':'Owner'}</small><strong style={{display:'block',marginTop:3}}>{presentation.waitingOn?.label||'Overflow Partner'}</strong></div>
          <strong>{presentation.nextAction.label}{presentation.nextAction.available?' →':''}</strong>
        </ProductRegisterRow>)}
      </ProductRegister>}
      {totalPages>1?<nav className="vp-pagination" aria-label="Case queue pages" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginTop:16}}>{page>1?<Link className="button secondary" href={pageHref(view,page-1)}>← Previous</Link>:<span/>}<span style={{color:'var(--saas-muted)',fontSize:11}}>Page {Math.min(page,totalPages)} of {totalPages}</span>{page<totalPages?<Link className="button secondary" href={pageHref(view,page+1)}>Next →</Link>:<span/>}</nav>:null}
    </section>

    <details className="vp-disclosure" style={{marginTop:20}}>
      <summary>Advanced · create Case without Acquisition handoff</summary>
      <div className="vp-toolbar-panel">
        <p style={{marginTop:0,color:'var(--op-muted)'}}>Exceptional entry is not part of the normal operator journey. Use it only when a governed Acquisition handoff genuinely cannot be used.</p>
        {companies.length?<LeadForm companies={companies} contacts={contacts}/>:<ProductEmptyState title="Create a company first" description="A direct Case still needs a governed company record." action={<Link href="/workspace/companies">Add company →</Link>}/>} 
      </div>
    </details>
  </section>;
}