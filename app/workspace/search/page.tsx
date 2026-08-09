import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { resolveLifecycleOwnership } from '@/lib/lifecycle/ownership';

function typeOf(item:any){return String(item.entity_type||'').toLowerCase();}
function ResultRows({items,empty}:{items:any[];empty?:string}){return <div className="vp-list">{items.map((item:any)=><Link className="vp-row" href={item.href} key={`${item.entity_type}-${item.entity_id}`}><div><strong>{item.title}</strong><p>{item.subtitle||'No additional details'}</p></div><div className="vp-row-status">{String(item.entity_type).replaceAll('_',' ')}</div><div><strong>Open →</strong></div></Link>)}{items.length===0&&empty?<div className="vp-empty">{empty}</div>:null}</div>}

export default async function SearchPage({searchParams}:{searchParams?:Promise<Record<string,string|undefined>>}){
  const params=searchParams?await searchParams:{};const q=String(params.q||'').trim();const {supabase,organisationId}=await requireUserContext();
  let results:any[]=[];let error:string|null=null;
  if(q.length>=2){const response=await supabase.rpc('op_global_search',{p_organisation_id:organisationId,p_query:q,p_limit:60});results=response.data||[];error=response.error?.message||null;}

  const leadIds=results.filter(item=>['lead','case'].includes(typeOf(item))).map(item=>String(item.entity_id));
  const prospectIds=results.filter(item=>typeOf(item)==='prospect').map(item=>String(item.entity_id));
  const projectIds=results.filter(item=>typeOf(item)==='project').map(item=>String(item.entity_id));
  const [projectsByLeadResult,projectsByIdResult,prospectsResult]=await Promise.all([
    leadIds.length?supabase.from('projects').select('id,lead_id,status,project_stage').eq('organisation_id',organisationId).in('lead_id',leadIds):Promise.resolve({data:[] as any[],error:null}),
    projectIds.length?supabase.from('projects').select('id,lead_id,status,project_stage').eq('organisation_id',organisationId).in('id',projectIds):Promise.resolve({data:[] as any[],error:null}),
    prospectIds.length?supabase.from('prospects').select('id,status,converted_lead_id').eq('organisation_id',organisationId).in('id',prospectIds):Promise.resolve({data:[] as any[],error:null}),
  ]);
  const projectByLead=new Map((projectsByLeadResult.data||[]).map((p:any)=>[String(p.lead_id),p]));
  const projectById=new Map((projectsByIdResult.data||[]).map((p:any)=>[String(p.id),p]));
  const prospectById=new Map((prospectsResult.data||[]).map((p:any)=>[String(p.id),p]));

  const current:any[]=[];const history:any[]=[];const evidence:any[]=[];const other:any[]=[];
  for(const item of results){
    const type=typeOf(item);const id=String(item.entity_id);
    if(type.includes('document')||type.includes('evidence')){evidence.push(item);continue;}
    if(type==='prospect'){
      const p:any=prospectById.get(id);const ownership=resolveLifecycleOwnership({prospectId:id,prospectStatus:p?.status,convertedCaseId:p?.converted_lead_id});
      (ownership.owner==='prospect'?current:history).push(item);continue;
    }
    if(['lead','case'].includes(type)){
      const p:any=projectByLead.get(id);const ownership=resolveLifecycleOwnership({caseId:id,projectId:p?.id,projectStatus:p?.status,projectStage:p?.project_stage});
      (ownership.owner==='case'?current:history).push(item);continue;
    }
    if(type==='project'){
      const p:any=projectById.get(id);const ownership=resolveLifecycleOwnership({caseId:p?.lead_id,projectId:id,projectStatus:p?.status,projectStage:p?.project_stage});
      (ownership.owner==='project'?current:history).push(item);continue;
    }
    other.push(item);
  }

  return <section className="vp-page">
    <header className="vp-header"><div><p className="vp-kicker">Search</p><h1>Find anything in your workspace.</h1><p className="vp-subtitle">Search projects, clients, documents, invoices, partners, risks and saved knowledge from one place.</p></div><Link className="button secondary" href="/workspace/knowledge">Knowledge</Link></header>
    <form method="get" className="card" style={{width:'100%',display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:12}}><input autoFocus name="q" defaultValue={q} placeholder="Search project number, client, drawing, invoice, partner, risk, lesson…"/><button className="button">Search</button></form>
    {error?<div className="vp-callout"><strong>Search is temporarily unavailable</strong><p>Please try again. If the problem continues, check the workspace data connection.</p></div>:null}
    {q.length>0&&q.length<2?<div className="vp-callout"><strong>Enter at least two characters.</strong></div>:null}
    {q&&results.length>0?<>
      <section className="card" style={{width:'100%'}}><div className="vp-section-title"><div><p className="vp-label">Active work</p><h2>Current records</h2></div><span>{current.length}</span></div><ResultRows items={current} empty="No active records match this search."/></section>
      {evidence.length?<section className="card" style={{width:'100%'}}><div className="vp-section-title"><div><p className="vp-label">Documents</p><h2>Documents and evidence</h2></div><span>{evidence.length}</span></div><ResultRows items={evidence}/></section>:null}
      {other.length?<section className="card" style={{width:'100%'}}><div className="vp-section-title"><div><p className="vp-label">Related</p><h2>Other matching records</h2></div><span>{other.length}</span></div><ResultRows items={other}/></section>:null}
      {history.length?<details className="vp-disclosure"><summary>Previous records · {history.length}</summary><div style={{paddingTop:16}}><p style={{color:'var(--op-muted)'}}>These records are kept for history and audit. Active work has moved to a newer record.</p><ResultRows items={history}/></div></details>:null}
    </>:<section className="card" style={{width:'100%'}}><div className="vp-section-title"><div><p className="vp-label">Results</p><h2>{q?`0 matches for “${q}”`:'Search the workspace'}</h2></div></div>{q&&!error?<div className="vp-empty">No records match this search.</div>:null}</section>}
  </section>;
}
