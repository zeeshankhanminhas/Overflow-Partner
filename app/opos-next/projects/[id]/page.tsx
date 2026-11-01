import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {resolveFinancialGate} from '@/lib/finance/state';
import {normaliseProjectStage,projectStageMeta} from '@/lib/projects/stages';
import {updateProjectMobilisationAction,advanceProjectStageAction} from '@/app/workspace/projects/[id]/actions';
import {recordClientTransmittalAction,recordClientReviewOutcomeAction} from '@/app/workspace/projects/[id]/client-actions';
import {approveFinalEngineeringReleaseAction} from '@/app/workspace/projects/[id]/final-release-action';
import WorkRecordV2 from '../../WorkRecordV2';
import css from '../../opos.module.css';

const date=(iso:string|null)=>iso?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'Europe/London'}).format(new Date(iso)):'Not set';
type Readiness={ready:boolean;reasons:string[];activityOpen?:number;approvedDocuments?:number;issuedDocuments?:number};
export default async function ProjectPage({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<{error?:string;updated?:string;advanced?:string}>}){
 const {id}=await params;
 const feedback=searchParams?await searchParams:{};
 const {supabase,organisationId,profile,user}=await requireUserContext();
 const [record,readinessResult,financialResult,managersResult]=await Promise.all([
   supabase.from('projects').select('id,project_number,title,status,project_stage,due_date,start_date,project_manager_id,lead_id,created_at')
     .eq('organisation_id',organisationId).eq('id',id).maybeSingle(),
   supabase.rpc('op_project_stage_readiness',{p_project_id:id}),
   supabase.rpc('op_project_financial_gate',{p_project_id:id}),
   supabase.from('profiles').select('id,full_name,role').eq('organisation_id',organisationId).order('full_name'),
 ]);
 if(record.error)throw new Error('Project record could not be loaded.');
 if(!record.data)notFound();
 const data=record.data;
 const {data:clientContact}=data.lead_id?await supabase.from('leads').select('contact_name,contact_email')
   .eq('organisation_id',organisationId).eq('id',data.lead_id).maybeSingle():{data:null};
 const stage=normaliseProjectStage(data.project_stage);
 const meta=projectStageMeta[stage];
 const readiness=(readinessResult.error?{ready:false,reasons:['Stage readiness could not be verified.']}:readinessResult.data||{ready:false,reasons:['Stage readiness is not available.']}) as Readiness;
 const financial=resolveFinancialGate(financialResult.error?null:financialResult.data);
 const {data:latestClientReview}=stage==='client_review'?await supabase.from('project_client_reviews')
   .select('outcome,recorded_at').eq('organisation_id',organisationId).eq('project_id',id)
   .order('recorded_at',{ascending:false}).limit(1).maybeSingle():{data:null};
 const qaWritable=isKnownIsolatedQaBackend();
 type FinalStatus={clientAccepted:boolean;finalPaid:boolean;ownerApproved:boolean;partnerPaid:boolean;readyForManualClosure:boolean};
 const {data:releaseStatus}=stage==='completion'&&qaWritable&&process.env.OP_VOICE_FINAL_RELEASE_ENABLED==='true'
   ?await supabase.rpc('op_project_voice_final_release_status',{p_organisation_id:organisationId,p_user_id:user.id,p_project_id:id})
   :{data:null};
 const finalStatus=releaseStatus as FinalStatus|null;
 const canWrite=qaWritable&&['owner','admin','operator','engineering','commercial'].includes(String(profile.role));
 const completed=stage==='closed'||['closed','complete','completed','cancelled'].includes(String(data.status||'').toLowerCase());
 const blockedReasons=[...(Array.isArray(readiness.reasons)?readiness.reasons:[]),...(stage==='mobilisation'&&!financial.authorised?[financial.reason]:[])];
 const mayAdvance=canWrite&&readiness.ready&&(stage!=='mobilisation'||financial.authorised);
 const stageHasStandardAction=!['ready_for_client_issue','client_review','completion','closed'].includes(stage);
 const stageIndex=stage==='mobilisation'?0:stage==='ready_for_execution'?1:['in_progress','internal_review','partner_correction'].includes(stage)?2:3;
 return <>
   <WorkRecordV2 eyebrow={'WORK / PROJECT 360 / '+(data.project_number||id.slice(0,8))}
     title={data.title||data.project_number} subtitle={'Controlled engineering delivery · Target '+date(data.due_date)}
     state={meta.label} owner="Overflow Partner / assigned delivery team"
     nextTitle={completed?'Project completion recorded':meta.action}
     nextDescription={completed?'The project is closed. Its history remains accessible.':meta.objective+' '+(blockedReasons.length?'Resolve the recorded readiness dependencies before advancing.':'Review the current stage controls below.')}
     stages={[{name:'Mobilisation',detail:'Advance and preparation'},{name:'Work Order',detail:'Partner acceptance required'},{name:'Execution',detail:'Technical work and internal QA'},{name:'Delivery & Closeout',detail:'Client review and settlement'}]}
     stageIndex={stageIndex} waiting={completed}
     evidence={[{label:'Project reference',value:data.project_number||id.slice(0,8)},{label:'Current stage',value:meta.label},{label:'Delivery target',value:date(data.due_date)},{label:'Stage readiness',value:readiness.ready?'Requirements satisfied':'Outstanding requirements'}]}
     facts={[{label:'Project status',value:String(data.status||'Not recorded').replaceAll('_',' ')},{label:'Created',value:date(data.created_at)},{label:'Financial authorisation',value:financial.displayState+' · '+financial.reason}]}
     governedHref={'/opos-next/projects/'+id+'#project-controls'} previous="/opos-next/projects"/>
   <section id="project-controls" className={css.section} aria-label="Governed project controls">
     <div className={css.sectionHeading}><h2>Project stage controls</h2></div>
     {feedback.error?<p role="alert" className={css.empty}>Action blocked: {String(feedback.error).slice(0,450)}</p>:null}
     {feedback.updated||feedback.advanced?<p role="status" className={css.empty}>{String(feedback.updated||'Project stage updated to '+feedback.advanced).slice(0,450)}</p>:null}
     <div className={css.card}>
       <span className={css.overline}>CURRENT RELEASE GATE</span><h2 className={css.cardTitle}>{meta.label}</h2>
       <p className={css.cardDescription}>{meta.completion}</p>
       {blockedReasons.length?<div style={{marginTop:20}}><strong>Outstanding evidence</strong><ul style={{marginTop:10,paddingLeft:20,color:'#b8bac0'}}>{blockedReasons.map((reason,index)=><li key={index} style={{marginBottom:8}}>{reason}</li>)}</ul></div>:<p className={css.meta} style={{marginTop:18}}>Stage-readiness service reports no outstanding reasons.</p>}
       {!qaWritable?<p className={css.meta} style={{marginTop:18}}>Transactional controls are locked until the isolated QA commercial-write gate is verified. This view does not redirect to legacy pages.</p>:null}
       {stage==='mobilisation'&&canWrite?<details style={{marginTop:22}} open={!data.project_manager_id||!data.start_date||!data.due_date}>
         <summary style={{cursor:'pointer',fontWeight:600}}>Set mobilisation owner and programme</summary>
         <form action={updateProjectMobilisationAction} style={{display:'grid',gap:15,marginTop:18,maxWidth:600}}>
           <input type="hidden" name="opos_next" value="1"/><input type="hidden" name="project_id" value={id}/>
           <label style={{display:'grid',gap:7}}>Project manager<select name="project_manager_id" required defaultValue={data.project_manager_id||''} style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}><option value="">Select manager</option>{(managersResult.data||[]).map(p=><option key={p.id} value={p.id}>{p.full_name||p.role}</option>)}</select></label>
           <label style={{display:'grid',gap:7}}>Start date<input name="start_date" type="date" required defaultValue={data.start_date?.slice(0,10)||''} style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/></label>
           <label style={{display:'grid',gap:7}}>Due date<input name="due_date" type="date" required defaultValue={data.due_date?.slice(0,10)||''} style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/></label>
           <button type="submit" className={css.action} style={{border:0,cursor:'pointer',marginTop:0}}>Save mobilisation controls →</button>
         </form>
       </details>:null}
       {!completed&&stageHasStandardAction&&canWrite?<form action={advanceProjectStageAction} style={{display:'grid',gap:14,maxWidth:600,marginTop:25}}>
         <input type="hidden" name="opos_next" value="1"/><input type="hidden" name="project_id" value={id}/>
         <input type="hidden" name="target_stage" value={meta.next||''}/>
         <label style={{display:'grid',gap:7}}>Decision note (optional)<textarea name="note" rows={3} style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/></label>
         <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button type="submit" disabled={!mayAdvance} className={css.action} style={{border:0,cursor:mayAdvance?'pointer':'not-allowed',opacity:mayAdvance?1:.45,marginTop:0}}>{meta.action} →</button>
         {stage==='internal_review'?<button type="submit" name="target_stage" value="partner_correction" className={css.action} style={{border:0,cursor:'pointer',marginTop:0}}>Request partner correction →</button>:null}</div>
       </form>:null}
       {stage==='ready_for_client_issue'&&canWrite?<section style={{marginTop:24}}>
         <h3 style={{fontSize:17,marginBottom:8}}>Issue controlled Client Review Package</h3>
         <p className={css.meta}>This sends a review-only controlled PDF. Editable engineering files remain blocked until verified final settlement and owner release.</p>
         <form action={recordClientTransmittalAction} style={{display:'grid',gap:14,maxWidth:600,marginTop:18}}>
           <input type="hidden" name="opos_next" value="1"/><input type="hidden" name="project_id" value={id}/>
           <label style={{display:'grid',gap:7}}>Authorised recipient<input name="recipient_name" required defaultValue={clientContact?.contact_name||''} style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/></label>
           <label style={{display:'grid',gap:7}}>Recipient email<input type="email" name="recipient_email" required defaultValue={clientContact?.contact_email||''} style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/></label>
           <label style={{display:'grid',gap:7}}>Delivery method<select name="delivery_method" defaultValue="email" style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}><option value="email">Email</option><option value="secure_link">Secure link</option><option value="client_portal">Client portal</option></select></label>
           <label style={{display:'grid',gap:7}}>Delivery note<textarea name="note" rows={3} style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/></label>
           <button type="submit" disabled={!mayAdvance||!clientContact?.contact_email} className={css.action} style={{border:0,opacity:mayAdvance&&clientContact?.contact_email?1:.45,cursor:mayAdvance?'pointer':'not-allowed',marginTop:0}}>Send controlled review package →</button>
         </form>
       </section>:null}
       {stage==='client_review'&&canWrite&&!latestClientReview?<section style={{marginTop:24}}>
         <h3 style={{fontSize:17,marginBottom:8}}>Record authorised client review</h3>
         <p className={css.meta}>Record actual written evidence only. Do not invent approval or treat silence as acceptance.</p>
         <form action={recordClientReviewOutcomeAction} style={{display:'grid',gap:14,maxWidth:600,marginTop:18}}>
           <input type="hidden" name="opos_next" value="1"/><input type="hidden" name="project_id" value={id}/>
           <label style={{display:'grid',gap:7}}>Client outcome<select name="outcome" required defaultValue="" style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}><option value="" disabled>Choose outcome</option><option value="accepted">Accepted</option><option value="accepted_with_comments">Accepted with comments</option><option value="changes_requested">Changes requested</option><option value="rejected">Rejected / correction required</option></select></label>
           <label style={{display:'grid',gap:7}}>Evidence basis<select name="evidence_basis" defaultValue="email_confirmation" style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}><option value="email_confirmation">Email confirmation</option><option value="signed_acceptance">Signed acceptance</option><option value="client_portal">Client portal</option><option value="meeting_record">Meeting record</option><option value="other_written">Other written evidence</option></select></label>
           <label style={{display:'grid',gap:7}}>Evidence reference<input name="evidence_reference" required placeholder="Email/date or signed review reference" style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/></label>
           <label style={{display:'grid',gap:7}}>Feedback classification<select name="feedback_category" defaultValue="in_scope_correction" style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}><option value="in_scope_correction">In-scope correction</option><option value="revision">Revision to approved design</option><option value="out_of_scope_change">New/out-of-scope work</option></select></label>
           <label style={{display:'flex',alignItems:'center',gap:10}}><input type="checkbox" name="partner_defect" value="true"/> Partner defect against approved scope</label>
           <label style={{display:'grid',gap:7}}>Consolidated comments<textarea name="comments" rows={4} placeholder="Include drawing/revision references for requested changes" style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/></label>
           <button type="submit" className={css.action} style={{border:0,cursor:'pointer',marginTop:0}}>Record evidenced client outcome →</button>
         </form>
       </section>:null}
       {stage==='client_review'&&latestClientReview?<p className={css.meta} style={{marginTop:20}}>Latest client review recorded: {String(latestClientReview.outcome).replaceAll('_',' ')}. Further action follows the controlled stage gate.</p>:null}
       {stage==='completion'?<section style={{marginTop:24}}>
         <h3 style={{fontSize:17,marginBottom:8}}>Final release and settlement</h3>
         <p className={css.meta}>No native files are released without verified final payment, accepted client review, current approved technical submission and a separate authorised owner decision.</p>
         {finalStatus?<div className={css.factRow} style={{marginTop:16}}>
           <span>Client review: <strong>{finalStatus.clientAccepted?'Accepted':'Pending'}</strong></span>
           <span>Final payment: <strong>{finalStatus.finalPaid?'Verified':'Not verified'}</strong></span>
           <span>Owner release: <strong>{finalStatus.ownerApproved?'Approved':'Pending'}</strong></span>
           <span>Partner settlement: <strong>{finalStatus.partnerPaid?'Recorded':'Pending'}</strong></span>
         </div>:<p className={css.meta}>The governed final-release service is not enabled or its status is unavailable. No action is offered.</p>}
         {finalStatus&&finalStatus.clientAccepted&&finalStatus.finalPaid&&!finalStatus.ownerApproved&&['owner','admin'].includes(String(profile.role))?<form action={approveFinalEngineeringReleaseAction} style={{display:'grid',gap:14,maxWidth:600,marginTop:22}}>
           <input type="hidden" name="opos_next" value="1"/><input type="hidden" name="project_id" value={id}/>
           <label style={{display:'grid',gap:7}}>Release approval note<textarea name="approval_note" rows={3} placeholder="Reference the approved engineering submission and final settlement evidence" style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/></label>
           <button type="submit" className={css.action} style={{border:0,cursor:'pointer',marginTop:0}}>Approve controlled final release →</button>
         </form>:null}
         {finalStatus?.readyForManualClosure&&canWrite?<form action={advanceProjectStageAction} style={{marginTop:22}}>
           <input type="hidden" name="opos_next" value="1"/><input type="hidden" name="project_id" value={id}/><input type="hidden" name="target_stage" value="closed"/>
           <button type="submit" className={css.action} style={{border:0,cursor:'pointer',marginTop:0}}>Close governed project →</button>
         </form>:null}
       </section>:null}
     </div>
     <div style={{display:'flex',gap:12,marginTop:20,flexWrap:'wrap'}}><Link className={css.secondaryLink} href="/opos-next/documents">Review document register ↗</Link><Link className={css.secondaryLink} href="/opos-next/finance">Review financial register ↗</Link></div>
   </section>
 </>;
}
