import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import DeliveryItemCreateForm from './DeliveryItemCreateForm';
import DeliveryItemUpdateForm from './DeliveryItemUpdateForm';
import { ContextActions, WorkWindow } from '@/components/workspace/InteractionSurface';
import { ObjectInspectDrawer } from '@/components/workspace/OperationalObjects';
import { SignalStrip } from '@/components/workspace/OperationalUI';
import { ProductStatus } from '@/components/workspace/ProductUI';
import { commercialStatus } from '@/lib/presentation/commercialLanguage';

type DeliveryItem=Record<string,any>;
function date(value:unknown){if(!value)return 'No due date';const d=new Date(String(value));return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
function label(value:unknown){return String(value||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());}
function overdue(item:DeliveryItem){if(!item.due_date||['complete','cancelled'].includes(String(item.status)))return false;const due=new Date(`${String(item.due_date).slice(0,10)}T23:59:59`);return !Number.isNaN(due.getTime())&&due.getTime()<Date.now();}
function tone(item:DeliveryItem){if(item.status==='blocked'||overdue(item))return 'attention' as const;if(['internal_review','client_review'].includes(item.status)||['changes_required'].includes(item.internal_review_status)||['changes_required'].includes(item.client_review_status))return 'waiting' as const;if(item.status==='complete')return 'complete' as const;return 'active' as const;}
function nextAction(item:DeliveryItem){if(item.status==='blocked')return 'Resolve blocker';if(overdue(item))return 'Recover delivery date';if(item.internal_review_status==='changes_required'||item.client_review_status==='changes_required')return 'Update work';if(item.status==='internal_review')return 'Complete internal review';if(item.status==='client_review')return 'Await client review';if(item.status==='complete')return 'Complete';return 'Update progress';}

function WorkObject({projectId,item,members,partners,closed}:{projectId:string;item:DeliveryItem;members:Array<{id:string;label:string}>;partners:Array<{id:string;label:string}>;closed:boolean}){
  const detail=[item.description,item.dependency?`Depends on ${item.dependency.title}`:null].filter(Boolean).join(' · ');
  return <article className={`delivery-work-object ${item.status==='blocked'||overdue(item)?'delivery-work-object--attention':''}`}>
    <div className="delivery-work-object__identity">
      <div className="delivery-work-object__type">{label(item.item_type)}</div>
      <div><strong>{item.title}</strong>{detail?<p>{detail}</p>:null}<small>{item.owner?.full_name||item.partner?.company_name||'Unassigned'} · {item.due_date?`Due ${date(item.due_date)}`:'No due date'}{item.revision?` · Rev ${item.revision}`:''}</small></div>
    </div>
    <div className="delivery-work-object__state"><ProductStatus tone={tone(item)}>{overdue(item)?'Overdue':commercialStatus(item.status,label(item.status))}</ProductStatus><small>{nextAction(item)}</small></div>
    <div className="delivery-work-object__reviews"><span><small>Internal</small><strong>{label(item.internal_review_status||'not started')}</strong></span><span><small>Client</small><strong>{label(item.client_review_status||'not started')}</strong></span></div>
    <ContextActions label={`Work object actions for ${item.title}`}>
      <ObjectInspectDrawer triggerLabel="Inspect" eyebrow={label(item.item_type)} title={item.title} description={detail||'Delivery work object'} facts={[
        {label:'Status',value:overdue(item)?'Overdue':commercialStatus(item.status,label(item.status))},
        {label:'Owner',value:item.owner?.full_name||item.partner?.company_name||'Unassigned'},
        {label:'Due',value:date(item.due_date)},
        {label:'Internal review',value:label(item.internal_review_status||'not started')},
        {label:'Client review',value:label(item.client_review_status||'not started')},
        {label:'Next action',value:nextAction(item)},
      ]}>
        {item.dependency?<div className="product-notice"><strong>Dependency</strong><div>{item.dependency.title}</div></div>:null}
        {!closed?<section><p className="op-ui-eyebrow">Update work</p><DeliveryItemUpdateForm projectId={projectId} item={item} members={members} partners={partners}/></section>:null}
      </ObjectInspectDrawer>
    </ContextActions>
  </article>;
}

export default async function ProjectDeliveryControlV2({projectId,closed=false}:{projectId:string;closed?:boolean}){
  const {supabase,organisationId}=await requireUserContext();
  const [itemsResult,membersResult,partnersResult,documentsResult,issuesResult]=await Promise.all([
    supabase.from('project_delivery_items').select('*').eq('organisation_id',organisationId).eq('project_id',projectId).order('created_at',{ascending:true}),
    supabase.from('profiles').select('id,full_name,role').eq('organisation_id',organisationId).eq('is_active',true).order('full_name'),
    supabase.from('partners').select('id,company_name,status').eq('organisation_id',organisationId).order('company_name'),
    supabase.from('documents').select('id,reference,title,status').eq('organisation_id',organisationId).eq('project_id',projectId).order('created_at',{ascending:false}),
    supabase.from('partner_execution_exceptions').select('id,title,status,severity,description,raised_at,project_id').eq('organisation_id',organisationId).eq('project_id',projectId).in('status',['open','acknowledged']).order('raised_at',{ascending:false}),
  ]);
  if(itemsResult.error){console.error('Project delivery control query failed',{projectId,code:itemsResult.error.code,message:itemsResult.error.message});return <section id="delivery-control" className="vp-callout"><strong>Delivery could not be loaded</strong><p>Refresh the page and try again.</p></section>;}

  const rawItems=itemsResult.data??[];const members=membersResult.data??[];const partners=partnersResult.data??[];const documents=documentsResult.data??[];const issues=issuesResult.data??[];
  const memberById=new Map(members.map((member:any)=>[member.id,member]));const partnerById=new Map(partners.map((partner:any)=>[partner.id,partner]));const rawItemById=new Map(rawItems.map((item:any)=>[item.id,item]));
  const items=rawItems.map((item:any)=>({...item,owner:item.owner_id?memberById.get(item.owner_id)||null:null,partner:item.partner_id?partnerById.get(item.partner_id)||null:null,dependency:item.depends_on_id?rawItemById.get(item.depends_on_id)||null:null}));
  const open=items.filter((item:any)=>!['complete','cancelled'].includes(item.status));const overdueItems=open.filter(overdue);const blocked=open.filter((item:any)=>item.status==='blocked');const awaitingReview=open.filter((item:any)=>['internal_review','client_review'].includes(item.status)||item.internal_review_status==='changes_required'||item.client_review_status==='changes_required');
  const deliverables=items.filter((item:any)=>item.item_type==='deliverable');const milestones=items.filter((item:any)=>item.item_type==='milestone');const dependencies=items.filter((item:any)=>item.item_type==='dependency');
  const memberOptions=members.map((member:any)=>({id:member.id,label:member.full_name||member.role}));const partnerOptions=partners.map((partner:any)=>({id:partner.id,label:partner.company_name}));const dependencyOptions=items.filter((item:any)=>item.status!=='cancelled').map((item:any)=>({id:item.id,label:item.title}));const documentOptions=documents.map((document:any)=>({id:document.id,label:`${document.reference} · ${document.title}`}));
  const focus=[...blocked,...overdueItems.filter(item=>!blocked.some(blockedItem=>blockedItem.id===item.id)),...awaitingReview.filter(item=>!blocked.some(blockedItem=>blockedItem.id===item.id)&&!overdueItems.some(overdueItem=>overdueItem.id===item.id))][0]||open[0]||null;

  return <section id="delivery-control" className="delivery-operating-workspace">
    <SignalStrip items={[
      {label:'Open work',value:open.length,detail:`${deliverables.length} deliverables · ${milestones.length} milestones`,tone:open.length?'active':'complete'},
      {label:'Needs attention',value:blocked.length+overdueItems.length,detail:`${blocked.length} blocked · ${overdueItems.length} overdue`,tone:blocked.length||overdueItems.length?'attention':'complete'},
      {label:'Ready for review',value:awaitingReview.length,detail:'Internal or client review',tone:awaitingReview.length?'waiting':'complete'},
      {label:'Open issues',value:issues.length,detail:'Partner-reported delivery issues',tone:issues.length?'attention':'complete'},
    ]}/>

    <div className="delivery-operating-workspace__grid">
      <main className="delivery-operating-workspace__main">
        <section className="op-ui-panel">
          <header className="op-ui-panel__header"><div><p className="op-ui-eyebrow">Active work</p><h3>Deliverables</h3></div><span>{deliverables.length} outputs</span></header>
          <div className="delivery-work-list">{deliverables.length?deliverables.map(item=><WorkObject key={item.id} projectId={projectId} item={item} members={memberOptions} partners={partnerOptions} closed={closed}/>):<div className="op-ui-empty">No deliverables have been added yet.</div>}</div>
        </section>

        {(milestones.length||dependencies.length)?<div className="delivery-operating-workspace__supporting">
          <section className="op-ui-panel"><header className="op-ui-panel__header"><div><p className="op-ui-eyebrow">Checkpoints</p><h3>Milestones</h3></div><span>{milestones.length}</span></header><div className="delivery-work-list">{milestones.length?milestones.map(item=><WorkObject key={item.id} projectId={projectId} item={item} members={memberOptions} partners={partnerOptions} closed={closed}/>):<div className="op-ui-empty">No milestones.</div>}</div></section>
          <section className="op-ui-panel"><header className="op-ui-panel__header"><div><p className="op-ui-eyebrow">Constraints</p><h3>Dependencies</h3></div><span>{dependencies.length}</span></header><div className="delivery-work-list">{dependencies.length?dependencies.map(item=><WorkObject key={item.id} projectId={projectId} item={item} members={memberOptions} partners={partnerOptions} closed={closed}/>):<div className="op-ui-empty">No dependencies.</div>}</div></section>
        </div>:null}
      </main>

      <aside className="delivery-operating-workspace__rail">
        <section className="op-ui-next">
          <p className="op-ui-eyebrow">Delivery focus</p>
          <h2>{focus?nextAction(focus):'Delivery is clear'}</h2>
          <p>{focus?`${focus.title} is the next work object that needs attention.`:'No open work currently needs intervention.'}</p>
          {focus?<div className="op-ui-next__facts"><div><small>Work object</small><strong>{focus.title}</strong></div><div><small>Owner</small><strong>{focus.owner?.full_name||focus.partner?.company_name||'Unassigned'}</strong></div><div><small>Due</small><strong>{date(focus.due_date)}</strong></div></div>:null}
          {focus?<ObjectInspectDrawer triggerLabel={nextAction(focus)} triggerClassName="button" eyebrow={label(focus.item_type)} title={focus.title} description="Inspect and update this work without leaving delivery." facts={[{label:'Status',value:overdue(focus)?'Overdue':label(focus.status)},{label:'Owner',value:focus.owner?.full_name||focus.partner?.company_name||'Unassigned'},{label:'Due',value:date(focus.due_date)}]}>{!closed?<DeliveryItemUpdateForm projectId={projectId} item={focus} members={memberOptions} partners={partnerOptions}/>:null}</ObjectInspectDrawer>:null}
        </section>

        <section className="op-ui-panel"><header className="op-ui-panel__header"><div><p className="op-ui-eyebrow">Context</p><h3>Related work</h3></div></header><div className="op-ui-next__links"><Link href={`/workspace/documents?project=${projectId}`}>Documents <span>{documents.length} →</span></Link><Link href={`/workspace/communications/project/${projectId}`}>Messages <span>→</span></Link><Link href={`/workspace/exceptions`}>Issues <span>{issues.length} →</span></Link></div></section>

        {!closed?<WorkWindow triggerLabel="Add work object" triggerClassName="button secondary" eyebrow="Project delivery" title="Add deliverable, milestone or dependency" description="Add only work that needs ownership, timing, review or dependency control."><DeliveryItemCreateForm projectId={projectId} members={memberOptions} partners={partnerOptions} dependencies={dependencyOptions} documents={documentOptions}/></WorkWindow>:null}
      </aside>
    </div>
  </section>;
}
