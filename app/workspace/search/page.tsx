import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { resolveLifecycleOwnership } from '@/lib/lifecycle/ownership';
import { ProductEmptyState, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

function typeOf(item:any){return String(item.entity_type||'').toLowerCase();}
function ResultRows({items,empty}:{items:any[];empty?:string}){return items.length?<ProductRegister>{items.map((item:any)=><ProductRegisterRow href={item.href} key={`${item.entity_type}-${item.entity_id}`}><div><strong>{item.title}</strong><p>{item.subtitle||'No additional details'}</p></div><ProductStatus>{String(item.entity_type).replaceAll('_',' ')}</ProductStatus><span/><strong>Open →</strong></ProductRegisterRow>)}</ProductRegister>:empty?<ProductEmptyState title={empty}/>:null}

export default async function SearchPage({searchParams}:{searchParams?:Promise<Record<string,string|undefined>>}){
  const params=searchParams?await searchParams:{};const q=String(params.q||'').trim();const {supabase,organisationId}=await requireUserContext();let results:any[]=[];let error:string|null=null;
  if(q.length>=2){const response=await supabase.rpc('op_global_search',{p_organisation_id:organisationId,p_query:q,p_limit:60});results=response.data||[];error=response.error?.message||null;}
  const leadIds=results.filter(item=>['lead','case'].includes(typeOf(item))).map(item=>String(item.entity_id));const prospectIds=results.filter(item=>typeOf(item)==='prospect').map(item=>String(item.entity_id));const projectIds=results.filter(item=>typeOf(item)==='project').map(item=>String(item.entity_id));
  const [projectsByLeadResult,projectsByIdResult,prospectsResult]=await Promise.all([leadIds.length?supabase.from('projects').select('id,lead_id,status,project_stage').eq('organisation_id',organisationId).in('lead_id',leadIds):Promise.resolve({data:[] as any[],error:null}),projectIds.length?supabase.from('projects').select('id,lead_id,status,project_stage').eq('organisation_id',organisationId).in('id',projectIds):Promise.resolve({data:[] as any[],error:null}),prospectIds.length?supabase.from('prospects').select('id,status,converted_lead_id').eq('organisation_id',organisationId).in('id',prospectIds):Promise.resolve({data:[] as any[],error:null})]);
  const projectByLead=new Map((projectsByLeadResult.data||[]).map((p:any)=>[String(p.lead_id),p]));const projectById=new Map((projectsByIdResult.data||[]).map((p:any)=>[String(p.id),p]));const prospectById=new Map((prospectsResult.data||[]).map((p:any)=>[String(p.id),p]));const current:any[]=[];const history:any[]=[];const evidence:any[]=[];const other:any[]=[];
  for(const item of results){const type=typeOf(item);const id=String(item.entity_id);if(type.includes('document')||type.includes('evidence')){evidence.push(item);continue;}if(type==='prospect'){const p:any=prospectById.get(id);const ownership=resolveLifecycleOwnership({prospectId:id,prospectStatus:p?.status,convertedCaseId:p?.converted_lead_id});(ownership.owner==='prospect'?current:history).push(item);continue;}if(['lead','case'].includes(type)){const p:any=projectByLead.get(id);const ownership=resolveLifecycleOwnership({caseId:id,projectId:p?.id,projectStatus:p?.status,projectStage:p?.project_stage});(ownership.owner==='case'?current:history).push(item);continue;}if(type==='project'){const p:any=projectById.get(id);const ownership=resolveLifecycleOwnership({caseId:p?.lead_id,projectId:id,projectStatus:p?.status,projectStage:p?.project_stage});(ownership.owner==='project'?current:history).push(item);continue;}other.push(item);}

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Admin · Search" title="Search the workspace" description="Find current projects, Cases, documents, invoices, partners, risks and saved knowledge without knowing which module owns the record." actions={<Link className="button secondary" href="/workspace/knowledge">Knowledge</Link>} />
    <form method="get" className="product-toolbar"><input autoFocus name="q" type="search" defaultValue={q} placeholder="Project number, customer, drawing, invoice, partner, risk…" style={{flex:'1 1 420px'}}/><button className="button">Search</button></form>
    {error?<ProductNotice title="Search is temporarily unavailable" tone="blocked"><p>Try again. If the problem continues, check the workspace data connection.</p></ProductNotice>:null}
    {q.length>0&&q.length<2?<ProductNotice title="Enter at least two characters" tone="attention"/>:null}
    {q&&results.length>0?<>
      <section><ProductSectionHeader eyebrow="Active work" title={`Current records · ${current.length}`}/><ResultRows items={current} empty="No active records match this search."/></section>
      {evidence.length?<section><ProductSectionHeader eyebrow="Controlled evidence" title={`Documents and evidence · ${evidence.length}`}/><ResultRows items={evidence}/></section>:null}
      {other.length?<section><ProductSectionHeader eyebrow="Related records" title={`Other matches · ${other.length}`}/><ResultRows items={other}/></section>:null}
      {history.length?<details className="vp-disclosure"><summary>Previous records · {history.length}</summary><div style={{paddingTop:14}}><p style={{color:'var(--saas-muted)',fontSize:11}}>These records remain for history and audit. Active ownership has moved to a newer lifecycle record.</p><ResultRows items={history}/></div></details>:null}
    </>:<ProductEmptyState title={q?`No matches for “${q}”`:'Search across Overflow Partner'} description={q?'Try a project number, company, document reference or shorter search term.':'Enter at least two characters to search live workspace records.'}/>} 
  </section>;
}
