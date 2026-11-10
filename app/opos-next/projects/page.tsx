import {requireUserContext} from '@/lib/auth/context';
import {OperatorPageIntro,OperatorRegister,type OperatorRow} from '../OperatorViews';
type ProjectRow={id:string;project_number:string;title:string;project_status:string;project_stage:string;due_date:string|null};
export default async function ProjectsPage(){
  const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.rpc('op_project_queue',{p_organisation_id:organisationId,p_view:'all',p_limit:75,p_offset:0});
  if(error)throw new Error('Project register could not be loaded.');
  const projects=(data||[]) as ProjectRow[];
  const rows:OperatorRow[]=projects.map(item=>({id:item.id,title:item.title||item.project_number,
    subtitle:item.project_number||'Project',state:String(item.project_stage||item.project_status||'Active').replaceAll('_',' '),
    next:item.due_date?'Due '+new Date(item.due_date).toLocaleDateString('en-GB'):'Open Project 360',
    href:'/opos-next/projects/'+item.id}));
  return <section>
    <OperatorPageIntro eyebrow="WORK / PROJECTS" title="Projects" subtitle="Execution, quality assurance and delivery work after verified commercial commitment." count={rows.length}/>
    <OperatorRegister rows={rows} heading="Project register" empty="There are no Projects in this view."/>
  </section>;
}
