import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import DeliveryItemCreateForm from './DeliveryItemCreateForm';
import DeliveryItemUpdateForm from './DeliveryItemUpdateForm';

function date(value:unknown){if(!value)return 'No due date';const d=new Date(String(value));return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
function label(value:unknown){return String(value||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());}
function overdue(item:any){if(!item.due_date||['complete','cancelled'].includes(String(item.status)))return false;const due=new Date(`${String(item.due_date).slice(0,10)}T23:59:59`);return !Number.isNaN(due.getTime())&&due.getTime()<Date.now();}

export default async function ProjectDeliveryControlV2({projectId,closed=false}:{projectId:string;closed?:boolean}){
  const {supabase,organisationId}=await requireUserContext();
  const [itemsResult,membersResult,partnersResult,documentsResult]=await Promise.all([
    supabase.from('project_delivery_items').select('*').eq('organisation_id',organisationId).eq('project_id',projectId).order('created_at',{ascending:true}),
    supabase.from('profiles').select('id,full_name,role').eq('organisation_id',organisationId).eq('is_active',true).order('full_name'),
    supabase.from('partners').select('id,company_name,status').eq('organisation_id',organisationId).order('company_name'),
    closed?Promise.resolve({data:[] as any[]}):supabase.from('documents').select('id,reference,title,status').eq('organisation_id',organisationId).eq('project_id',projectId).order('created_at',{ascending:false}),
  ]);
  if(itemsResult.error){console.error('Project delivery control query failed',{projectId,code:itemsResult.error.code,message:itemsResult.error.message});return <section id="delivery-control" className="vp-callout"><strong>Delivery control could not be loaded</strong><p>Refresh the page and try again.</p></section>;}

  const rawItems=itemsResult.data??[];const members=membersResult.data??[];const partners=partnersResult.data??[];const documents=documentsResult.data??[];
  const memberById=new Map(members.map((member:any)=>[member.id,member]));const partnerById=new Map(partners.map((partner:any)=>[partner.id,partner]));const rawItemById=new Map(rawItems.map((item:any)=>[item.id,item]));
  const items=rawItems.map((item:any)=>({...item,owner:item.owner_id?memberById.get(item.owner_id)||null:null,partner:item.partner_id?partnerById.get(item.partner_id)||null:null,dependency:item.depends_on_id?rawItemById.get(item.depends_on_id)||null:null}));
  const open=items.filter((item:any)=>!['complete','cancelled'].includes(item.status));const overdueItems=open.filter(overdue);const blocked=open.filter((item:any)=>item.status==='blocked');const awaitingReview=open.filter((item:any)=>['internal_review','client_review'].includes(item.status)||item.internal_review_status==='changes_required'||item.client_review_status==='changes_required');
  const memberOptions=members.map((member:any)=>({id:member.id,label:member.full_name||member.role}));const partnerOptions=partners.map((partner:any)=>({id:partner.id,label:partner.company_name}));const dependencyOptions=items.filter((item:any)=>item.status!=='cancelled').map((item:any)=>({id:item.id,label:item.title}));const documentOptions=documents.map((document:any)=>({id:document.id,label:`${document.reference} · ${document.title}`}));

  return <section id="delivery-control" className="stack" style={{gap:16}}>
    <div className="vp-compact-metrics"><div className="vp-metric"><span>Open items</span><strong>{open.length}</strong></div><div className="vp-metric"><span>Overdue</span><strong>{overdueItems.length}</strong></div><div className="vp-metric"><span>Blocked</span><strong>{blocked.length}</strong></div><div className="vp-metric"><span>Needs review</span><strong>{awaitingReview.length}</strong></div></div>
    {(overdueItems.length||blocked.length||awaitingReview.length)?<div className="vp-callout"><strong>Delivery needs attention</strong><p>{overdueItems.length} overdue · {blocked.length} blocked · {awaitingReview.length} awaiting or returned from review.</p></div>:items.length?<div className="vp-callout"><strong>Delivery is on track</strong><p>No overdue, blocked or review-return items currently need attention.</p></div>:null}
    <div className="grid gap-4 lg:grid-cols-3"><div><p className="vp-label">Deliverables</p><h3>{items.filter((item:any)=>item.item_type==='deliverable').length} outputs</h3></div><div><p className="vp-label">Milestones</p><h3>{items.filter((item:any)=>item.item_type==='milestone').length} checkpoints</h3></div><div><p className="vp-label">Dependencies</p><h3>{items.filter((item:any)=>item.item_type==='dependency').length} constraints</h3></div></div>
    {items.length?<div className="vp-list">{items.map((item:any)=><article id={`delivery-item-${item.id}`} className="vp-row" key={item.id}><div style={{minWidth:0}}><strong>{item.title}</strong><p>{label(item.item_type)} · {item.owner?.full_name||'Unassigned'}{item.partner?.company_name?` · ${item.partner.company_name}`:''}</p><small>{item.due_date?`Due ${date(item.due_date)}`:'No due date'}{item.revision?` · Rev ${item.revision}`:''}{item.dependency?` · Depends on ${item.dependency.title}`:''}</small></div><div className="vp-row-status">{overdue(item)?'Overdue':label(item.status)}</div><div><small>Internal</small><strong style={{display:'block'}}>{label(item.internal_review_status)}</strong><small>Client</small><strong style={{display:'block'}}>{label(item.client_review_status)}</strong></div>{closed?<span/>:<details className="vp-disclosure"><summary>Update</summary><DeliveryItemUpdateForm projectId={projectId} item={item} members={memberOptions} partners={partnerOptions}/></details>}</article>)}</div>:<div className="vp-empty"><strong>No delivery plan yet</strong><p>Add the outputs, checkpoints and dependencies that define this Project's delivery.</p></div>}
    {!closed?<details className="vp-disclosure"><summary>+ Add deliverable, milestone or dependency</summary><DeliveryItemCreateForm projectId={projectId} members={memberOptions} partners={partnerOptions} dependencies={dependencyOptions} documents={documentOptions}/></details>:null}
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><Link className="button secondary" href={`/workspace/documents?project=${projectId}`}>Project documents</Link><Link className="button secondary" href={`/workspace/communications/project/${projectId}`}>Project communications</Link></div>
  </section>;
}
