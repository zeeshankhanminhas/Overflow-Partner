import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';

export default async function SearchPage({searchParams}:{searchParams?:Promise<Record<string,string|undefined>>}){
  const params=searchParams?await searchParams:{};const q=String(params.q||'').trim();const {supabase,organisationId}=await requireUserContext();
  let results:any[]=[];let error:string|null=null;
  if(q.length>=2){const response=await supabase.rpc('op_global_search',{p_organisation_id:organisationId,p_query:q,p_limit:60});results=response.data||[];error=response.error?.message||null;}
  return <section className="vp-page">
    <header className="vp-header"><div><p className="vp-kicker">Enterprise search</p><h1>Find the business record, not the folder.</h1><p className="vp-subtitle">Search Cases, Projects, controlled documents, partners, invoices, risks and reusable knowledge from one governed index.</p></div><Link className="button secondary" href="/workspace/knowledge">Knowledge library</Link></header>
    <form method="get" className="card" style={{width:'100%',display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:12}}><input autoFocus name="q" defaultValue={q} placeholder="Search project number, client, drawing, invoice, partner, risk, lesson…"/><button className="button">Search</button></form>
    {error?<div className="vp-callout"><strong>Search unavailable</strong><p>{error}</p></div>:null}
    {q.length>0&&q.length<2?<div className="vp-callout"><strong>Type at least two characters.</strong></div>:null}
    <section className="card" style={{width:'100%'}}><div className="vp-section-title"><div><p className="vp-label">Results</p><h2>{q?`${results.length} matches for “${q}”`:'Search the workspace'}</h2></div></div><div className="vp-list">{results.map((item:any)=><Link className="vp-row" href={item.href} key={`${item.entity_type}-${item.entity_id}`}><div><strong>{item.title}</strong><p>{item.subtitle||'No additional context'}</p></div><div className="vp-row-status">{String(item.entity_type).replaceAll('_',' ')}</div><div><strong>Open →</strong></div></Link>)}{q&&results.length===0&&!error?<div className="vp-empty">No governed records match this search.</div>:null}</div></section>
  </section>;
}
