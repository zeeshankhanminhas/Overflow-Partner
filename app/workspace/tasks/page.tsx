import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listTasks } from '@/lib/repositories/workflow';
import { createTaskFormAction } from '../workflow-actions';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

const input='border border-black/15 bg-white px-3 py-2 text-black';
function tone(status:string):ProductTone{if(status==='completed')return 'complete';if(status==='blocked')return 'blocked';if(status==='in_progress')return 'active';if(status==='open')return 'waiting';return 'neutral'}
function hrefFor(task:any){if(task.entity_type==='project')return `/workspace/projects/${task.entity_id}`;if(task.entity_type==='lead')return `/workspace/leads/${task.entity_id}`;return undefined}
function due(value:unknown){if(!value)return 'No due date';const date=new Date(String(value));return Number.isNaN(date.getTime())?String(value):date.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}

export default async function Page({searchParams}:{searchParams?:Promise<Record<string,string|undefined>>}){
  const params=searchParams?await searchParams:{};
  const {supabase,organisationId}=await requireUserContext();
  const tasks=await listTasks(supabase,organisationId);
  const open=tasks.filter(t=>t.status==='open').length;
  const inProgress=tasks.filter(t=>t.status==='in_progress').length;
  const blocked=tasks.filter(t=>t.status==='blocked').length;
  const active=tasks.filter(t=>!['completed','cancelled'].includes(t.status));

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Operations · Tasks" title="Task queue" description="A compact operating queue for work that needs a named action outside the main lifecycle transition. Record-specific delivery work remains in its Project." actions={<details><summary className="button secondary">Exceptional task</summary><div className="vp-toolbar-panel"><form action={createTaskFormAction} className="stack"><p style={{margin:0,color:'var(--saas-muted)',fontSize:11}}>Use this only when a task cannot be created from its source record.</p><div className="grid gap-4 md:grid-cols-2"><input className={input} name="entity_type" placeholder="Record type, e.g. project" required/><input className={input} name="entity_id" placeholder="Record ID" required/><input className={input} name="title" placeholder="What needs to be done?" required/><input className={input} name="due_at" type="datetime-local"/><select className={input} name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select><select className={input} name="status" defaultValue="open"><option value="open">Open</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed">Complete</option><option value="cancelled">Cancelled</option></select></div><textarea className={input} name="description" rows={3} placeholder="Context or instructions"/><button className="button">Create exceptional task</button></form></div></details>} />

    {params.created?<ProductNotice title="Task created" tone="complete"><p>The task is now visible in the operating queue.</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Task could not be created" tone="blocked"><p>{params.error}</p></ProductNotice>:null}

    <ProductMetrics label="Task workload">
      <ProductMetric label="Open" value={open} detail="Not yet started" tone={open?'waiting':'neutral'} />
      <ProductMetric label="In progress" value={inProgress} detail="Actively being worked" tone={inProgress?'active':'neutral'} />
      <ProductMetric label="Blocked" value={blocked} detail="Cannot progress" tone={blocked?'blocked':'complete'} />
      <ProductMetric label="Active workload" value={active.length} detail="Excludes completed and cancelled tasks" />
    </ProductMetrics>

    <section>
      <ProductSectionHeader eyebrow="Operating register" title="Active tasks" actions={<Link href="/workspace/exceptions">Open exceptions →</Link>} />
      {active.length===0?<ProductEmptyState title="No active tasks" description="Tasks created from records will appear here when they need operator action." />:<ProductRegister>
        {active.map((task:any)=><ProductRegisterRow key={task.id} href={hrefFor(task)}>
          <div><strong>{task.title}</strong><p>{String(task.entity_type||'record').replaceAll('_',' ')} · {String(task.priority||'normal').replaceAll('_',' ')} priority</p></div>
          <ProductStatus tone={tone(task.status)}>{String(task.status).replaceAll('_',' ')}</ProductStatus>
          <div><small>Due</small><strong style={{display:'block',marginTop:3}}>{due(task.due_at)}</strong></div>
          <strong>{hrefFor(task)?'Open record →':'Unlinked'}</strong>
        </ProductRegisterRow>)}
      </ProductRegister>}
    </section>
  </section>;
}
