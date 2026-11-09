import LifecycleProgress, {phaseForProject} from '@/components/workspace/LifecycleProgress';
import PartnerWorkSurface from '@/components/execution/PartnerWorkSurface';
import Link from 'next/link';
import {createClient as createAdminClient} from '@supabase/supabase-js';
import {clientFinalFilesReady} from '@/lib/portals/clientFinalRelease';
import {hasCurrentClientAcceptance} from '@/lib/payments/currentClientAcceptance';
import {notFound,redirect} from 'next/navigation';
import {formatAmount,isPortalKind,portalContext,stageLabel} from '@/lib/portals/account';
import {portalProjectNextStep} from '@/lib/presentation/threePortalNextAction';
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
 // Portal membership has already been verified against this exact account.
 // Financial/review truth is read from the same current-cycle, organisation-scoped
 // records used by the final payment and native handover services. The QA client
 // review preview alone cannot authorise another payment request.
 let finalBalanceReady=false;
 let finalFilesReady=false;
 let finalPaid=false;
 let finalSettlementUnavailable=false;
 const finalServiceEnabled=process.env.OP_VOICE_FINAL_RELEASE_ENABLED==='true' &&
   (isKnownIsolatedQaBackend()||process.env.VERCEL_ENV==='production');
 if(client&&finalServiceEnabled&&['completion','closed'].includes(p.project_stage)){
   const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
   const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
   if(url&&key){
     const db=createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
     finalBalanceReady=await hasCurrentClientAcceptance(db,p.organisation_id,p.project_id);
     if(finalBalanceReady){
       const settlement=await db.from('op_project_final_settlements').select('verified_at')
         .eq('organisation_id',p.organisation_id).eq('project_id',p.project_id).maybeSingle();
       finalSettlementUnavailable=Boolean(settlement.error);
       finalPaid=!settlement.error&&Boolean(settlement.data?.verified_at);
       if(finalPaid)finalFilesReady=await clientFinalFilesReady(db,p.organisation_id,p.project_id);
     }
   }else finalSettlementUnavailable=true;
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
  {notice?<p role="alert" className={css.notice}>We couldn’t open that page. Please return to your project and try again. If the problem continues, ask Overflow Partner for a fresh link.</p>:null}
  {client ? <section className={css.nextAction} aria-label="Current next step">
   <span className={css.eyebrow}>NEXT STEP</span>
   <h2>{finalFilesReady?'Your approved engineering files are ready':finalSettlementUnavailable?'Final balance verification unavailable':finalPaid?'Final payment received · handover pending':finalBalanceReady?'Complete the final balance':secureReview?(review?.canRespond?'Review your drawings':'Your drawing review is available'):next.title}</h2>
   <p>{finalFilesReady?'Your final payment, latest accepted engineering revision and controlled handover have been verified. Open your secure files.':finalSettlementUnavailable?'We cannot verify the payment service at the moment. No repeat payment is requested; please contact Overflow Partner.':finalPaid?'Your final payment is recorded. Overflow Partner must separately authorise the controlled handover before final files become available. No further payment is required.':finalBalanceReady?'Your accepted review has been recorded. Open the final settlement page to see the verified balance and permitted payment options.':secureReview?(review?.canRespond?'Check the drawings and accept them or request changes.':'Your recorded drawing review remains available for reference.'):next.description}</p>
   {finalFilesReady?<Link className={css.action} href={finalFilesHref}>Open final engineering files →</Link>:
   finalSettlementUnavailable||finalPaid?null:
   finalBalanceReady?<Link className={css.action} href={settlementHref}>Review final balance →</Link>:
   secureReview?<Link className={css.action} href={secureReview}>{review?.canRespond?'Open drawing review':'View drawing review'} →</Link>:
     null}
  </section> : p.project_stage==='closed'?<section className={css.nextAction}><h2>Project closed</h2><p>Your work order and project details are available below.</p></section>:<PartnerWorkSurface assignmentEndpoint={'/portal/partner/projects/'+projectId+'/work'}/>}
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
