import WatermarkedPdfViewer from '@/app/opos-next/projects/[id]/review-preview/WatermarkedPdfViewer';
import {recordProtectedClientDecisionAction} from './review-actions';
import css from '../../../../portal.module.css';

export type ClientReview={
 issueId:string;projectId:string;projectNumber:string;title:string;stage:string;
 revision:string;issuedAt:string;dueAt:string;reference:string;
 files:{id:string;filename:string;size:number}[];
 decision:string|null;decisionComments:string|null;decidedAt:string|null;
 late:boolean;canRespond:boolean;
};

const format=(value:string)=>new Intl.DateTimeFormat('en-GB',{
 dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'
}).format(new Date(value));

/**
 * Client Portal project section. It never grants review access: the caller
 * first verifies the client's portal membership and obtains the one current,
 * recipient-specific issued review through op_qa_client_review_position.
 * The PDF route and decision RPC independently repeat the authorisation checks.
 */
export default function ClientDrawingReview({projectId,review,feedback}:{
 projectId:string;review:ClientReview;feedback?:{error?:string;updated?:string};
}){
 const canDecide=review.canRespond&&review.stage==='client_review'&&!review.decision;
 return <section id="drawing-review" className={css.section} aria-label="Review your drawings" style={{scrollMarginTop:90}}>
   <div className={css.sectionHead}>
    <div><p className={css.eyebrow}>DRAWINGS · {review.revision}</p><h2>Review your drawings</h2></div>
   </div>
   {feedback?.error?<p className={css.notice} role="alert">We couldn't save your response: {feedback.error.slice(0,280)}</p>:null}
   {feedback?.updated?<p className={css.notice} role="status">Your response has been received. Overflow Partner will review it.</p>:null}
   <div className={css.card} style={{display:'grid',gap:12}}>
    <p style={{margin:0,fontSize:14,lineHeight:1.6}}>
     {review.decision?'Your response is recorded. You can still see the drawings and your comments.':
      canDecide?'Check the drawings below, then accept this version or request changes.':
      'Your drawings are available for viewing. Please contact Overflow Partner if you need to discuss this review.'}
    </p>
    <p style={{fontSize:12,margin:0,color:'#596960'}}>Revision {review.revision} · Review by {format(review.dueAt)}</p>
    <details className={css.compactDisclosure}>
     <summary>About these drawings</summary>
     <p style={{fontSize:13,lineHeight:1.65,color:'#596960'}}>These are view-only review copies. Final editable files are supplied after the required approvals and final payment. Copies and screenshots cannot be completely prevented.</p>
     <p style={{fontSize:12,color:'#596960'}}>Review reference: {review.reference} · Shared {format(review.issuedAt)}</p>
    </details>
   </div>
   {review.files.filter(f=>String(f.filename||'').toLowerCase().endsWith('.pdf')).map(file=>
    <div key={file.id} className={css.card} style={{display:'grid',gap:12,marginTop:18}}>
     <h3 style={{fontSize:17,margin:0}}>{file.filename}</h3>
     <p style={{fontSize:12,color:'#596960',margin:0}}>Revision {review.revision} · PDF review copy</p>
     <WatermarkedPdfViewer projectId={projectId} fileId={file.id} filename={file.filename}
      sourceUrl={'/portal/client/projects/'+projectId+'/review/'+file.id} audience="client"/>
    </div>
   )}
   <div className={css.card} style={{display:'grid',gap:15,marginTop:18}}>
    <h3 style={{fontSize:19,margin:0}}>Your response</h3>
    {review.decision?<div role="status" style={{display:'grid',gap:9}}>
      <strong>{review.decision==='accepted'?'Accepted':
        review.decision==='accepted_with_comments'?'Accepted with comments':
        review.decision==='changes_requested'?'Changes requested':'Not accepted'}</strong>
      {review.decisionComments?<p style={{fontSize:13,lineHeight:1.6}}>{review.decisionComments}</p>:null}
      <p style={{fontSize:12,color:'#596960'}}>Received {review.decidedAt?format(review.decidedAt):''}. Overflow Partner will follow up if needed.</p>
     </div>:canDecide?<form action={recordProtectedClientDecisionAction} style={{display:'grid',gap:15,maxWidth:700}}>
      <input type="hidden" name="project_id" value={projectId}/>
      <label style={{display:'grid',gap:7,fontWeight:650,fontSize:13}}>Choose your response
       <select name="outcome" required defaultValue="" style={{width:'100%',padding:12,border:'1px solid #c6cec8',borderRadius:8,background:'#fff',color:'#1b1e1b'}}>
        <option value="" disabled>Select after reviewing the drawings</option>
        <option value="accepted">Accept these drawings</option>
        <option value="accepted_with_comments">Accept with comments</option>
        <option value="changes_requested">Request changes</option>
        <option value="rejected">Do not accept</option>
       </select>
      </label>
      <label style={{display:'grid',gap:7,fontWeight:650,fontSize:13}}>Comments
       <textarea name="comments" rows={5} maxLength={4500} placeholder="If you need changes, describe the drawing, issue and requested correction. Comments are optional for acceptance." style={{width:'100%',border:'1px solid #c6cec8',borderRadius:8,padding:12,resize:'vertical',background:'#fff',color:'#1b1e1b'}}/>
      </label>
      <label style={{display:'flex',gap:12,alignItems:'flex-start',fontSize:13,lineHeight:1.55}}>
       <input type="checkbox" name="confirmed" value="yes" required style={{width:18,height:18,margin:'2px 0 0',flexShrink:0}}/>
       <span>I am authorised to respond for this company, and my response applies to revision {review.revision}.</span>
      </label>
      <button type="submit" className={css.action} style={{border:0,cursor:'pointer',justifySelf:'start'}}>Submit response →</button>
      <p style={{fontSize:12,color:'#596960',margin:0}}>Your response is recorded against your signed-in client account. Overflow Partner will review it before taking the next step.</p>
     </form>:<p style={{fontSize:13,color:'#596960'}}>This review is not accepting another response. Contact Overflow Partner if you need help.</p>}
   </div>
  </section>;
}
