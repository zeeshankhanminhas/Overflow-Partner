import { requireUserContext } from '@/lib/auth/context';
import { normaliseWorkspaceSearchQuery, searchWorkspace } from '@/lib/search/workspaceSearch';
import { ProductEmptyState, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

export default async function SearchPage({searchParams}:{searchParams?:Promise<Record<string,string|undefined>>}){
  const params=searchParams?await searchParams:{};const q=normaliseWorkspaceSearchQuery(String(params.q||''));const {supabase,organisationId}=await requireUserContext();let results:Awaited<ReturnType<typeof searchWorkspace>>=[];let error:string|null=null;
  if(q.length>=2){try{results=await searchWorkspace(supabase,organisationId,q,60);}catch(cause){error=cause instanceof Error?cause.message:'Search unavailable.';}}
  return <section className="vp-page">
    <ProductPageHeader eyebrow="Utility · Search" title="Find a record" description="Search known business records once and open the authoritative record or register directly. Search is navigation, not another operating dashboard." />
    <form method="get" className="product-toolbar"><input autoFocus name="q" type="search" defaultValue={q} placeholder="Company, Project, Partner, Case, Quote, document or Enquiry" style={{flex:'1 1 420px'}}/><button className="button">Search</button></form>
    {error?<ProductNotice title="Search is temporarily unavailable" tone="blocked"><p>Try again. If the problem continues, check the workspace data connection.</p></ProductNotice>:null}
    {q.length>0&&q.length<2?<ProductNotice title="Enter at least two characters" tone="attention"/>:null}
    {q.length>=2?<section><ProductSectionHeader eyebrow="Direct navigation" title={`${results.length} match${results.length===1?'':'es'}`} meta="Results open the authoritative source record; no shadow record is created here." />{results.length?<ProductRegister>{results.map(item=><ProductRegisterRow href={item.href} key={`${item.entity_type}-${item.entity_id}`}><div><strong>{item.title}</strong><p>{item.subtitle||'No additional details'}</p></div><ProductStatus>{item.entity_type.replaceAll('_',' ')}</ProductStatus><span/><strong>Open →</strong></ProductRegisterRow>)}</ProductRegister>:<ProductEmptyState title={`No matches for “${q}”`} description="Try a project number, company, Partner, Case, Quote reference, controlled document reference or Enquiry."/>}</section>:<ProductEmptyState title="Search across Overflow Partner" description="Enter at least two characters to jump directly to a governed record."/>}
  </section>;
}
