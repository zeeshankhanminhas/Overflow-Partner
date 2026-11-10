import ProjectLifecycleEvidence from '@/components/workspace/ProjectLifecycleEvidence';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {formatAmount,isPortalKind,portalContext,stageLabel} from '@/lib/portals/account';

import {portalProjectNextStep} from '@/lib/presentation/threePortalNextAction';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {clientSettlementPosition} from '@/lib/portals/clientSettlementPosition';
import css from '../portal.module.css';

export const dynamic='force-dynamic';

export default async function AccountWorkspace({params}:{params:Promise<{kind:string}>}){
 const {kind}=await params;
 if(!isPortalKind(kind))notFound();
 const {accounts,permitted,projects,quotes,supabase}=await portalContext(kind);
 const mine=accounts.filter(a=>a.portal_kind===kind);
 const isClient=kind==='client';
 // This review RPC is QA-only. Never query it from production or a preview
 // whose Supabase project isolation cannot be verified.
 const reviewCandidates=permitted&&isClient&&isKnownIsolatedQaBackend()
  ?projects.filter(p=>p.project_stage==='client_review').slice(0,8):[];
 const reviewChecks=permitted?await Promise.all(reviewCandidates.map(async p=>{
  const {data,error}=await supabase.rpc('op_qa_client_review_position',{p_project_id:p.project_id});
  const review=data as {projectId?:string;canRespond?:boolean;revision?:string}|null;
  return !error&&review?.projectId===p.project_id&&review.canRespond?{project:p,review}:null;
 })):[];

 const liveClientReview=reviewChecks.find((r):r is {project:typeof projects[number];review:{projectId?:string;canRespond?:boolean;revision?:string}}=>Boolean(r))||null;
 const outstandingQuote=isClient?quotes.find(q=>!q.project_id&&['','awaiting_response','pending'].includes(String(q.client_response||'').trim())):null;

 // Fetch the same scoped current-cycle financial truth as the Client Project.
 // Membership is established by portalContext before any privileged read.
 const completionProjects=permitted&&isClient
  ?projects.filter(p=>p.project_stage==='completion'||p.project_stage==='closed'):[];
 const positions=await Promise.all(completionProjects.map(async p=>({
  id:p.project_id,
  position:await clientSettlementPosition(p.organisation_id,p.project_id,p.project_stage),
 })));
 const positionByProject=new Map(positions.map(entry=>[entry.id,entry.position]));
 const nextFor=(p:typeof projects[number])=>{
  const base=portalProjectNextStep(kind,p);
  const settlement=isClient?positionByProject.get(p.project_id):undefined;
  if(!settlement||p.project_stage==='closed')return base;
  if(settlement.finalSettlementUnavailable)
   return {title:'Final balance verification unavailable',description:'We cannot verify your settlement status. Please do not repeat a payment; Overflow Partner will investigate.',action:null,waiting:true};
  if(settlement.finalFilesReady)
   return {title:'Final engineering files are available',description:'Your verified final handover can be opened securely in this project.',action:'Open project handover',waiting:false};
  if(settlement.finalPaid)
   return {title:'Final balance received · handover pending',description:'Your payment is recorded. Final file release still requires independent owner approval.',action:null,waiting:true};
  if(settlement.finalBalanceReady)
   return {title:'Final balance requires attention',description:'Review the verified final settlement information inside this project before paying.',action:'Review final balance',waiting:false};
  return {title:'Final review verification pending',description:'Overflow Partner must verify the current accepted review before requesting final payment.',action:null,waiting:true};
 };
 // Role-scoped RPCs remain the only source of dashboard project membership.
 // Project ordering and links never grant transaction permission.
 const orderedProjects=[...projects].sort((a,b)=>{
  const aNeeds=nextFor(a).waiting?0:1;
  const bNeeds=nextFor(b).waiting?0:1;
  if(aNeeds!==bNeeds)return bNeeds-aNeeds;
  const aOpen=a.project_stage==='closed'?0:1;
  const bOpen=b.project_stage==='closed'?0:1;
  return bOpen-aOpen;
 });
 const chosenProject=orderedProjects[0]||null;
 // Secure review and quotation decisions precede project-only lifecycle steps.
 // Project tasks themselves are resolved by the authenticated 28-gate engine.
 const primary=liveClientReview?{label:'Review your drawings',detail:'Your current controlled drawing package is available in your verified client workspace.',href:'/portal/client/projects/'+liveClientReview.project.project_id+'#drawing-review',action:'Open drawing review',waiting:false}:outstandingQuote?{label:'Review your quotation',detail:'Check the issued price and scope before recording your decision.',href:'/portal/client/quotes/'+outstandingQuote.quote_id,action:'Open quotation',waiting:false}:null;
 const attentionCount=orderedProjects.filter(p=>!nextFor(p).waiting&&p.project_stage!=='closed').length
  +(isClient?quotes.filter(q=>!q.project_id&&['','awaiting_response','pending'].includes(String(q.client_response||'').trim())).length:0);
 const activeCount=projects.filter(p=>p.project_stage!=='closed').length;
 const dashboardStats=isClient?[
  {label:'Active projects',value:activeCount},
  {label:'Open quotations',value:quotes.filter(q=>!q.project_id).length},
  {label:'Items needing attention',value:attentionCount},
 ]:[
  {label:'Active assignments',value:activeCount},
  {label:'Work Orders awaiting acceptance',value:projects.filter(p=>p.project_stage==='mobilisation'&&p.work_order_accepted===false).length},
  {label:'Items needing attention',value:attentionCount},
 ];
 const previewProjects=orderedProjects.slice(0,3);
 const title=isClient?'Your engineering projects':'Your engineering work';
 return <>
  <div className={css.hero+' '+css.dashboardHero}>
   <p className={css.eyebrow}>{isClient?'CLIENT':'EXECUTION PARTNER'} WORKSPACE</p>
   <h1 className={css.title}>{title}</h1>
   <p className={css.subtitle}>{mine.length===1?mine[0].account_name+' · ':''}Progress, decisions and documents in one place.</p>
  </div>
  {permitted?<section className={css.metrics} aria-label="Workspace overview">
   {dashboardStats.map(stat=><div key={stat.label} className={css.metric}>
    <span className={css.metricLabel}>{stat.label}</span>
    <strong className={css.metricValue}>{stat.value}</strong>
   </div>)}
  </section>:null}
  {!permitted?<div className={css.empty}>This sign-in does not have access to a {isClient?'Client':'Partner'} Workspace. An Overflow Partner administrator must grant access to your verified account. <Link href="/portal" className={css.crumb}>View available workspaces</Link></div>:<>
   {primary?<section className={css.nextAction} aria-label="Your one next action">
    <span className={css.eyebrow}>YOUR VERIFIED NEXT STEP</span>
    <h2>{primary.label}</h2>
    <p>{primary.detail}</p>
    <Link className={css.action} href={primary.href}>{primary.action} →</Link>
   </section>:chosenProject?<ProjectLifecycleEvidence actor={kind} projectId={chosenProject.project_id}/>:
   <section className={css.nextAction} aria-label="Your one next action">
    <span className={css.eyebrow}>ALL UP TO DATE</span>
    <h2>No assigned project needs reviewing</h2>
    <p>Verified account work appears here when it is assigned.</p>
   </section>}

   <section className={css.section+' '+css.dashboardSection} aria-label="Your project register" id="projects">
    <div className={css.sectionHead}><div><p className={css.eyebrow}>YOUR WORK</p><h2>Projects</h2></div></div>
    {previewProjects.length?<div className={css.dashboardList}>
      {previewProjects.map(p=>{
       const next=nextFor(p);
       return <Link key={p.account_id+'-'+p.project_id} className={css.dashboardProject}
        href={'/portal/'+kind+'/projects/'+p.project_id}>
        <div><span className={css.eyebrow}>{p.project_number}</span><h3>{p.project_title}</h3><p>{next.title}</p></div>
        <span className={css.dashboardStage}>{stageLabel(p.project_stage,kind)} <span aria-hidden="true">↗</span></span>
       </Link>;
      })}
    </div>:<div className={css.empty}>No engineering projects are linked to this account yet. Authorised work will appear here automatically.</div>}
    {orderedProjects.length>3?<details className={css.dashboardMore}>
      <summary>View all {projects.length} projects</summary>
      <div className={css.list}>
       {orderedProjects.slice(3).map(p=><Link className={css.project} key={p.account_id+'-'+p.project_id} href={'/portal/'+kind+'/projects/'+p.project_id}>
        <div><p className={css.eyebrow}>{p.project_number}</p><h3>{p.project_title}</h3><p>{nextFor(p).title}</p></div>
        <div className={css.projectMeta}><span className={css.tag}>{stageLabel(p.project_stage,kind)}</span><span>{p.account_name}</span></div>
       </Link>)}
      </div>
     </details>:null}
   </section>

   {isClient?<details className={css.dashboardMore+' '+css.dashboardRegister}>
    <summary>Quotation register · {quotes.length} {quotes.length===1?'quotation':'quotations'}</summary>
    <section className={css.section} aria-label="Your quotations">
     <div className={css.sectionHead}><div><h2>Quotation register</h2></div></div>
     {quotes.length?<div className={css.list}>{quotes.map(q=><div className={css.project} key={q.quote_id}>
       <div><p className={css.eyebrow}>{q.quote_number}</p><h3>{q.lead_title||'Engineering quotation'}</h3><p>{String(q.client_response||'Awaiting response').replaceAll('_',' ')}</p></div>
       <div className={css.projectMeta}><strong>{formatAmount(q.total,q.currency)}</strong><Link href={'/portal/client/quotes/'+q.quote_id} className={css.secondaryAction}>Open secure quotation</Link></div>
     </div>)}</div>:<div className={css.empty}>No issued quotations are linked to your account.</div>}
    </section>
   </details>:null}

   {mine.length>1?<details className={css.dashboardMore+' '+css.dashboardRegister}>
    <summary>Linked accounts ({mine.length})</summary>
    <div className={css.summary}><p>{mine.map(x=>x.account_name).join(' · ')}</p></div>
   </details>:null}
  </>}
 </>;
}
