import Link from 'next/link';
import {notFound} from 'next/navigation';
import {formatAmount,isPortalKind,portalContext,stageLabel} from '@/lib/portals/account';
import {portalProjectNextStep} from '@/lib/presentation/threePortalNextAction';
import css from '../../../portal.module.css';

export const dynamic='force-dynamic';
export default async function AccountProject({params,searchParams}:{
 params:Promise<{kind:string;projectId:string}>;
 searchParams?:Promise<{notice?:string}>;
}){
 const {kind,projectId}=await params;
 if(!isPortalKind(kind))notFound();
 const {permitted,projects,supabase}=await portalContext(kind);
 const p=permitted?projects.find(x=>x.project_id===projectId):null;
 if(!p)notFound(); // Never disclose a project across organisations or portal kinds.
 const client=kind==='client';
 const next=portalProjectNextStep(kind,p);
 // Only the current explicitly entitled Client Portal user may discover an issued
 // protected review; the RPC also verifies project, company, cycle and membership.
 const reviewResult=kind==='client'&&['issued_to_client','client_review','completion','closed'].includes(p.project_stage)
  ?await supabase.rpc('op_qa_client_review_position',{p_project_id:p.project_id}):null;
 const review=(reviewResult&&!reviewResult.error&&reviewResult.data&&
  (reviewResult.data as {projectId?:string;issueId?:string}).projectId===p.project_id
  ?reviewResult.data as {issueId:string;decision:string|null;canRespond:boolean;revision:string}:null);
 const secureReview=review?'/portal/client/projects/'+p.project_id+'/review':null;
 const notice=String((await searchParams)?.notice||'').slice(0,280);
 const secure='/portal/'+kind+'/projects/'+p.project_id+'/open';
 return <>
  <Link className={css.crumb} href={'/portal/'+kind}>← Back to {client?'Client':'Partner'} Workspace</Link>
  <div className={css.hero}>
   <p className={css.eyebrow}>{p.account_name} / {p.project_number}</p>
   <h1 className={css.title}>{p.project_title}</h1>
   <p className={css.subtitle}>{stageLabel(p.project_stage,kind)} · {p.project_number}</p>
  </div>
  {notice?<p role="alert" className={css.notice}>Secure action unavailable: {notice}</p>:null}
  <section className={css.nextAction} aria-label="Current next step">
   <span className={css.eyebrow}>{secureReview&&review?.canRespond?'YOUR NEXT DECISION':next.waiting?'CURRENT DEPENDENCY':'YOUR NEXT ACTION'}</span>
   <h2>{secureReview?(review?.canRespond?'Review the approved engineering drawings':'Your protected client review is recorded'):next.title}</h2>
   <p>{secureReview?(review?.canRespond?'Inspect the watermarked current revision and record an attributable acceptance or correction request.':'View the issued engineering revision and any submitted decision. This is not final native file handover.'):next.description}</p>
   {secureReview?<Link className={css.action} href={secureReview}>{review?.canRespond?'Open controlled drawing review':'View your review record'} →</Link>:
     next.action?<Link className={css.action} href={secure}>{next.action} →</Link>:null}
  </section>
  <details className={css.compactDisclosure}>
   <summary>Project details and records</summary>
   <div className={css.card}>
   <span className={css.tag}>{stageLabel(p.project_stage,kind)}</span>
   <h2 style={{marginTop:16,fontSize:20}}>Project reference and controlled position</h2>
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
    <Link className={css.secondaryAction} href={secure}>{client?'View governed commercial status':'View authorised Partner Work'}</Link>
    <Link className={css.secondaryAction} href={'/portal/'+kind}>Back to your projects</Link>
   </div>
   <div className={css.notice}>{client?
   'The secure quotation page continues to handle accepted terms, payment and eventual final handover. A project status cannot unlock files.':
   'The existing Partner Work screen governs formal acceptance, commencement, progress and delivery. This account view cannot bypass any obligation.'}</div>
   </div>
  </details>
 </>;
}
