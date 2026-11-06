import Link from 'next/link';
import {notFound} from 'next/navigation';
import {formatAmount,isPortalKind,portalContext,stageLabel} from '@/lib/portals/account';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {portalProjectNextStep} from '@/lib/presentation/threePortalNextAction';
import css from '../portal.module.css';

export const dynamic='force-dynamic';

export default async function AccountWorkspace({params}:{params:Promise<{kind:string}>}){
 const {kind}=await params;
 if(!isPortalKind(kind))notFound();
 const {accounts,permitted,projects,quotes,supabase}=await portalContext(kind);
 const mine=accounts.filter(a=>a.portal_kind===kind);
 const isClient=kind==='client';
 const reviewCandidates=isClient?projects.filter(p=>p.project_stage==='client_review').slice(0,8):[];
 const reviewChecks=permitted?await Promise.all(reviewCandidates.map(async p=>{
  const {data,error}=await supabase.rpc('op_qa_client_review_position',{p_project_id:p.project_id});
  const review=data as {projectId?:string;canRespond?:boolean;revision?:string}|null;
  return !error&&review?.projectId===p.project_id&&review.canRespond?{project:p,review}:null;
 })):[];

 const liveClientReview=reviewChecks.find((r):r is {project:typeof projects[number];review:{projectId?:string;canRespond?:boolean;revision?:string}}=>Boolean(r))||null;
 const outstandingQuote=isClient?quotes.find(q=>!q.project_id&&['','awaiting_response','pending'].includes(String(q.client_response||'').trim())):null;

 // Role-scoped RPCs remain the only source of dashboard data. These counts and
 // ordering are presentation-only; a dashboard link never grants a transaction.
 const orderedProjects=[...projects].sort((a,b)=>{
  const aNeeds=portalProjectNextStep(kind,a).waiting?0:1;
  const bNeeds=portalProjectNextStep(kind,b).waiting?0:1;
  if(aNeeds!==bNeeds)return bNeeds-aNeeds;
  const aOpen=a.project_stage==='closed'?0:1;
  const bOpen=b.project_stage==='closed'?0:1;
  return bOpen-aOpen;
 });
 const chosenProject=orderedProjects[0]||null;
 const chosenAction=chosenProject?portalProjectNextStep(kind,chosenProject):null;
 const primary=liveClientReview?{label:'Review your drawings',detail:'Your drawings are ready. Please check them and accept or request changes.',href:'/portal/client/projects/'+liveClientReview.project.project_id+'/review',action:'Open drawing review',waiting:false}:outstandingQuote?{label:'Review your quotation',detail:'Check the price and scope, then accept, request more time or decline.',href:'/portal/client/quotes/'+outstandingQuote.quote_id+'/open',action:'Open quotation',waiting:false}:
  chosenProject&&chosenAction?{label:chosenAction.title,detail:chosenAction.description,href:'/portal/'+kind+'/projects/'+chosenProject.project_id+'/open',action:chosenAction.action||'View status',waiting:chosenAction.waiting}:null;
 const previewProjects=orderedProjects.slice(0,3);
 const title=isClient?'Your engineering projects':'Your engineering work';
 return <>
  <div className={css.hero+' '+css.dashboardHero}>
   <p className={css.eyebrow}>{isClient?'CLIENT':'EXECUTION PARTNER'} WORKSPACE</p>
   <h1 className={css.title}>{title}</h1>
   <p className={css.subtitle}>{mine.length===1?mine[0].account_name+' · ':''}Progress, decisions and documents in one place.</p>
  </div>
  {!permitted?<div className={css.empty}>This sign-in does not have access to a {isClient?'Client':'Partner'} Workspace. An Overflow Partner administrator must grant access to your verified account. <Link href="/portal" className={css.crumb}>View available workspaces</Link></div>:<>
   <section className={css.nextAction} aria-label="Your one next action">
    <span className={css.eyebrow}>{primary?(primary.waiting?'WAITING ON OTHERS':'YOUR NEXT STEP'):'ALL UP TO DATE'}</span>
    <h2>{primary?primary.label:'Nothing needs your action'}</h2>
    <p>{primary?primary.detail:'We’ll let you know when there is something to do.'}</p>
    {primary&&!primary.waiting?<Link className={css.action} href={primary.href}>{primary.action} →</Link>:null}
   </section>

   <section className={css.section+' '+css.dashboardSection} aria-label="Your project register" id="projects">
    <div className={css.sectionHead}><div><p className={css.eyebrow}>YOUR WORK</p><h2>Projects</h2></div></div>
    {previewProjects.length?<div className={css.dashboardList}>
      {previewProjects.map(p=>{
       const next=portalProjectNextStep(kind,p);
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
        <div><p className={css.eyebrow}>{p.project_number}</p><h3>{p.project_title}</h3><p>{portalProjectNextStep(kind,p).title}</p></div>
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
       <div className={css.projectMeta}><strong>{formatAmount(q.total,q.currency)}</strong><Link href={'/portal/client/quotes/'+q.quote_id+'/open'} className={css.secondaryAction}>Open secure quotation</Link></div>
     </div>)}</div>:<div className={css.empty}>No issued quotations are linked to your account.</div>}
    </section>
   </details>:null}

   {mine.length>1?<details className={css.dashboardMore+' '+css.dashboardRegister}>
    <summary>Linked accounts ({mine.length})</summary>
    <div className={css.summary}><p>{mine.map(x=>x.account_name).join(' · ')}</p></div>
   </details>:null}
   {isKnownIsolatedQaBackend()?<details className={css.dashboardMore+' '+css.dashboardRegister}>
    <summary>QA environment information</summary>
    <p className={css.notice}>Isolated QA rehearsal with fictional companies and transactions. This is not a live customer or partner environment.</p>
   </details>:null}
  </>}
 </>;
}
