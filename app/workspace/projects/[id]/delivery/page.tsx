import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { getProjectById } from '@/lib/repositories/workflow';
import { normaliseProjectStage, projectStageMeta } from '@/lib/projects/stages';
import ProjectDeliveryControl from '../ProjectDeliveryControl';

export default async function ProjectDeliveryPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {supabase,organisationId}=await requireUserContext();
  let project;try{project=await getProjectById(supabase,organisationId,id)}catch{notFound()}
  const stage=normaliseProjectStage((project as any).project_stage);const lead=project.lead as Record<string,unknown>|null|undefined;
  const company=String(lead?.company_name||'Customer');
  return <section className="saas-page">
    <header className="saas-hero"><div className="saas-hero__inner"><div className="saas-hero__copy"><Link href={`/workspace/projects/${id}`} className="project-os-back">← Project 360</Link><p className="vp-kicker">Delivery · {project.project_number}</p><h1>{project.title}</h1><p className="vp-subtitle">{company} · {projectStageMeta[stage].label}. Manage outputs, milestones, dependencies, ownership and review status from one place.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="button secondary" href={`/workspace/projects/${id}`}>Project overview</Link><Link className="button secondary" href={`/workspace/payments?project=${id}`}>Payments</Link></div></div></header>
    <ProjectDeliveryControl projectId={id} closed={stage==='closed'}/>
  </section>;
}
