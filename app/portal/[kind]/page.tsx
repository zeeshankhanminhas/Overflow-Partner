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
 const reviewChecks=await Promise.all(reviewCandidates.map(async p=>{
  const {data,error}=await supabase.rpc('op_qa_client_review_position',{p_project_id:p.project_id});
  const review=data as {projectId?:string;canRespond?:boolean;revision?:string}|null;
  return !error&&review?.projectId===p.project_id&&review.canRespond?{project:p,review}:null;
 }));
 const liveClientReview=reviewChecks.find((r):r is {project:typeof projects[number];review:{projectId?:string;canRespond?:boolean;revision?:string}}=>Boolean(r))||null;
 const outstandingQuote=isClient?quotes.find(q=>!q.project_id&&['','awaiting_response','pending'].includes(String(q.client_response||'').trim())):null;
 const chosenProject=projects.find(p=>!portalProjectNextStep(kind,p).waiting)||projects[0]||null;
 const chosenAction=chosenProject?portalProjectNextStep(kind,chosenProject):null;
 const primary=liveClientReview?{label:'Review your engineering drawings',detail:'An approved, watermarked engineering revision is waiting for your own authenticated review decision.',href:'/portal/client/projects/'+liveClientReview.project.project_id+'/review',action:'Open controlled client review',waiting:false}:outstandingQuote?{label:'Review your issued quotation',detail:'Check your current offer and respond using the authorised secure quotation page.',href:'/portal/client/quotes/'+outstandingQuote.quote_id+'/open',action:'Open secure quotation',waiting:false}:
  chosenProject&&chosenAction?{label:chosenAction.title,detail:chosenAction.description,href:'/portal/'+kind+'/projects/'+chosenProject.project_id+'/open',action:chosenAction.action||'View secure status',waiting:chosenAction.waiting}:null;
 const title=isClient?'Client Workspace':'Partner Workspace';
 const active=projects.filter(p=>['mobilisation','ready_for_execution','in_progress','partner_correction','internal_review','client_review'].includes(p.project_stage)).length;
 const needsAttention=projects.filter(p=>!portalProjectNextStep(kind,p).waiting).length+(outstandingQuote?1:0)+reviewChecks.filter(Boolean).length;
 return <>
  <div className={css.hero}>
   <p className={css.eyebrow}>OVERFLOW PARTNER / {isClient?'CLIENT':'EXECUTION PARTNER'} WORKSPACE</p>
   <h1 className={css.title}>{title}</h1>
   <p className={css.subtitle}>{isClient?
    'Quotations, projects and decisions.':
    'Work Orders, progress and submissions.'}</p>
  </div>
  {isKnownIsolatedQaBackend()?<div className={css.notice}>Isolated QA rehearsal · fictional companies and transactions. Permanent account access is being tested here; this is not a live customer or partner environment.</div>:null}
  {permitted?<section className={css.nextAction} aria-label="Your one next action">
    <span className={css.eyebrow}>{primary?(primary.waiting?'CURRENT DEPENDENCY · NO DECISION REQUIRED':'YOUR NEXT STEP'):'NO ACTION REQUIRED NOW'}</span>
    <h2>{primary?primary.label:'Your workspace is up to date'}</h2>
    <p>{primary?primary.detail:'New authorised quotations, Work Orders and engineering decisions will appear here when they are ready.'}</p>
    {primary?<Link className={primary.waiting?css.secondaryAction:css.action} href={primary.href}>{primary.action} →</Link>:null}
   </section>:null}
  {!permitted?<div className={css.empty}>This sign-in does not have access to a {isClient?'Client':'Partner'} Workspace. An Overflow Partner administrator must grant access to your verified organisation account. <Link href="/portal" className={css.crumb}>View available workspaces</Link></div>:<>
   <details className={css.compactDisclosure}>
    <summary>Account overview</summary>
    <div className={css.grid}>
    <div className={css.summary}><p className={css.eyebrow}>YOUR ACCOUNTS</p><strong>{mine.length}</strong><p>{mine.map(x=>x.account_name).join(' · ')}</p></div>
    <div className={css.summary}><p className={css.eyebrow}>ACTIVE PROJECTS</p><strong>{active}</strong><p>Linked only to your authorised {isClient?'client organisation':'execution assignments'}.</p></div>
    <div className={css.summary}><p className={css.eyebrow}>NEXT DECISIONS</p><strong>{needsAttention}</strong><p>{isClient?'Project reviews that need your response.':'Work assignments ready to start or requiring corrections.'}</p></div>
    </div>
   </details>
   <section className={css.section} aria-label="Your engineering projects">
    <div className={css.sectionHead}><div><p className={css.eyebrow}>PROJECTS</p><h2>Your project register</h2></div><p>{projects.length} records</p></div>
    {projects.length?<div className={css.list}>{projects.map(p=><Link className={css.project} key={p.account_id+'-'+p.project_id} href={'/portal/'+kind+'/projects/'+p.project_id}>
     <div><p className={css.eyebrow}>{p.account_name} · {p.project_number}</p><h3>{p.project_title}</h3><p>{portalProjectNextStep(kind,p).title}</p></div>
     <div className={css.projectMeta}><span className={css.tag}>{stageLabel(p.project_stage,kind)}</span><strong>{formatAmount(p.amount,p.currency)}</strong><span>{isClient?'Client commercial record':'Approved partner Work Order'} · {p.reference||'Pending'}</span></div>
    </Link>)}</div>:<div className={css.empty}>No projects are currently linked to this account. Existing signed quotation and Work Order links remain valid; no duplicate project will be created here.</div>}
   </section>
   {isClient?<section className={css.section} aria-label="Your quotations">
    <div className={css.sectionHead}><div><p className={css.eyebrow}>COMMERCIAL</p><h2>Quotation register</h2></div><p>{quotes.length} issued quotations</p></div>
    {quotes.length?<div className={css.list}>{quotes.map(q=><div className={css.project} key={q.quote_id}>
      <div><p className={css.eyebrow}>{q.lead_reference||'ENQUIRY'} · {q.quote_number}</p><h3>{q.lead_title||'Engineering quotation'}</h3><p>Client response: {String(q.client_response).replaceAll('_',' ')}</p></div>
      <div className={css.projectMeta}><strong>{formatAmount(q.total,q.currency)}</strong><Link href={'/portal/client/quotes/'+q.quote_id+'/open'} className={css.secondaryAction}>Open secure quotation</Link></div>
    </div>)}</div>:<div className={css.empty}>Issued quotations for your account will appear here when released by Overflow Partner.</div>}
   </section>:null}
  </>}
 </>;
}
