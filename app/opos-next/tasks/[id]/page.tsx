import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {OperatorRecord} from '../../OperatorViews';
export default async function TaskPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const {supabase,organisationId}=await requireUserContext();
 const {data,error}=await supabase.from('tasks')
   .select('id,title,description,status,priority,due_at,entity_type,entity_id,project_stage,notes')
   .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
 if(error)throw new Error('Task record could not be loaded.');if(!data)notFound();
 const linked=data.entity_type==='project'?'/opos-next/projects/'+data.entity_id:
   data.entity_type==='lead'?'/opos-next/cases/'+data.entity_id:
   data.entity_type==='prospect'?'/opos-next/opportunities/'+data.entity_id:undefined;
 return <OperatorRecord eyebrow="OPERATIONS / CONTROLLED ACTIVITY" title={data.title}
   position={String(data.status||'Not started').replaceAll('_',' ')}
   description={data.description||'Review the related operating record and controlled evidence before updating the activity.'}
   fields={[{label:'Priority',value:data.priority||'Normal'},{label:'Due',value:data.due_at?new Date(data.due_at).toLocaleDateString('en-GB'):'Not set'},
     {label:'Related record',value:data.entity_type||'Not linked'},{label:'Project stage',value:data.project_stage||'Not recorded'},
     {label:'Notes',value:data.notes||'None'}]}
   previous="/opos-next/tasks" governedHref={linked} governedLabel="Open related Workspace 2.0 record" />;
}
