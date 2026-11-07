import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {formatAmount,isPortalKind,portalContext,stageLabel} from '@/lib/portals/account';
import {portalProjectNextStep} from '@/lib/presentation/threePortalNextAction';
import {isKnownIsolatedQaBackend,isKnownIsolatedQaPresentationPreview} from '@/lib/qa/isolation';
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
 if(!permitted&&isKnownIsolatedQaPresentationPreview()){
  redirect('/login?next='+encodeURIComponent('/portal/'+kind)+'&error='+
   encodeURIComponent('You are signed in to a different workspace. Sign in with your '+(kind==='client'?'Client':'Partner')+' account to continue.'));
 }
 const p=permitted?projects.find(x=>x.project_id===projectId):null;
 if(!p)notFound(); // Never disclose a project across organisations or portal kinds.
 const client=kind==='client';
 const next=portalProjectNextStep(kind,p);
 // Only the current explicitly entitled Client Portal user may discover an issued
 // protected review; the RPC also verifies project, company, cycle and membership.
 const reviewResult=client&&isKnownIsolatedQaBackend()&&['issued_to_client','client_review','completion','closed'].includes(p.project_stage)
  ?await supabase.rpc('op_qa_client_review_position',{p_project_id:p.project_id}):null;
 const reviewData=reviewResult?.data as Partial<ClientReview>|null|undefined;
 const review:ClientReview|null=reviewResult&&!reviewResult.error&&reviewData&&
   reviewData.projectId===p.project_id&&typeof reviewData.issueId==='string'&&
   reviewData.issueId.length>0&&Array.isArray(reviewData.files)
   ?reviewData as ClientReview:null;
 const finalBalanceReady=client&&p.project_stage==='completion'&&['accepted','accepted_with_comments'].includes(String(review?.decision||''));
 const secureReview=review&&!finalBalanceReady?'#drawing-review':null;
 const query:{notice?:string;error?:string;updated?:string}=searchParams?await searchParams:{};
 const notice=String(query.notice||'').slice(0,280);
 const feedback={error:String(query.error||'').slice(0,280),updated:String(query.updated||'').slice(0,260)};
 const secure='/portal/'+kind+'/projects/'+p.project_id+'/open';
 const settlementHref=secure+'?flow=final-settlement';
 return <>
  <Link className={css.crumb} href={'/portal/'+kind}>← Back to {client?'Client':'Partner'} Workspace</Link>
  <div className={css.hero}>
   <p className={css.eyebrow}>{p.account_name} / {p.project_number}</p>
   <h1 className={css.title}>{p.project_title}</h1>
   <p className={css.subtitle}>{stageLabel(p.project_stage,kind)}</p>
  </div>
  {notice?<p role="alert" className={css.notice}>We couldn’t open that page. Please return to your project and try again. If the problem continues, ask Overflow Partner for a fresh link.</p>:null}
  <section className={css.nextAction} aria-label="Current next step">
   <span className={css.eyebrow}>NEXT STEP</span>
   <h2>{finalBalanceReady?'Final balance and handover':secureReview?(review?.canRespond?'Review your drawings':'Your drawing review is available'):next.title}</h2>
   <p>{finalBalanceReady?'Your R01 review is accepted. Open the secure final-balance page to see settlement status before controlled final handover.':secureReview?(review?.canRespond?'Check the approved drawings. You can accept them or request changes.':'You can view the drawings and any response you have already submitted. Final editable files are provided separately after handover approval.'):next.description}</p>
   {finalBalanceReady?<Link className={css.action} href={settlementHref}>View final balance →</Link>:
   secureReview?<Link className={css.action} href={secureReview}>{review?.canRespond?'Open drawing review':'View drawing review'} →</Link>:
     !next.waiting&&next.action?<Link className={css.action} href={secure}>{next.action} →</Link>:null}
  </section>
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
   <div className={css.actions}>
    <Link className={css.secondaryAction} href={secure}>{client?'View quotations and payments':'Open Partner Work'}</Link>
   </div>
   <div className={css.notice}>{client?
   'Quotations, payments and final files are handled securely. Your project status alone does not mean payment is complete or final files are available.':
   'Use Partner Work to accept the Work Order, confirm your start, share progress and submit completed drawings.'}</div>
   </div>
  </details>
 </>;
}
