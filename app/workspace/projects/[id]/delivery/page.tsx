import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { getProjectById } from '@/lib/repositories/workflow';
import { normaliseProjectStage, projectStageMeta } from '@/lib/projects/stages';
import { ObjectHeader } from '@/components/workspace/OperationalObjects';
import ProjectDeliveryControl from '../ProjectDeliveryControl';

export default async function ProjectDeliveryPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {supabase,organisationId}=await requireUserContext();
  let project;try{project=await getProjectById(supabase,organisationId,id)}catch{notFound()}
  const stage=normaliseProjectStage((project as any).project_stage);const lead=project.lead as Record<string,unknown>|null|undefined;const manager=project.project_manager as Record<string,unknown>|null|undefined;
  const company=String(lead?.company_name||'Client');
  return <section className="vp-page project-delivery-page">
    <ObjectHeader eyebrow="Project delivery" reference={project.project_number} title={project.title} subtitle={`${company} · Work objects, milestones, dependencies, reviews and issues`} status={projectStageMeta[stage].label} tone={stage==='closed'?'complete':stage==='partner_correction'?'attention':stage==='client_review'?'waiting':'active'} backHref={`/workspace/projects/${id}`} backLabel="Project overview" facts={[
      {label:'Project owner',value:String(manager?.full_name||'Unassigned')},
      {label:'Due',value:project.due_date?new Date(project.due_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Not set'},
      {label:'Client',value:company},
    ]} actions={<><Link className="button secondary" href={`/workspace/documents?project=${id}`}>Documents</Link><Link className="button secondary" href={`/workspace/payments?project=${id}`}>Commercials</Link></>} />
    <ProjectDeliveryControl projectId={id} closed={stage==='closed'}/>
  </section>;
}