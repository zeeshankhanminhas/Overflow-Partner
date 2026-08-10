import Link from 'next/link';
import LeadForm from '@/components/workspace/LeadForm';
import { requireUserContext } from '@/lib/auth/context';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';
import { workspaceLabel } from '@/lib/presentation/vocabulary';
import { ProductEmptyState, ProductFilterBar, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

type View='all'|'assessment'|'partner-review'|'partner-pricing'|'commercial-review'|'client-quotes';
type QueueRow={id:string;title:string|null;company_name:string;contact_name:string|null;lead_status:string;workflow_stage:string;created_at:string;total_count:number|string};
const PAGE_SIZE=25;
const viewMeta:Record<View,{label:string;title:string;subtitle:string}>={
  all:{label:'All active',title:'Cases',subtitle:'Qualified work owned by Case 360. When delivery ownership moves to a Project, the Case becomes lineage rather than another active queue item.'},
  assessment:{label:'Assessment',title:'Technical assessment',subtitle:'Cases requiring technical definition, feasibility or execution evidence.'},
  'partner-review':{label:'Partner review',title:'Partner review',subtitle:'Approved technical scopes requiring partner feasibility, capacity or technical evidence.'},
  'partner-pricing':{label:'Partner pricing',title:'Partner pricing',subtitle:'External delivery cost and lead-time evidence ready for commercial review.'},
  'commercial-review':{label:'Commercial review',title:'Commercial review',subtitle:'Approved partner cost being converted into the controlled client selling position.'},
  'client-quotes':{label:'Client quotes',title:'Client quotation',subtitle:'Draft, issued or concluded quotations remain attached to their Case until delivery ownership moves to Project 360.'},
};
function pageHref(view:View,page:number){const p=new URLSearchParams();if(view!=='all')p.set('view',view);if(page>1)p.set('page',String(page));const q=p.toString();return `/workspace/leads${q?`?${q}`:''}`}

export default async function LeadsPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const params=searchParams?await searchParams:{};const requested=String(params.view||'all');const view=(Object.keys(viewMeta).includes(requested)?requested:'all') as View;const requestedPage=Number.parseInt(String(params.page||'1'),10);const page=Number.isFinite(requestedPage)&&requestedPage>0?requestedPage:1;const meta=viewMeta[view];
  const {supabase,organisationId}=await requireUserContext();
  const [{data,error},companies,contacts]=await Promise.all([
    supabase.rpc('op_case_queue',{p_organisation_id:organisationId,p_view:view,p_limit:PAGE_SIZE,p_offset:(page-1)*PAGE_SIZE}),
    listCompanies(supabase,organisationId),listContacts(supabase,organisationId),
  ]);if(error)throw new Error(`Case queue could not be loaded: ${error.message}`);
  const candidateRows=(data||[]) as QueueRow[];const caseIds=candidateRows.map(row=>row.id);const projectLinks=caseIds.length?await supabase.from('projects').select('lead_id').eq('organisation_id',organisationId).in('lead_id',caseIds):{data:[] as {lead_id:string}[],error:null};if(projectLinks.error)throw new Error(`Lifecycle ownership could not be resolved: ${projectLinks.error.message}`);const projectOwned=new Set((projectLinks.data||[]).map(item=>item.lead_id));const rows=candidateRows.filter(row=>!projectOwned.has(row.id));const sourceTotal=candidateRows.length?Number(candidateRows[0].total_count||0):0;const total=Math.max(0,sourceTotal-(candidateRows.length-rows.length));const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Work · Cases" title={meta.title} description={meta.subtitle} actions={<><Link className="button secondary" href="/workspace/assessments">Assessment queue</Link><details><summary className="button secondary">Exceptional entry</summary><div className="vp-toolbar-panel">{companies.length?<LeadForm companies={companies} contacts={contacts}/>:<ProductEmptyState title="Create a company first" description="A direct Case still needs a governed company record." action={<Link href="/workspace/companies">Add company →</Link>}/>}</div></details></>} />

    {params.created?<ProductNotice title="Case created" tone="complete"><p>The direct Case is now available in the operating register.</p></ProductNotice>:null}
    {params.converted?<ProductNotice title="Prospect converted" tone="complete"><p>The qualified opportunity is now a governed Case.</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Case action could not be completed" tone="blocked"><p>{String(params.error)}</p></ProductNotice>:null}

    <ProductMetrics label="Case queue summary">
      <ProductMetric label="Records in view" value={rows.length} detail="Visible on this page" />
      <ProductMetric label="Total in queue" value={total} detail={view==='all'?'Active Case-owned work':viewMeta[view].label} />
      <ProductMetric label="Page" value={`${Math.min(page,totalPages)} / ${totalPages}`} detail={`${PAGE_SIZE} records per page`} />
      <ProductMetric label="Lifecycle ownership" value="Case" detail="Projects are excluded automatically" tone="active" />
    </ProductMetrics>

    <ProductFilterBar>{(Object.keys(viewMeta) as View[]).map(key=><Link key={key} className={`button ${view===key?'':'secondary'}`} href={pageHref(key,1)}>{viewMeta[key].label}</Link>)}</ProductFilterBar>

    <section>
      <ProductSectionHeader eyebrow="Operating register" title={`${total} case${total===1?'':'s'}`} meta="Open only the record that needs a decision or stage action." />
      {rows.length===0?<ProductEmptyState title="No Cases in this view" description="The queue updates automatically as lifecycle ownership and stage change." />:<ProductRegister>
        {rows.map(row=><ProductRegisterRow href={`/workspace/leads/${row.id}`} key={row.id}>
          <div><strong>{row.title||row.company_name}</strong><p>{row.company_name}{row.contact_name?` · ${row.contact_name}`:''}</p></div>
          <ProductStatus tone="active">{workspaceLabel(row.workflow_stage as any,'lead')}</ProductStatus>
          <div><small>Created</small><strong style={{display:'block',marginTop:3}}>{new Date(row.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</strong></div>
          <strong>Open Case →</strong>
        </ProductRegisterRow>)}
      </ProductRegister>}
      {totalPages>1?<nav className="vp-pagination" aria-label="Case queue pages" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginTop:16}}>{page>1?<Link className="button secondary" href={pageHref(view,page-1)}>← Previous</Link>:<span/>}<span style={{color:'var(--saas-muted)',fontSize:11}}>Page {Math.min(page,totalPages)} of {totalPages}</span>{page<totalPages?<Link className="button secondary" href={pageHref(view,page+1)}>Next →</Link>:<span/>}</nav>:null}
    </section>
  </section>;
}
