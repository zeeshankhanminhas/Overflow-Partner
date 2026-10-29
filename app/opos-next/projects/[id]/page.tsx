import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {OperatorRecord} from '../../OperatorViews';
export default async function ProjectPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('projects').select('id,project_number,title,status,project_stage,due_date,created_at')
    .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(error)throw new Error('Project state could not be loaded.'); if(!data)notFound();
  const stage=String(data.project_stage||'mobilisation').replaceAll('_',' ');
  return <OperatorRecord eyebrow="WORK / PROJECT 360" title={data.title||data.project_number}
    position={'Project · '+stage} description="Authorised delivery is governed by project readiness, execution commitments, quality checks and payment evidence. Review the live record for the precise permitted action."
    fields={[{label:'Project number',value:data.project_number||id.slice(0,8)},{label:'Current stage',value:stage},
      {label:'Status',value:String(data.status||'Not recorded').replaceAll('_',' ')},
      {label:'Due',value:data.due_date?new Date(data.due_date).toLocaleDateString('en-GB'):'Not set'}]}
    previous="/opos-next/projects" governedHref={'/workspace/projects/'+id}/>;
}
