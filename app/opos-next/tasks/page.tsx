import {requireUserContext} from '@/lib/auth/context';
import {OperatorPageIntro,OperatorRegister,type OperatorRow} from '../OperatorViews';
export default async function TasksPage(){
 const {supabase,organisationId}=await requireUserContext();
 const {data,error}=await supabase.from('tasks').select('id,title,status,priority,due_at,entity_type,entity_id')
   .eq('organisation_id',organisationId).order('created_at',{ascending:false}).limit(150);
 if(error)throw new Error('Task register could not be loaded.');
 const rows:OperatorRow[]=(data||[]).map(t=>({id:t.id,title:t.title,subtitle:[t.entity_type,t.priority].filter(Boolean).join(' · '),
   state:String(t.status||'Not started').replaceAll('_',' '),
   next:t.due_at?'Due '+new Date(t.due_at).toLocaleDateString('en-GB'):'Review task evidence',href:'/opos-next/tasks/'+t.id}));
 return <section><OperatorPageIntro eyebrow="OPERATIONS / ACTIVITY" title="Tasks" subtitle="Assigned work and operational exceptions backed by the current task ledger." count={rows.length}/>
   <OperatorRegister rows={rows} heading="Task register" empty="No tasks are recorded."/>
 </section>;
}
