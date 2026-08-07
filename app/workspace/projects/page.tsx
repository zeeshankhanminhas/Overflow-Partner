import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { listClientQuotes } from '@/lib/repositories/workflow';
import { listLeads } from '@/lib/repositories/leads';
import { createProjectFormAction } from '../workflow-actions';
import { workspaceLabel } from '@/lib/presentation/vocabulary';
import { normaliseProjectStage } from '@/lib/projects/stages';

const input='border border-white/10 rounded-lg bg-white px-3 py-2 text-black';
type View='all'|'delivery'|'closeout'|'closed';
type QueueRow={id:string;project_number:string;title:string;project_status:string;project_stage:string;start_date:string|null;due_date:string|null;created_at:string;total_count:number|string};
const PAGE_SIZE=25;

const viewMeta:Record<View,{kicker:string;title:string;subtitle:string}>={
  all:{kicker:'Projects',title:'Accepted work in delivery.',subtitle:'Projects are created from accepted client quotes. Open a project to continue controlled delivery.'},
  delivery:{kicker:'Deliver',title:'Projects in controlled delivery.',subtitle:'Mobilisation, execution, review and client issue all happen inside Project 360.'},
  closeout:{kicker:'Close · Closeout',title:'Projects requiring formal closeout.',subtitle:'Completion-stage projects waiting for final evidence, handover and closure.'},
  closed:{kicker:'Close · Closed',title:'Closed project records.',subtitle:'Completed delivery retained as the governed historical record.'},
};

function pageHref(view:View,page:number){const params=new URLSearchParams();if(view!=='all')params.set('view',view);if(page>1)params.set('page',String(page));const query=params.toString();return `/workspace/projects${query?`?${query}`:''}`}

export default async function Page({searchParams}:{searchParams?:Promise<Record<string,string|undefined>>}){
  const params=searchParams?await searchParams:{};
  if(params.project)redirect(`/workspace/projects/${params.project}`);
  const requested=String(params.view||'all');
  const view:View=['delivery','closeout','closed'].includes(requested)?requested as View:'all';
  const requestedPage=Number.parseInt(String(params.page||'1'),10);
  const page=Number.isFinite(requestedPage)&&requestedPage>0?requestedPage:1;
  const meta=viewMeta[view];

  const {supabase,organisationId}=await requireUserContext();
  const [{data,error},quotes,leads]=await Promise.all([
    supabase.rpc('op_project_queue',{p_organisation_id:organisationId,p_view:view,p_limit:PAGE_SIZE,p_offset:(page-1)*PAGE_SIZE}),
    listClientQuotes(supabase,organisationId),
    listLeads(supabase,organisationId),
  ]);
  if(error)throw new Error(`Project queue could not be loaded: ${error.message}`);
  const rows=(data||[]) as QueueRow[];
  const total=rows.length?Number(rows[0].total_count||0):0;
  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));

  return <section className="vp-page">
    <header className="vp-header">
      <div><p className="vp-kicker">{meta.kicker}</p><h1>{meta.title}</h1><p className="vp-subtitle">{meta.subtitle}</p></div>
      <div className="vp-toolbar"><details><summary>Administrative exception</summary><div className="vp-toolbar-panel"><p style={{color:'rgb(255 255 255/.55)'}}>Use only for migrated or externally accepted work. The normal route is Case → Quote acceptance → Project.</p><form action={createProjectFormAction} className="stack"><div className="grid gap-4 md:grid-cols-2"><select className={input} name="lead_id" required><option value="">Select case</option>{leads.map(l=><option key={l.id} value={l.id}>{l.title||l.company_name}</option>)}</select><select className={input} name="quote_id"><option value="">No linked quote</option>{quotes.map(q=><option key={q.id} value={q.id}>{q.quote_number} · {q.status}</option>)}</select><input className={input} name="project_number" placeholder="OP-P-0001" required/><input className={input} name="title" placeholder="Project title" required/><input className={input} name="start_date" type="date"/><input className={input} name="due_date" type="date"/><select className={input} name="status" defaultValue="planning"><option value="planning">Planning</option><option value="active">Active</option><option value="waiting">Waiting</option><option value="review">Review</option><option value="completed">Completed</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option></select></div><textarea className={input} name="notes" rows={3} placeholder="Reason for administrative creation" required/><button className="button">Create exceptional project</button></form></div></details></div>
    </header>

    {params.error?<div className="vp-callout"><strong>Action could not be completed</strong><p>{params.error}</p></div>:null}

    <section className="vp-object vp-object--hero"><p className="vp-label">Queue position</p><div className="vp-compact-metrics"><div className="vp-metric"><span>Queue records</span><strong>{total}</strong></div><div className="vp-metric"><span>Page</span><strong>{Math.min(page,totalPages)} / {totalPages}</strong></div><div className="vp-metric"><span>Rows per page</span><strong>{PAGE_SIZE}</strong></div></div></section>

    <section><div className="vp-section-title"><div><p className="vp-label">Paginated operating queue</p><h2>{view==='all'?'Delivery records':meta.kicker}</h2></div>{view!=='all'?<Link href="/workspace/projects">View all projects</Link>:null}</div><div className="vp-list">{rows.length===0?<div className="vp-empty">No projects currently match this lifecycle view.</div>:rows.map(project=><Link href={`/workspace/projects/${project.id}`} className="vp-row" key={project.id}><div><h3>{project.project_number} · {project.title}</h3><p>{project.start_date||'Start not set'} → {project.due_date||'Due date not set'}</p></div><div className="vp-row-status">{workspaceLabel(normaliseProjectStage(project.project_stage),'project')}</div><div><strong>Open Project 360 →</strong></div></Link>)}</div>
      {totalPages>1?<nav className="vp-pagination" aria-label="Project queue pages" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginTop:20}}><div>{page>1?<Link className="button secondary" href={pageHref(view,page-1)}>← Previous</Link>:<span/>}</div><span>Page {Math.min(page,totalPages)} of {totalPages}</span><div>{page<totalPages?<Link className="button secondary" href={pageHref(view,page+1)}>Next →</Link>:<span/>}</div></nav>:null}
    </section>
  </section>;
}
