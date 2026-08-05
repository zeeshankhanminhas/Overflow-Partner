import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listProjects, listClientQuotes } from '@/lib/repositories/workflow';
import { listLeads } from '@/lib/repositories/leads';
import { createProjectFormAction } from '../workflow-actions';
import { workspaceLabel } from '@/lib/presentation/vocabulary';

const input='border border-white/10 rounded-lg bg-white px-3 py-2 text-black';
export default async function Page({searchParams}:{searchParams?:Promise<Record<string,string|undefined>>}){
  const params=searchParams?await searchParams:{};
  const {supabase,organisationId}=await requireUserContext();
  const [projects,quotes,leads]=await Promise.all([listProjects(supabase,organisationId),listClientQuotes(supabase,organisationId),listLeads(supabase,organisationId)]);
  const active=projects.filter(p=>p.status==='active').length;
  const review=projects.filter(p=>p.status==='review').length;
  const complete=projects.filter(p=>p.status==='completed'||p.status==='closed').length;

  return <section className="vp-page">
    <header className="vp-header">
      <div><p className="vp-kicker">Projects</p><h1>Accepted work in delivery.</h1><p className="vp-subtitle">Projects are created from accepted client quotes. This page is a delivery register, not a second project-creation workflow.</p></div>
      <div className="vp-toolbar"><details><summary>Administrative exception</summary><div className="vp-toolbar-panel"><p style={{color:'rgb(255 255 255/.55)'}}>Use only for migrated or externally accepted work. The normal route is Case → Quote acceptance → Project.</p><form action={createProjectFormAction} className="stack"><div className="grid gap-4 md:grid-cols-2"><select className={input} name="lead_id" required><option value="">Select case</option>{leads.map(l=><option key={l.id} value={l.id}>{l.title||l.company_name}</option>)}</select><select className={input} name="quote_id"><option value="">No linked quote</option>{quotes.map(q=><option key={q.id} value={q.id}>{q.quote_number} · {q.status}</option>)}</select><input className={input} name="project_number" placeholder="OP-P-0001" required/><input className={input} name="title" placeholder="Project title" required/><input className={input} name="start_date" type="date"/><input className={input} name="due_date" type="date"/><select className={input} name="status" defaultValue="planning"><option value="planning">Planning</option><option value="active">Active</option><option value="waiting">Waiting</option><option value="review">Review</option><option value="completed">Completed</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option></select></div><textarea className={input} name="notes" rows={3} placeholder="Reason for administrative creation" required/><button className="button">Create exceptional project</button></form></div></details></div>
    </header>

    {params.created?<div className="vp-callout"><strong>Project created</strong><p>The delivery record is available below.</p></div>:null}
    {params.error?<div className="vp-callout"><strong>Action could not be completed</strong><p>{params.error}</p></div>:null}

    <section className="vp-object vp-object--hero"><p className="vp-label">Delivery position</p><div className="vp-compact-metrics"><div className="vp-metric"><span>Active</span><strong>{active}</strong></div><div className="vp-metric"><span>In review</span><strong>{review}</strong></div><div className="vp-metric"><span>Completed</span><strong>{complete}</strong></div></div></section>

    <section><div className="vp-section-title"><div><p className="vp-label">Primary object</p><h2>Delivery records</h2></div></div><div className="vp-list">{projects.length===0?<div className="vp-empty">No accepted work has entered delivery.</div>:projects.map(p=><Link href={`/workspace/projects?project=${p.id}`} className="vp-row" key={p.id}><div><h3>{p.project_number} · {p.title}</h3><p>{p.start_date||'Start not set'} → {p.due_date||'Due date not set'}</p></div><div className="vp-row-status">{workspaceLabel(p.status,'project')}</div><div><strong>Open project →</strong></div></Link>)}</div></section>
  </section>;
}
