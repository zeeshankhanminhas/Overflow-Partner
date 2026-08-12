import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listTasks } from '@/lib/repositories/workflow';
import { actOnTaskAction } from './actions';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

function tone(status:string):ProductTone{if(status==='completed')return 'complete';if(status==='blocked')return 'blocked';if(status==='in_progress')return 'active';if(status==='open')return 'waiting';return 'neutral'}
function stateLabel(status:string){if(status==='open')return 'Ready to start';if(status==='in_progress')return 'In progress';if(status==='blocked')return 'Blocked';if(status==='completed')return 'Completed';return status.replaceAll('_',' ')}
function hrefFor(task:any){if(task.entity_type==='project')return `/workspace/projects/${task.entity_id}`;if(task.entity_type==='lead')return `/workspace/leads/${task.entity_id}`;return undefined}
function due(value:unknown){if(!value)return 'No due date';const date=new Date(String(value));return Number.isNaN(date.getTime())?String(value):date.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function TaskAction({taskId,action,label,primary=false}:{taskId:string;action:'start'|'complete'|'block';label:string;primary?:boolean}){return <form action={actOnTaskAction}><input type="hidden" name="task_id" value={taskId}/><input type="hidden" name="task_action" value={action}/><button className={`button${primary?'':' secondary'}`} type="submit">{label}</button></form>}

export default async function Page({searchParams}:{searchParams?:Promise<Record<string,string|undefined>>}){
  const params=searchParams?await searchParams:{};
  const {supabase,organisationId}=await requireUserContext();
  const tasks=await listTasks(supabase,organisationId);
  const open=tasks.filter(t=>t.status==='open').length;const inProgress=tasks.filter(t=>t.status==='in_progress').length;const blocked=tasks.filter(t=>t.status==='blocked').length;const active=tasks.filter(t=>!['completed','cancelled'].includes(t.status));

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Operations · Tasks" title="Task queue" description="Work items are created from the record that owns the work. The queue presents the next business action instead of exposing task-state editing." />
    {params.created?<ProductNotice title="Task created" tone="complete"><p>The task is now visible in the operating queue.</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Task could not be created" tone="blocked"><p>{params.error}</p></ProductNotice>:null}
    <ProductMetrics label="Task workload"><ProductMetric label="Ready to start" value={open} detail="Not yet started" tone={open?'waiting':'neutral'} /><ProductMetric label="In progress" value={inProgress} detail="Actively being worked" tone={inProgress?'active':'neutral'} /><ProductMetric label="Blocked" value={blocked} detail="Cannot progress" tone={blocked?'blocked':'complete'} /><ProductMetric label="Active workload" value={active.length} detail="Excludes completed and cancelled tasks" /></ProductMetrics>
    <section>
      <ProductSectionHeader eyebrow="Operating register" title="Active tasks" actions={<Link href="/workspace/exceptions">Open issues →</Link>} />
      {active.length===0?<ProductEmptyState title="No active tasks" description="Tasks created from Cases and Projects will appear here when they need operator action." />:<ProductRegister>{active.map((task:any)=>{const href=hrefFor(task);return <ProductRegisterRow key={task.id}><div><strong>{task.title}</strong><p>{String(task.priority||'normal').replaceAll('_',' ')} priority{href?' · Source record available':''}</p></div><ProductStatus tone={tone(task.status)}>{stateLabel(task.status)}</ProductStatus><div><small>Due</small><strong style={{display:'block',marginTop:3}}>{due(task.due_at)}</strong></div><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>{task.status==='open'?<><TaskAction taskId={task.id} action="start" label="Start" primary/><TaskAction taskId={task.id} action="block" label="Block"/></>:null}{task.status==='in_progress'?<><TaskAction taskId={task.id} action="complete" label="Complete" primary/><TaskAction taskId={task.id} action="block" label="Block"/></>:null}{task.status==='blocked'?<><TaskAction taskId={task.id} action="start" label="Resume" primary/><TaskAction taskId={task.id} action="complete" label="Complete"/></>:null}{href?<Link className="button secondary" href={href}>Open record</Link>:null}</div></ProductRegisterRow>})}</ProductRegister>}
    </section>
  </section>;
}
