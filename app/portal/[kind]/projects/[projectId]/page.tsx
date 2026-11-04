import Link from 'next/link';
import {notFound} from 'next/navigation';
import {formatAmount,isPortalKind,portalContext,stageLabel} from '@/lib/portals/account';
import {portalProjectNextStep} from '@/lib/presentation/threePortalNextAction';
import css from '../../../portal.module.css';
export const dynamic='force-dynamic';
export default async function AccountProject({params}:{params:Promise<{kind:string;projectId:string}>}){
 const {kind,projectId}=await params;if(!isPortalKind(kind))notFound();
 const {permitted,projects}=await portalContext(kind);
 const p=permitted?projects.find(x=>x.project_id===projectId):null;
 if(!p)notFound(); // Never reveal existence across accounts or portal kinds.
 const client=kind==='client';
 const next=portalProjectNextStep(kind,p);
 return <>
  <Link className={css.crumb} href={'/portal/'+kind}>← Back to {client?'Client':'Partner'} Workspace</Link>
  <div className={css.hero}><p className={css.eyebrow}>{p.account_name} / {p.project_number}</p>
    <h1 className={css.title}>{p.project_title}</h1>
    <p className={css.subtitle}>A controlled record of your engineering project. Any contractual or technical decision still follows its approved OPOS workflow.</p>
  </div>
  <div className={css.card}>
   <span className={css.tag}>{stageLabel(p.project_stage,kind)}</span>
   <h2 style={{marginTop:18}}>{nextAction(p.project_stage,kind)}</h2>
   <p>{client?'Engineering delivery remains managed by Overflow Partner. Quotations, advances, reviews and final handovers are separately governed.':
       'Your executed Work Order and authorised execution controls remain in the existing secure Partner Work page. Partner payout is never advanced before the verified client settlement and QA gates.'}</p>
   <dl className={css.facts}>
    <div><dt>Project</dt><dd>{p.project_number}</dd></div>
    <div><dt>Account</dt><dd>{p.account_name}</dd></div>
    <div><dt>Project position</dt><dd>{stageLabel(p.project_stage,kind)}</dd></div>
    <div><dt>Agreed target</dt><dd>{p.due_date?new Date(p.due_date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Not set'}</dd></div>
    <div><dt>{client?'Client quotation':'Partner Work Order'}</dt><dd>{p.reference||'Pending release'}</dd></div>
    <div><dt>{client?'Client quotation total':'Agreed partner price'}</dt><dd>{formatAmount(p.amount,p.currency)}</dd></div>
    {!client?<><div><dt>Work Order acceptance</dt><dd>{p.work_order_accepted?'Formally accepted':'Not yet accepted'}</dd></div><div><dt>Execution state</dt><dd>{String(p.partner_execution_state||'Not released').replaceAll('_',' ')}</dd></div></>:null}
   </dl>
   <div className={css.actions}>
    <Link className={css.action} href={'/portal/'+kind+'/projects/'+p.project_id+'/open'}>{action}</Link>
    <Link className={css.secondaryAction} href={'/portal/'+kind}>Back to project register</Link>
   </div>
  </div>
  <div className={css.notice}>{client?'The secure quotation page remains the approved place for quotation decisions and payment handling. This account dashboard cannot bypass payment or download gates.':
    'The secure Partner Work screen remains the approved place for commencement, progress, delivery file upload and formal Work Order acceptance. Access is restricted to your assigned company.'}</div>
 </>;
}
