import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listTasks } from '@/lib/repositories/workflow';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

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
    <ProductPageHeader eyebrow="Operations · Tasks" title="Task queue" description="Work items created from the record that owns the work. Operators should never need to type an entity type or UUID to create a normal task." />

    {params.created?<ProductNotice title="Task created" tone="complete"><p>The task is now visible in the operating queue.</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Task could not be created" tone="blocked"><p>{params.error}</p></ProductNotice>:null}

    <ProductMetrics label="Task workload">
      <ProductMetric label="Open" value={open} detail="Not yet started" tone={open?'waiting':'neutral'} />
      <ProductMetric label="In progress" value={inProgress} detail="Actively being worked" tone={inProgress?'active':'neutral'} />
      <ProductMetric label="Blocked" value={blocked} detail="Cannot progress" tone={blocked?'blocked':'complete'} />
      <ProductMetric label="Active workload" value={active.length} detail="Excludes completed and cancelled tasks" />
    </ProductMetrics>

    <section>
      <ProductSectionHeader eyebrow="Operating register" title="Active tasks" actions={<Link href="/workspace/exceptions">Open issues →</Link>} />
      {active.length===0?<ProductEmptyState title="No active tasks" description="Tasks created from Cases and Projects will appear here when they need operator action." />:<ProductRegister>
        {active.map((task:any)=><ProductRegisterRow key={task.id} href={hrefFor(task)}>
          <div><strong>{task.title}</strong><p>{String(task.entity_type||'record').replaceAll('_',' ')} · {String(task.priority||'normal').replaceAll('_',' ')} priority</p></div>
          <ProductStatus tone={tone(task.status)}>{String(task.status).replaceAll('_',' ')}</ProductStatus>
          <div><small>Due</small><strong style={{display:'block',marginTop:3}}>{due(task.due_at)}</strong></div>
          <strong>{hrefFor(task)?'Open record →':'Workspace task'}</strong>
        </ProductRegisterRow>)}
      </ProductRegister>}
    </section>
  </section>;
}
