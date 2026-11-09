import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import css from '../../../opos.module.css';
import WatermarkedPdfViewer from './WatermarkedPdfViewer';
import {issueProtectedClientReviewAction} from '../qa-actions';

export const dynamic='force-dynamic';
export const metadata={title:'QA client review preview | Overflow Partner',robots:{index:false,follow:false}};

type File={id:string;filename:string;bucket:string;size:number};
type Gate={project_stage:string;revision:string|null;submission_id:string|null;
  files:File[];file_count:number;storage_complete:boolean;engineering_accepted:boolean;
  manifest_verified:boolean;release_authorised:boolean};

type Recipient={ready:boolean;activeRecipients:number;staffIdentityConflict:boolean;verifiedRecipients:number;setupRequired:boolean};
type StaffReview={issued:boolean};

export default async function QAWatermarkedReviewPreview({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<{error?:string}>}){
 if(!isKnownIsolatedQaBackend())notFound();
 const {id}=await params;
 const feedback=searchParams?await searchParams:{};
 const {supabase,organisationId,profile}=await requireUserContext();
 assertRole(profile.role,['owner','admin','operator','engineering']);
 const [projectResult,gateResult]=await Promise.all([
  supabase.from('projects').select('id,project_number,title,project_stage')
   .eq('organisation_id',organisationId).eq('id',id).maybeSingle(),
  supabase.rpc('op_qa_delivery_gate',{p_project_id:id}),
 ]);
 const project=projectResult.data;
 if(!project||projectResult.error||gateResult.error)notFound();
 const gate=gateResult.data as Gate|null;
 const ready=gate?.project_stage==='ready_for_client_issue'&&gate.storage_complete&&
  gate.engineering_accepted&&gate.manifest_verified&&gate.release_authorised&&
  Boolean(gate.submission_id)&&gate.file_count>0;
 const pdfs=(ready?gate.files:[]).filter(f=>f.bucket==='partner-delivery'&&f.filename.toLowerCase().endsWith('.pdf'));
 const ownerCanIssue=['owner','admin'].includes(String(profile.role));
 // The preview must never infer external recipient readiness from Auth alone.
 // The same current-cycle guarded RPC used by Project 360 remains authoritative.
 const [recipientResult,staffReviewResult]=ready&&pdfs.length>0&&ownerCanIssue
  ? await Promise.all([
    supabase.rpc('op_qa_northfield_client_recipient_state',{p_project_id:id}),
    supabase.rpc('op_qa_staff_client_review_state',{p_project_id:id}),
   ])
  : [null,null];
 const recipient=(recipientResult&&!recipientResult.error?recipientResult.data:null) as Recipient|null;
 const staffReview=(staffReviewResult&&!staffReviewResult.error?staffReviewResult.data:null) as StaffReview|null;
 const issueAllowed=Boolean(ready&&pdfs.length>0&&ownerCanIssue&&
  recipient?.ready&&!recipientResult?.error&&staffReview&&!staffReviewResult?.error&&!staffReview.issued);
 const releaseBlocker=!ready?'The approved current-cycle engineering package is not ready for client release.'
  :pdfs.length===0?'There is no previewable PDF in the approved current-cycle package.'
  :!ownerCanIssue?'Only an authenticated OP Owner or Admin can issue a client review. Ask an authorised owner to complete the release.'
  :recipientResult?.error||!recipient?'Client recipient verification is unavailable. Release remains locked until it succeeds.'
  :recipient.staffIdentityConflict?'Client identity conflicts with an OP staff account. A separate external QA client account is required.'
  :recipient.activeRecipients!==1?'Northfield needs exactly one active, independently authorised client recipient.'
  :recipient.verifiedRecipients!==1||!recipient.ready?'Northfield client account verification is incomplete. Confirm independent client access before release.'
  :staffReviewResult?.error||!staffReview?'The current-cycle release state cannot be verified. Release remains locked.'
  :staffReview.issued?'This R01 review has already been issued. Do not send it again.'
  :null;
 return <div style={{display:'grid',gap:24,maxWidth:1090,margin:'0 auto'}}>
  <div>
    <Link href={'/opos-next/projects/'+id} className={css.secondaryLink}>← Back to Project 360</Link>
    <p className={css.overline} style={{marginTop:22}}>ISOLATED QA / INTERNAL REVIEWER ONLY</p>
    <h1 style={{fontSize:'clamp(25px,3vw,35px)',lineHeight:1.2,margin:'10px 0 8px'}}>Watermarked Client Review Package — preparation preview</h1>
    <p className={css.meta} style={{lineHeight:1.75,maxWidth:850}}>{project.project_number} · {project.title} · {gate?.revision||'Revision not recorded'}</p>
  </div>
  <div className={css.card} style={{display:'grid',gap:12}}>
   <strong>Preparation is not external issue</strong>
   <p className={css.meta} style={{lineHeight:1.7}}>This is a private operator-only QA preview for inspecting the watermarked engineering package. It is not the Client Portal. No client link, email, transmittal or acceptance is generated. Native deliverables remain locked.</p>
   <p className={css.meta}>Engineering acceptance: <strong>{gate?.engineering_accepted?'Recorded':'Missing'}</strong> · Manifest verification: <strong>{gate?.manifest_verified?'Recorded':'Missing'}</strong> · Owner preparation authority: <strong>{gate?.release_authorised?'Recorded':'Missing'}</strong></p>
   {!ready?<p role="alert" style={{color:'#f2c4ad'}}>Preview withheld: current-cycle QA acceptance, manifest, storage and authorised preparation evidence are all required.</p>:null}
  </div>
  {ready&&pdfs.length>0?pdfs.map(file=><section key={file.id} className={css.card} style={{display:'grid',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
     <div><p className={css.overline}>WATERMARKED QA VIEWER</p><h2 style={{fontSize:18,margin:'8px 0 4px'}}>{file.filename}</h2><p className={css.meta}>{Math.ceil(Number(file.size||0)/1024)} KB · PDF · Current accepted revision</p></div>
     <span className={css.overline}>NOT CLIENT ISSUED</span>
    </div>
    <WatermarkedPdfViewer projectId={id} fileId={file.id} filename={file.filename}/>
    <p className={css.meta}>The watermark is applied to the served PDF bytes. The embedded browser PDF viewer has no OPOS download control; a determined viewer may still save or capture rendered content. This is not sufficient for external client release certification.</p>
   </section>):ready?<div className={css.card}><p role="alert">The current submission contains no PDF previewable engineering file. A controlled technical preview is required before client issue.</p></div>:null}
  <section id="send-for-client-review" className={css.card} aria-label="Release R01 for client review"
   style={{display:'grid',gap:14,scrollMarginTop:24,border:'1px solid #454951'}}>
   <span className={css.overline}>NEXT OPERATOR ACTION · CONTROLLED CLIENT REVIEW</span>
   <h2 style={{fontSize:21,margin:0}}>Send R01 to Northfield for review</h2>
   <p className={css.meta}>You've reviewed the watermarked preparation PDF above. Sending is a separate governed decision, not automatic. No email or native-file download is enabled by this action.</p>
   {feedback.error?<p role="alert" style={{color:'#f2c4ad'}}>Release blocked: {String(feedback.error).slice(0,350)}</p>:null}
   {releaseBlocker?<div role="status" style={{display:'grid',gap:9}}>
     <strong>Release currently blocked</strong>
     <p className={css.meta}>{releaseBlocker}</p>
     {ownerCanIssue&&ready&&pdfs.length>0&&!recipient?.ready?
      <Link className={css.secondaryLink} href={'/opos-next/projects/'+id+'#release-authorisation'}>Open Northfield client access controls →</Link>:null}
     {!ownerCanIssue?<p className={css.meta}>Your review access remains available; issuing requires a separate Owner/Admin decision.</p>:null}
   </div>:null}
   {issueAllowed?<form action={issueProtectedClientReviewAction} style={{display:'grid',gap:14,maxWidth:650}}>
     <input type="hidden" name="project_id" value={id}/>
     <input type="hidden" name="return_to" value="review_preview"/>
     <label className={css.qaChecklistRow}>
       <input type="checkbox" name="preview_confirmed" value="yes" required/>
       <span>I inspected the actual watermarked R01 PDF and confirmed it matches the current accepted engineering submission.</span>
     </label>
     <label style={{display:'grid',gap:7}}>Release and programme rationale
       <textarea name="note" required minLength={18} rows={3}
        placeholder="Confirm approved revision, verified Northfield recipient and programme risk mitigation."
        style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/>
     </label>
     <button className={css.action} type="submit" style={{border:0,cursor:'pointer'}}>Send R01 for client review →</button>
   </form>:null}
   <p className={css.meta}>Engineering acceptance, exact revision manifest, independent recipient verification and Owner/Admin permission remain enforced by the existing server-side release action.</p>
  </section>
 </div>;
}
