import ProjectLifecycleEvidence from '@/components/workspace/ProjectLifecycleEvidence';
import LifecycleProgress, {phaseForProject} from '@/components/workspace/LifecycleProgress';
import PartnerWorkSurface from '@/components/execution/PartnerWorkSurface';
import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {formatAmount,isPortalKind,portalContext,stageLabel} from '@/lib/portals/account';
import {clientSettlementPosition} from '@/lib/portals/clientSettlementPosition';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import ClientDrawingReview,{type ClientReview} from '@/app/portal/client/projects/[projectId]/review/ClientDrawingReview';
import css from '../../../portal.module.css';

export const dynamic='force-dynamic';
export default async function AccountProject({params,searchParams}:{
 params:Promise<{kind:string;projectId:string}>;
 searchParams?:Promise<{notice?:string;error?:string;updated?:string}>;
}){
 const {kind,projectId}=await params;
 if(!isPortalKind(kind))notFound();
 const {permitted,projects,supabase}=await portalContext(kind);
 // A Partner session (or other wrong portal kind) must not strand an invited
 // QA Client on a generic 404. Redirect to the correct sign-in while leaving
 // project-specific entitlement checks and non-QA routes untouched.
 if(!permitted){
  redirect('/login?next='+encodeURIComponent('/portal/'+kind)+'&error='+
   encodeURIComponent('You are signed in to a different workspace. Sign in with your '+(kind==='client'?'Client':'Partner')+' account to continue.'));
 }
 const p=permitted?projects.find(x=>x.project_id===projectId):null;
 if(!p)notFound(); // Never disclose a project across organisations or portal kinds.
 const client=kind==='client';
 // Only the current explicitly entitled Client Portal user may discover an issued
 // protected review; the RPC also verifies project, company, cycle and membership.
 const reviewResult=client&&isKnownIsolatedQaBackend()&&['issued_to_client','client_review','completion','closed'].includes(p.project_stage)
  ?await supabase.rpc('op_qa_client_review_position',{p_project_id:p.project_id}):null;
 const reviewData=reviewResult?.data as Partial<ClientReview>|null|undefined;
 const review:ClientReview|null=reviewResult&&!reviewResult.error&&reviewData&&
   reviewData.projectId===p.project_id&&typeof reviewData.issueId==='string'&&
   reviewData.issueId.length>0&&Array.isArray(reviewData.files)
   ?reviewData as ClientReview:null;
 // Portal membership has already been verified against this exact account.
 // Financial/review truth is read from the same current-cycle, organisation-scoped
 // records used by the final payment and native handover services. The QA client
 // review preview alone cannot authorise another payment request.
 let finalBalanceReady=false;
 let finalFilesReady=false;
 let finalPaid=false;
 let finalSettlementUnavailable=false;
 if(client){
   const position=await clientSettlementPosition(p.organisation_id,p.project_id,p.project_stage);
   ({finalBalanceReady,finalFilesReady,finalPaid,finalSettlementUnavailable}=position);
 }
 const secureReview=review&&!finalBalanceReady?'#drawing-review':null;
 const query:{notice?:string;error?:string;updated?:string}=searchParams?await searchParams:{};
 const notice=String(query.notice||'').slice(0,280);
 const feedback={error:String(query.error||'').slice(0,280),updated:String(query.updated||'').slice(0,260)};
 const settlementHref='/portal/client/projects/'+projectId+'/tasks/final-settlement';
 const finalFilesHref='/portal/client/projects/'+projectId+'/tasks/final-files';
 return <>
  <Link className={css.crumb} href={'/portal/'+kind}>← Back to {client?'Client':'Partner'} Workspace</Link>
  <div className={css.hero}>
   <p className={css.eyebrow}>{p.account_name} / {p.project_number}</p>
   <h1 className={css.title}>{p.project_title}</h1>
   <p className={css.subtitle}>{stageLabel(p.project_stage,kind)}</p>
  </div>
  <LifecycleProgress phase={phaseForProject(p.project_stage)}/>
  <ProjectLifecycleEvidence actor={kind} projectId={projectId}/>
  {notice?<p role="alert" className={css.notice}>We couldn’t open that page. Please return to your project and try again. If the problem continues, ask Overflow Partner for a fresh link.</p>:null}
  {client?<details className={css.compactDisclosure}>
   <summary>Secure review, settlement and handover services</summary>
   <section className={css.card} aria-label="Independently governed client controls">
    <h2>{finalFilesReady?'Approved files are available':finalSettlementUnavailable?'Financial verification unavailable':finalPaid?'Final payment received':finalBalanceReady?'Final settlement service':review?.canRespond?'Drawing review service':'Project services'}</h2>
    <p>{finalSettlementUnavailable?'The settlement service could not verify current financial evidence. Do not repeat a payment.':finalFilesReady?'Your current final files have passed the separate payment and owner-release checks.':finalPaid?'Your final balance is recorded; handover still requires the authorised owner release.':finalBalanceReady?'Open the independent, authenticated settlement service to review the balance.':'Client review and financial services remain independently permission-controlled.'}</p>
    {finalFilesReady?<Link className={css.secondaryAction} href={finalFilesHref}>Open approved files →</Link>:
     finalSettlementUnavailable||finalPaid?null:
     finalBalanceReady?<Link className={css.secondaryAction} href={settlementHref}>Review verified balance →</Link>:
     secureReview?<Link className={css.secondaryAction} href={secureReview}>Open controlled drawing review →</Link>:null}
   </section>
  </details>:p.project_stage==='closed'?<p className={css.subtitle}>Your completed Work Order and project evidence remain available below.</p>:
   <PartnerWorkSurface embeddedDecision assignmentEndpoint={'/portal/partner/projects/'+projectId+'/work'}/>}
  {client&&review?<ClientDrawingReview projectId={p.project_id} review={review} feedback={feedback}/>:null}
  <details className={css.compactDisclosure}>
   <summary>Project information</summary>
   <div className={css.card}>
   <dl className={css.facts}>
    <div><dt>Project</dt><dd>{p.project_number}</dd></div>
    <div><dt>Account</dt><dd>{p.account_name}</dd></div>
    <div><dt>Project stage</dt><dd>{stageLabel(p.project_stage,kind)}</dd></div>
    <div><dt>Agreed target</dt><dd>{p.due_date?new Date(p.due_date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Not set'}</dd></div>
    <div><dt>{client?'Client quotation':'Partner Work Order'}</dt><dd>{p.reference||'Pending release'}</dd></div>
    <div><dt>{client?'Client quotation total':'Agreed partner price'}</dt><dd>{formatAmount(p.amount,p.currency)}</dd></div>
    {!client?<><div><dt>Work Order acceptance</dt><dd>{p.work_order_accepted?'Formally accepted':'Not yet accepted'}</dd></div><div><dt>Execution state</dt><dd>{String(p.partner_execution_state||'Not released').replaceAll('_',' ')}</dd></div></>:null}
   </dl>
   </div>
  </details>
 </>;
}
