import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {prepareQaHandoverPack,advanceQaHandoverPack} from './actions';
import css from '../../../opos.module.css';

export const dynamic='force-dynamic';

export default async function QaHandoverPack({params,searchParams}:{
 params:Promise<{id:string}>;
 searchParams:Promise<{error?:string;updated?:string}>;
}){
 const {id}=await params;const {error,updated}=await searchParams;
 if(!/^[0-9a-f-]{36}$/i.test(id)||!isKnownIsolatedQaBackend())notFound();
 const {supabase,organisationId,profile,user}=await requireUserContext('/opos-next');
 assertRole(profile.role,['owner','admin']);
 const [{data:project},{data:doc},{data:finalStatus,error:finalStatusError},{data:review}]=await Promise.all([
  supabase.from('projects').select('id,project_number,title,project_stage')
   .eq('id',id).eq('organisation_id',organisationId).maybeSingle(),
  supabase.from('documents').select('id,reference,title,document_type,revision_code,status,storage_path,approved_at,issued_at,signed_at,independent_review_required')
   .eq('organisation_id',organisationId).eq('project_id',id).eq('document_type','handover-pack').eq('is_current_revision',true).maybeSingle(),
  supabase.rpc('op_project_voice_final_release_status',{
    p_organisation_id:organisationId,p_user_id:user.id,p_project_id:id
   }),
  supabase.from('project_client_reviews').select('outcome')
   .eq('organisation_id',organisationId).eq('project_id',id)
   .order('recorded_at',{ascending:false}).limit(1).maybeSingle(),
 ]);
 if(!project||!doc)notFound();
 const state=String(doc.status);
 const accepted=['accepted','accepted_with_comments'].includes(String(review?.outcome));
 const paid=!finalStatusError&&Boolean((finalStatus as null|{finalPaid?:boolean})?.finalPaid);
 const hasFile=Boolean(doc.storage_path);
 const ready=project.project_stage==='completion'&&accepted&&paid;
 const next=state==='draft'?'Prepare draft R01 Handover Pack':
  state==='in_review'?'Sign reviewed Handover Pack':
  state==='signed'?'Approve reviewed Handover Pack':
  state==='approved'?'Issue controlled Handover Pack':null;
 const step=state==='in_review'?'sign':state==='signed'?'approve':state==='approved'?'issue':'';
 return <section className={css.section} style={{maxWidth:860,margin:'32px auto',display:'grid',gap:20}}>
  <p className={css.meta}>PROJECT / {project.project_number} / CONTROLLED DOCUMENTS</p>
  <h1 style={{fontSize:32,margin:0}}>Final Handover Pack</h1>
  <p className={css.meta}>{project.title} — authorised owner review of the current accepted engineering package. This private QA document does not itself release native deliverables.</p>
  {updated?<p role="status" className={css.card}>{updated}</p>:null}
  {error?<p role="alert" className={css.card}>{error}</p>:null}
  <div className={css.card} style={{display:'grid',gap:12}}>
   <h2 style={{fontSize:20,margin:0}}>{doc.reference}</h2>
   <dl className={css.detailFacts}>
    <div><dt>Document revision</dt><dd>{doc.revision_code||'P01'}</dd></div>
    <div><dt>Controlled status</dt><dd>{state.replaceAll('_',' ')}</dd></div>
    <div><dt>Accepted client review</dt><dd>{accepted?'Recorded':'Missing'}</dd></div>
    <div><dt>Verified final settlement</dt><dd>{paid?'Recorded':'Missing'}</dd></div>
    <div><dt>QA PDF index</dt><dd>{hasFile?'Stored privately':'Not yet prepared'}</dd></div>
    <div><dt>Owner approval</dt><dd>{doc.approved_at?'Recorded':'Pending'}</dd></div>
    <div><dt>Document issue</dt><dd>{doc.issued_at?'Issued':'Not issued'}</dd></div>
   </dl>
   {hasFile?<Link className={css.secondaryLink} href={'/opos-next/projects/'+id+'/handover/file'} target="_blank">Open protected Handover Pack PDF for review →</Link>:null}
  </div>
  {next?<div className={css.card} style={{display:'grid',gap:14}}>
   <h2 style={{fontSize:20,margin:0}}>Next controlled action</h2>
   <p className={css.meta}>{state==='draft'?
    'Prepare a private QA handover index from the accepted R01 partner submission and verified payment evidence. The generated document begins In Review, never Issued.':
    'Review the current private handover PDF before making this separate authenticated owner decision. This step changes only the controlled document status.'}</p>
   {finalStatusError?<p role="alert" className={css.meta}>Payment verification service is unavailable. The handover remains locked. Please use Project 360 to review the status.</p>:!ready?<p role="alert" className={css.meta}>Client acceptance, independently verified payment and a completed engineering project are required.</p>:null}
   {state==='draft'?<form action={prepareQaHandoverPack}>
    <input type="hidden" name="project_id" value={id}/>
    <button disabled={!ready} type="submit" className={css.action} style={{border:0,cursor:ready?'pointer':'not-allowed'}}>{next} →</button>
   </form>:<form action={advanceQaHandoverPack} style={{display:'grid',gap:12,maxWidth:600}}>
    <input type="hidden" name="project_id" value={id}/>
    <input type="hidden" name="step" value={step}/>
    <label className={css.meta}><input type="checkbox" required name="acknowledge" value="reviewed"/> I have reviewed the controlled R01 PDF and its supporting evidence for this {step} decision.</label>
    <button disabled={!ready||!hasFile} type="submit" className={css.action} style={{border:0,cursor:'pointer'}}>{next} →</button>
   </form>}
   {doc.independent_review_required?<p className={css.meta}>Independent review is required: signer and approver must be different authorised users.</p>:null}
  </div>:<div className={css.card} style={{display:'grid',gap:10}}>
    <h2 style={{fontSize:20,margin:0}}>Controlled document {state}</h2>
    <p className={css.meta}>The document has reached its current issue state. Only the separate owner final-release decision may unlock client native files.</p>
   </div>}
  <div className={css.card} style={{display:'grid',gap:10}}>
   <h3 style={{fontSize:16,margin:0}}>Separate release boundary</h3>
   <p className={css.meta}>The controlled Handover Pack must be signed, approved and issued. Client file access also requires current technical acceptance, verified final payment and a separate owner final-release approval. Execution Partner settlement and project closure are later decisions.</p>
   <Link className={css.secondaryLink} href={'/opos-next/projects/'+id+'#final-release'}>Return to owner final-release control →</Link>
   <Link className={css.secondaryLink} href={'/opos-next/projects/'+id+'/final-settlement'}>Review commercial closeout →</Link>
  </div>
 </section>;
}
