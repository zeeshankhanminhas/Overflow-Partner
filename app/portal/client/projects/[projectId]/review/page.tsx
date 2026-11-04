import Link from 'next/link';
import {notFound} from 'next/navigation';
import {portalContext} from '@/lib/portals/account';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import WatermarkedPdfViewer from '@/app/opos-next/projects/[id]/review-preview/WatermarkedPdfViewer';
import {recordProtectedClientDecisionAction} from './review-actions';
import css from '../../../../portal.module.css';

export const dynamic='force-dynamic';
export const metadata={title:'Secure engineering review | Overflow Partner',robots:{index:false,follow:false}};

type ReviewFile={id:string;filename:string;size:number};
type Review={issueId:string;projectId:string;projectNumber:string;title:string;stage:string;
 revision:string;issuedAt:string;dueAt:string;reference:string;files:ReviewFile[];
 decision:string|null;decisionComments:string|null;decidedAt:string|null;late:boolean;canRespond:boolean};

const format=(iso:string)=>new Intl.DateTimeFormat('en-GB',{
 dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'
}).format(new Date(iso));

export default async function ControlledClientReview({params,searchParams}:{
 params:Promise<{projectId:string}>;searchParams?:Promise<{error?:string;updated?:string}>;
}){
 if(!isKnownIsolatedQaBackend())notFound();
 const {projectId}=await params;
 const feedback=searchParams?await searchParams:{};
 const context=await portalContext('client');
 const authorisedProject=context.permitted&&context.projects.some(p=>p.project_id===projectId);
 if(!authorisedProject)notFound();
 const {data,error}=await context.supabase.rpc('op_qa_client_review_position',{p_project_id:projectId});
 if(error||!data)notFound();
 const review=data as Review;
 if(review.projectId!==projectId||!review.issueId||!Array.isArray(review.files))notFound();
 const showForm=review.canRespond&&review.stage==='client_review'&&!review.decision;
 return <div style={{display:'grid',gap:26}}>
   <Link className={css.crumb} href={'/portal/client/projects/'+projectId}>← Back to project status</Link>
   <header className={css.hero}>
    <p className={css.eyebrow}>YOUR CLIENT WORKSPACE / SECURE ENGINEERING REVIEW</p>
    <h1 className={css.title} style={{maxWidth:'32ch'}}>Review your approved engineering drawings</h1>
    <p className={css.subtitle}>{review.title} · {review.projectNumber} · Revision {review.revision}</p>
   </header>
   {feedback.error?<div className={css.notice} role="alert">Your decision was not recorded: {feedback.error.slice(0,280)}</div>:null}
   {feedback.updated?<div className={css.notice} role="status">{feedback.updated.slice(0,260)}</div>:null}
   <section className={css.nextAction} aria-label="Your current decision">
    <p className={css.eyebrow}>{showForm?'YOUR NEXT DECISION':'CURRENT REVIEW POSITION'}</p>
    <h2>{review.decision?'Your review decision has been received':showForm?'Inspect R'+review.revision.replace(/^R/i,'')+' and decide':'Your engineering review is recorded'}</h2>
    <p>{review.decision?'Your named account decision is recorded and is awaiting OP reconciliation. You do not need to decide again.':
      showForm?'Inspect the approved, watermarked drawings below. Accept this exact revision or give consolidated written correction requests.':
      'This controlled review is no longer accepting new decisions. Contact Overflow Partner for an authorised change.'}</p>
    <p style={{fontSize:12,margin:0}}>Issued in-app: {format(review.issuedAt)} · Review window due: {format(review.dueAt)}
     {review.late?' · Review period has elapsed; submitted decisions remain attributable.':''}</p>
   </section>
   <section className={css.card} style={{display:'grid',gap:12}}>
    <h2 style={{fontSize:19,margin:0}}>Review controls</h2>
    <p style={{fontSize:13,color:'#596960',lineHeight:1.7,margin:0}}>These are watermarked browser-only engineering review copies. They are not editable, native or final handover deliverables. Screenshots or technically determined extraction cannot be completely prevented. Final native files remain locked until verified final payment and OP owner authorisation.</p>
    <p style={{fontSize:12,color:'#596960',margin:0}}>Controlled reference: {review.reference} · Exactly the revision issued for your account</p>
   </section>
   {review.files.filter(f=>String(f.filename||'').toLowerCase().endsWith('.pdf')).map(file=>
    <section className={css.card} key={file.id} style={{display:'grid',gap:14}}>
     <div><p className={css.eyebrow}>APPROVED WATERMARKED REVIEW / {review.revision}</p>
      <h2 style={{fontSize:19,margin:'9px 0 2px'}}>{file.filename}</h2>
      <p style={{fontSize:12,color:'#596960',margin:0}}>{Math.ceil(Number(file.size||0)/1024)} KB · PDF review copy</p>
     </div>
     <WatermarkedPdfViewer projectId={projectId} fileId={file.id} filename={file.filename}
      sourceUrl={'/portal/client/projects/'+projectId+'/review/'+file.id} audience="client"/>
    </section>
   )}
   <section className={css.card} style={{display:'grid',gap:16}}>
    <p className={css.eyebrow}>CLIENT REVIEW DECISION</p>
    {review.decision?<div role="status" style={{display:'grid',gap:10}}>
      <h2 style={{fontSize:20,margin:0}}>Decision received: {review.decision.replaceAll('_',' ')}</h2>
      {review.decisionComments?<p style={{fontSize:13,lineHeight:1.7}}>{review.decisionComments}</p>:null}
      <p style={{fontSize:12,color:'#596960'}}>Recorded at {review.decidedAt?format(review.decidedAt):'time unavailable'}. OP will verify and action the outcome. No further acceptance is assumed.</p>
    </div>:showForm?<form action={recordProtectedClientDecisionAction} style={{display:'grid',gap:16,maxWidth:700}}>
      <input type="hidden" name="project_id" value={projectId}/>
      <label style={{display:'grid',gap:7,fontWeight:650,fontSize:13}}>Your decision
       <select name="outcome" required defaultValue="" style={{width:'100%',padding:12,border:'1px solid #c6cec8',borderRadius:8,background:'#fff',color:'#1b1e1b'}}>
        <option value="" disabled>Select after reviewing the drawings</option>
        <option value="accepted">Accept this revision</option>
        <option value="accepted_with_comments">Accept with non-blocking comments</option>
        <option value="changes_requested">Request specific in-scope corrections</option>
        <option value="rejected">Reject this revision</option>
       </select>
      </label>
      <label style={{display:'grid',gap:7,fontWeight:650,fontSize:13}}>Your written comments and drawing references
       <textarea name="comments" rows={5} maxLength={4500} placeholder="For corrections, explain the drawing/reference, issue and requested change. For acceptance, comments are optional." style={{width:'100%',border:'1px solid #c6cec8',borderRadius:8,padding:12,resize:'vertical',background:'#fff',color:'#1b1e1b'}}/>
      </label>
      <label style={{display:'flex',alignItems:'flex-start',gap:12,fontSize:13,lineHeight:1.5}}>
       <input type="checkbox" required name="confirmed" value="yes" style={{width:18,height:18,margin:'2px 0 0',flexShrink:0}}/>
       <span>I am an authorised representative of this client account, and my decision refers to revision {review.revision} of the controlled engineering package.</span>
      </label>
      <button className={css.action} type="submit" style={{justifySelf:'start',border:0,cursor:'pointer'}}>Record my review decision →</button>
      <p style={{fontSize:12,color:'#596960',margin:0}}>Your decision will be stored with your authenticated client identity. OP's separate controlled review/reconciliation stage remains mandatory.</p>
     </form>:<p style={{fontSize:13,color:'#596960'}}>A new review response cannot be entered in the current project stage.</p>}
   </section>
  </div>;
}
