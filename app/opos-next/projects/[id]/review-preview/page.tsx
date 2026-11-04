import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import css from '../../../opos.module.css';

export const dynamic='force-dynamic';
export const metadata={title:'QA client review preview | Overflow Partner',robots:{index:false,follow:false}};

type File={id:string;filename:string;bucket:string;size:number};
type Gate={project_stage:string;revision:string|null;submission_id:string|null;
  files:File[];file_count:number;storage_complete:boolean;engineering_accepted:boolean;
  manifest_verified:boolean;release_authorised:boolean};

export default async function QAWatermarkedReviewPreview({params}:{params:Promise<{id:string}>}){
 if(!isKnownIsolatedQaBackend())notFound();
 const {id}=await params;
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
    <iframe title={'Watermarked QA preview of '+file.filename}
      src={'/opos-next/projects/'+id+'/review-preview/'+file.id+'#toolbar=0&navpanes=0'}
      style={{border:'1px solid #42464b',borderRadius:8,width:'100%',height:'min(84vh,850px)',background:'#24272b'}}/>
    <p className={css.meta}>The watermark is applied to the served PDF bytes. The embedded browser PDF viewer has no OPOS download control; a determined viewer may still save or capture rendered content. This is not sufficient for external client release certification.</p>
   </section>):ready?<div className={css.card}><p role="alert">The current submission contains no PDF previewable engineering file. A controlled technical preview is required before client issue.</p></div>:null}
  <p className={css.meta}>Next implementation gate: authenticated, recipient-scoped Client Review Portal access and an attributable client review outcome. This internal QA preview does not bypass it.</p>
 </div>;
}
