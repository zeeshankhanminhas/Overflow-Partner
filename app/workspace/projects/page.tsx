import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { listClientQuotes } from '@/lib/repositories/workflow';
import { listLeads } from '@/lib/repositories/leads';
import { createProjectFormAction } from '../workflow-actions';
import { normaliseProjectStage, projectStageMeta } from '@/lib/projects/stages';
import { resolveFinancialGate } from '@/lib/finance/state';

const input='border border-white/10 rounded-lg bg-white px-3 py-2 text-black';
const PAGE_SIZE=25;
type View='all'|'attention'|'mobilisation'|'delivery'|'client_review'|'closeout'|'closed';
type QueueRow={id:string;project_number:string;title:string;project_status:string;project_stage:string;start_date:string|null;due_date:string|null;created_at:string;total_count:number|string};

const viewMeta:Record<View,{label:string;description:string}>={
  all:{label:'All active',description:'Every current project.'},
  attention:{label:'Needs attention',description:'Projects with a live blocker, overdue date or unresolved exception.'},
  mobilisation:{label:'Mobilisation',description:'Accepted work not yet authorised for execution.'},
  delivery:{label:'In delivery',description:'Projects in execution and technical review.'},
  client_review:{label:'Client review',description:'Projects waiting on client-facing review or issue.'},
  closeout:{label:'Closeout',description:'Completion-stage work waiting for closure.'},
  closed:{label:'Closed',description:'Completed historical project records.'},
};

function href(view:View,page=1,q=''){const p=new URLSearchParams();if(view!=='all')p.set('view',view);if(page>1)p.set('page',String(page));if(q)p.set('q',q);const s=p.toString();return `/workspace/projects${s?`?${s}`:''}`}
function formatDate(value:string|null){if(!value)return 'Not set';const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
function money(value:unknown,currency='GBP'){try{return new Intl.NumberFormat('en-GB',{style:'currency',currency,maximumFractionDigits:0}).format(Number(value||0))}catch{return `${currency} ${Number(value||0).toFixed(0)}`}}

export default async function Page({searchParams}:{searchParams?:Promise<Record<string,string|undefined>>}){
  const params=searchParams?await searchParams:{};if(params.project)redirect(`/workspace/projects/${params.project}`);
  const requested=String(params.view||'all');const view=(Object.keys(viewMeta).includes(requested)?requested:'all') as View;
  const q=String(params.q||'').trim();const requestedPage=Number.parseInt(String(params.page||'1'),10);const page=Number.isFinite(requestedPage)&&requestedPage>0?requestedPage:1;
  const {supabase,organisationId}=await requireUserContext();

  const [{data,error},quotes,leads]=await Promise.all([
    supabase.rpc('op_project_queue',{p_organisation_id:organisationId,p_view:view==='attention'?'all':view==='mobilisation'?'all':view==='client_review'?'delivery':view,p_limit:200,p_offset:0}),
    listClientQuotes(supabase,organisationId),listLeads(supabase,organisationId),
  ]);
  if(error)throw new Error(`Project queue could not be loaded: ${error.message}`);
  const baseRows=(data||[]) as QueueRow[];
  const ids=baseRows.map(r=>r.id);

  const [projectDetails,taskRows,deliveryRows,exceptionRows,quoteRows]=await Promise.all([
    ids.length?supabase.from('projects').select('id,project_manager_id,due_date,project_stage,quote_id, project_manager:profiles(full_name), lead:leads(company_name), quote:quotes(total,currency)').eq('organisation_id',organisationId).in('id',ids):Promise.resolve({data:[] as any[]}),
    ids.length?supabase.from('tasks').select('entity_id,status').eq('organisation_id',organisationId).eq('entity_type','project').in('entity_id',ids):Promise.resolve({data:[] as any[]}),
    ids.length?supabase.from('project_delivery_items').select('project_id,status,due_date').eq('organisation_id',organisationId).in('project_id',ids):Promise.resolve({data:[] as any[]}),
    Promise.resolve({data:[] as any[]}),
    Promise.resolve({data:[] as any[]}),
  ]);

  const detailMap=new Map((projectDetails.data||[]).map((p:any)=>[p.id,p]));
  const taskMap=new Map<string,{open:number;blocked:number}>();for(const t of taskRows.data||[]){const key=String((t as any).entity_id);const current=taskMap.get(key)||{open:0,blocked:0};if(!['completed','cancelled'].includes(String((t as any).status)))current.open++;if(String((t as any).status)==='blocked')current.blocked++;taskMap.set(key,current)}
  const deliveryMap=new Map<string,{open:number;blocked:number;overdue:number}>();const now=Date.now();for(const d of deliveryRows.data||[]){const key=String((d as any).project_id);const current=deliveryMap.get(key)||{open:0,blocked:0,overdue:0};if(!['complete','cancelled'].includes(String((d as any).status)))current.open++;if(String((d as any).status)==='blocked')current.blocked++;if((d as any).due_date&&!['complete','cancelled'].includes(String((d as any).status))&&new Date(String((d as any).due_date)).getTime()<now)current.overdue++;deliveryMap.set(key,current)}

  const enriched=await Promise.all(baseRows.map(async row=>{
    const detail:any=detailMap.get(row.id)||{};const stage=normaliseProjectStage(row.project_stage);const tasks=taskMap.get(row.id)||{open:0,blocked:0};const delivery=deliveryMap.get(row.id)||{open:0,blocked:0,overdue:0};
    let finance={authorised:true,displayState:'Not required',reason:''};if(stage==='mobilisation'){const result=await supabase.rpc('op_project_financial_gate',{p_project_id:row.id});finance=resolveFinancialGate(result.data)}
    const overdue=Boolean(row.due_date&&new Date(row.due_date).getTime()<now&&!['closed','completed','cancelled'].includes(String(row.project_status)));
    const attention=overdue||!finance.authorised||tasks.blocked>0||delivery.blocked>0||delivery.overdue>0;
    const nextAction=!finance.authorised?'Resolve finance':delivery.blocked||delivery.overdue?'Resolve delivery':tasks.blocked?'Resolve task blocker':stage==='mobilisation'?'Authorise execution':projectStageMeta[stage].action;
    return {...row,stage,detail,tasks,delivery,finance,overdue,attention,nextAction};
  }));

  let filtered=enriched;
  if(view==='attention')filtered=filtered.filter(p=>p.attention);
  if(view==='mobilisation')filtered=filtered.filter(p=>p.stage==='mobilisation'||p.stage==='ready_for_execution');
  if(view==='client_review')filtered=filtered.filter(p=>['ready_for_client_issue','issued_to_client','client_review'].includes(p.stage));
  if(q){const needle=q.toLowerCase();filtered=filtered.filter(p=>[p.project_number,p.title,p.detail?.lead?.company_name,p.detail?.project_manager?.full_name].some(v=>String(v||'').toLowerCase().includes(needle)))}
  const total=filtered.length;const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));const pageRows=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const attentionCount=enriched.filter(p=>p.attention).length;const mobilisationCount=enriched.filter(p=>p.stage==='mobilisation'||p.stage==='ready_for_execution').length;const deliveryCount=enriched.filter(p=>['in_progress','internal_review','partner_correction','ready_for_client_issue','issued_to_client','client_review'].includes(p.stage)).length;const closeoutCount=enriched.filter(p=>p.stage==='completion').length;

  return <section className="vp-page">
    <header className="vp-header"><div><p className="vp-kicker">Projects</p><h1>Project portfolio</h1><p className="vp-subtitle">Triage, prioritise and open only the projects that need action.</p></div><details><summary>Administrative exception</summary><div className="vp-toolbar-panel"><form action={createProjectFormAction} className="stack"><div className="grid gap-4 md:grid-cols-2"><select className={input} name="lead_id" required><option value="">Select case</option>{leads.map(l=><option key={l.id} value={l.id}>{l.title||l.company_name}</option>)}</select><select className={input} name="quote_id"><option value="">No linked quote</option>{quotes.map(qt=><option key={qt.id} value={qt.id}>{qt.quote_number} · {qt.status}</option>)}</select><input className={input} name="project_number" placeholder="OP-PRJ-0001" required/><input className={input} name="title" placeholder="Project title" required/></div><textarea className={input} name="notes" rows={3} placeholder="Reason" required/><button className="button">Create exceptional project</button></form></div></details></header>

    <div className="vp-compact-metrics"><div className="vp-metric"><span>Active portfolio</span><strong>{enriched.filter(p=>p.stage!=='closed').length}</strong></div><div className="vp-metric"><span>Needs attention</span><strong>{attentionCount}</strong></div><div className="vp-metric"><span>Mobilisation</span><strong>{mobilisationCount}</strong></div><div className="vp-metric"><span>In delivery</span><strong>{deliveryCount}</strong></div><div className="vp-metric"><span>Closeout</span><strong>{closeoutCount}</strong></div></div>

    <section className="vp-object" style={{display:'grid',gap:14}}><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{(Object.keys(viewMeta) as View[]).map(key=><Link key={key} className={`button ${view===key?'':'secondary'}`} href={href(key,1,q)}>{viewMeta[key].label}</Link>)}</div><form method="get" style={{display:'flex',gap:8,flexWrap:'wrap'}}>{view!=='all'?<input type="hidden" name="view" value={view}/>:null}<input name="q" defaultValue={q} placeholder="Search project, customer or owner" style={{minWidth:280,flex:'1 1 320px'}}/><button className="button secondary">Search</button>{q?<Link className="button secondary" href={href(view)}>Clear</Link>:null}</form><p style={{margin:0,color:'var(--op-muted)'}}>{viewMeta[view].description}</p></section>

    <section><div className="vp-section-title"><div><p className="vp-label">Operating register</p><h2>{total} project{total===1?'':'s'}</h2></div></div>{pageRows.length===0?<div className="vp-empty">No projects match this view.</div>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:980}}><thead><tr><th align="left">Project</th><th align="left">Stage</th><th align="left">Owner</th><th align="left">Due</th><th align="right">Value</th><th align="left">Delivery</th><th align="left">Finance</th><th align="left">Next action</th></tr></thead><tbody>{pageRows.map((p:any)=><tr key={p.id} style={{borderTop:'1px solid var(--op-line)'}}><td style={{padding:'14px 10px'}}><Link href={`/workspace/projects/${p.id}`}><strong>{p.project_number}</strong><br/><span>{p.title}</span><br/><small style={{color:'var(--op-muted)'}}>{p.detail?.lead?.company_name||'Customer not recorded'}</small></Link></td><td>{projectStageMeta[p.stage].label}{p.attention?<><br/><small style={{color:'var(--op-warning)'}}>Needs attention</small></>:null}</td><td>{p.detail?.project_manager?.full_name||'Unassigned'}</td><td>{formatDate(p.due_date)}{p.overdue?<><br/><small style={{color:'var(--op-danger)'}}>Overdue</small></>:null}</td><td align="right">{money(p.detail?.quote?.total,p.detail?.quote?.currency||'GBP')}</td><td>{p.delivery.open} open{p.delivery.blocked||p.delivery.overdue?<><br/><small>{p.delivery.blocked} blocked · {p.delivery.overdue} overdue</small></>:null}</td><td>{p.stage==='mobilisation'?p.finance.displayState:'—'}</td><td><Link href={p.nextAction==='Resolve finance'?`/workspace/commercial-control?project=${p.id}&focus=financial-gate`:`/workspace/projects/${p.id}`}><strong>{p.nextAction} →</strong></Link></td></tr>)}</tbody></table></div>}
      {totalPages>1?<nav className="vp-pagination" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginTop:20}}>{page>1?<Link className="button secondary" href={href(view,page-1,q)}>← Previous</Link>:<span/>}<span>Page {page} of {totalPages}</span>{page<totalPages?<Link className="button secondary" href={href(view,page+1,q)}>Next →</Link>:<span/>}</nav>:null}
    </section>
  </section>;
}
