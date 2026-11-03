import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {resolveFinancialGate} from '@/lib/finance/state';
import {normaliseProjectStage,projectStageMeta} from '@/lib/projects/stages';
import {updateProjectMobilisationAction,advanceProjectStageAction} from '@/app/workspace/projects/[id]/actions';
import {recordClientReviewOutcomeAction} from '@/app/workspace/projects/[id]/client-actions';
import {approveFinalEngineeringReleaseAction} from '@/app/workspace/projects/[id]/final-release-action';
import WorkRecordV2 from '../../WorkRecordV2';
import {retryGovernedWorkOrderAction} from './work-order/action';
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
 // Surface partner, technical QA and client-issue evidence inside Workspace 2.0.
 // These queries are read-only: no partner invitation, Work Order or client release is inferred.
 const [assignmentResult,sessionResult,submissionResult,deliveryResult,transmittalResult,workOrderAcceptanceResult,workOrderResult,commencementResult,progressResult]=await Promise.all([
   supabase.from('project_execution_assignments').select('id,execution_state,partner_contact_name,release_reference,released_at,execution_cycle')
     .eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
   supabase.from('partner_execution_sessions').select('id,status,expires_at,first_opened_at')
     .eq('organisation_id',organisationId).eq('project_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
   supabase.from('partner_delivery_submissions').select('id,revision,review_status,submitted_at,delivery_summary')
     .eq('organisation_id',organisationId).eq('project_id',id).order('submitted_at',{ascending:false}).limit(5),
   supabase.from('project_delivery_items').select('id,title,status,internal_review_status,client_review_status')
     .eq('organisation_id',organisationId).eq('project_id',id).order('created_at',{ascending:false}).limit(20),
   supabase.from('project_client_transmittals').select('id,transmittal_reference,issued_at,recipient_name')
     .eq('organisation_id',organisationId).eq('project_id',id).order('issued_at',{ascending:false}).limit(1).maybeSingle(),
   supabase.from('partner_work_order_acceptances').select('id,accepted_at,accepted_by_name,accepted_by_role')
     .eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
   supabase.from('partner_work_orders').select('id,reference,issued_at')
     .eq('organisation_id',organisationId).eq('project_id',id).maybeSingle(),
   supabase.from('partner_commencement_declarations').select('id,planned_commencement_date,forecast_delivery_date,submitted_at')
     .eq('organisation_id',organisationId).eq('project_id',id).order('submitted_at',{ascending:false}).limit(1).maybeSingle(),
   supabase.from('partner_progress_updates').select('id,progress_state,forecast_delivery_date,submitted_at')
     .eq('organisation_id',organisationId).eq('project_id',id).order('submitted_at',{ascending:false}).limit(1).maybeSingle(),
 ]);
 const evidenceUnavailable=[assignmentResult,sessionResult,submissionResult,deliveryResult,transmittalResult,workOrderAcceptanceResult,workOrderResult,commencementResult,progressResult].some(result=>Boolean(result.error));
 const assignment=assignmentResult.data;
 const partnerSession=sessionResult.data;
 const workOrderAcceptance=workOrderAcceptanceResult.data;
 const issuedWorkOrder=workOrderResult.data;
 const partnerCommencement=commencementResult.data;
 const partnerProgress=progressResult.data;
 const submissions=submissionResult.data||[];
 const deliveryItems=deliveryResult.data||[];
 const transmittal=transmittalResult.data;
 const stage=normaliseProjectStage(data.project_stage);

 // Bring real current-cycle partner evidence and the two governed QA documents
 // into the Internal Review decision itself. A stage move is not QA approval.
 let internalQaDocuments: Array<{id:string;document_type:string;status:string;reference:string|null}> = [];
 let internalQaFiles: Array<{id:string;original_filename:string;size_bytes:number|null}> = [];
 let internalQaEvidenceUnavailable = false;
 if(stage==='internal_review'){
   const [qaDocs,qaFiles]=await Promise.all([
     supabase.from('documents').select('id,document_type,status,reference')
       .eq('organisation_id',organisationId).eq('project_id',id)
       .in('document_type',['technical-review','document-register']),
     supabase.from('partner_delivery_submission_files').select('id,original_filename,size_bytes')
       .eq('organisation_id',organisationId).eq('project_id',id)
       .eq('submission_id',submissions[0]?.id||'00000000-0000-0000-0000-000000000000'),
   ]);
   internalQaEvidenceUnavailable=Boolean(qaDocs.error||qaFiles.error);
   internalQaDocuments=qaDocs.data||[];
   internalQaFiles=qaFiles.data||[];
 }
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
 // Work Order issuance is NOT the same as advancing the mobilisation stage.
 // It uses the existing authenticated action, approved technical scope, and
 // verified deposit; no SOW shortcut or synthetic acceptance is required.
 const workOrderCanIssue=qaWritable && !evidenceUnavailable &&
   ['owner','admin'].includes(String(profile.role)) &&
   stage==='mobilisation' && financial.authorised && !issuedWorkOrder?.id;
 const needsWorkOrder=stage==='mobilisation' && !issuedWorkOrder?.id;
 // A formally accepted WO completes its milestone even while the raw
 // assignment state awaits the partner's distinct start confirmation.
 const workOrderAccepted=Boolean(workOrderAcceptance?.accepted_at);
 const waitingForPartnerStart=stage==='ready_for_execution'&&workOrderAccepted;
 const assignmentDisplay=assignment
   ? workOrderAccepted&&assignment.execution_state==='awaiting_acknowledgement'
     ? 'Work Order accepted · partner start pending'
     : String(assignment.execution_state||'Status not recorded').replaceAll('_',' ')
   : 'No assignment recorded';
 const stageIndex=stage==='mobilisation'?0:stage==='ready_for_execution'?(workOrderAccepted?2:1):['in_progress','internal_review','partner_correction'].includes(stage)?2:3;
 const waitingForEngineering=stage==='in_progress'&&submissions.length===0;
 const agreedDue=String(data.due_date||'').slice(0,10);
 const partnerForecast=String(partnerProgress?.forecast_delivery_date||partnerCommencement?.forecast_delivery_date||'').slice(0,10);
 const scheduleVariance=Boolean(agreedDue&&partnerForecast&&partnerForecast>agreedDue);
 return <>
   <WorkRecordV2 eyebrow={'WORK / PROJECT 360 / '+(data.project_number||id.slice(0,8))}
     title={data.title||data.project_number} subtitle={'Controlled engineering delivery · Target '+date(data.due_date)}
     state={meta.label} owner="Overflow Partner / assigned delivery team"
     nextTitle={completed?'Project completion recorded':needsWorkOrder?'Issue the Execution Partner Work Order':waitingForPartnerStart?'Partner to confirm commencement':waitingForEngineering?'Await engineering progress and delivery':meta.action}
     nextDescription={completed?'The project is closed. Its history remains accessible.':needsWorkOrder?'Issue the governed Work Order against the approved scope and verified advance. Mobilisation completion is a later, separate step.':waitingForPartnerStart?'The Work Order has been formally accepted. The Execution Partner must confirm scope, inputs, capacity and planned start in their existing secure Partner Portal. OPOS then advances to In Progress automatically.':waitingForEngineering?'Partner execution has commenced. Await the engineering progress report and a controlled delivery submission from the existing Partner Portal. OP technical quality review is a separate next-stage decision.':meta.objective+' '+(blockedReasons.length?'Resolve the recorded readiness dependencies before advancing.':'Review the current stage controls below.')}
     stages={[{name:'Mobilisation',detail:'Advance and preparation'},{name:'Work Order',detail:workOrderAccepted?'Formally accepted':'Partner acceptance required'},{name:'Execution',detail:waitingForPartnerStart?'Await partner start':'Technical work and internal QA'},{name:'Delivery & Closeout',detail:'Client review and settlement'}]}
     stageIndex={stageIndex} waiting={completed}
     evidence={[{label:'Project reference',value:data.project_number||id.slice(0,8)},{label:'Current stage',value:meta.label},{label:'Delivery target',value:date(data.due_date)},{label:'Next transition',value:readiness.ready?'Requirements satisfied':waitingForEngineering?'Awaiting engineering delivery':'Supporting evidence required'}]}
     facts={[{label:'Project status',value:String(data.status||'Not recorded').replaceAll('_',' ')},{label:'Created',value:date(data.created_at)},{label:'Financial authorisation',value:financial.displayState+' · '+financial.reason}]}
     governedHref={'/opos-next/projects/'+id+(needsWorkOrder?'#work-order-issue':'#project-controls')} previous="/opos-next/projects"/>
   {scheduleVariance?<section className={css.section} aria-label="Partner schedule variance" role="status">
     <div className={css.card}>
       <span className={css.overline}>SCHEDULE VARIANCE · OP REVIEW REQUIRED</span>
       <h2 className={css.cardTitle}>Partner forecast exceeds agreed delivery date</h2>
       <p className={css.cardDescription}>Partner forecast: <strong>{date(partnerForecast)}</strong>. Project / Work Order due date: <strong>{date(data.due_date)}</strong>. The partner's forecast is not an authorised change to the commercial commitment. Review the delivery risk, mitigation and any formal change decision separately.</p>
       {partnerProgress?<p className={css.meta} style={{marginTop:12}}>Latest partner-reported delivery health: <strong>{String(partnerProgress.progress_state||'Not provided').replaceAll('_',' ')}</strong>.</p>:null}
     </div>
   </section>:null}
   {stage==='mobilisation'?<section id="work-order-issue" className={css.section} aria-label="Execution Partner Work Order" style={{scrollMarginTop:24}}>
     <div className={css.sectionHeading}><h2>Execution Partner Work Order</h2></div>
     <div className={css.card}>
       <span className={css.overline}>NEXT OPERATIONAL STEP · SEPARATE FROM STAGE ADVANCEMENT</span>
       <h2 className={css.cardTitle}>{issuedWorkOrder?.id?'Work Order issued':financial.authorised?'Issue Work Order to selected QA partner':'Awaiting verified opening payment'}</h2>
       <p className={css.cardDescription}>{issuedWorkOrder?.id?
         'The governed Work Order is already issued. The Execution Partner must still formally accept it before engineering work can commence.':
         'The accepted quotation, paid opening advance and approved project scope support a governed Work Order. Issuing it creates the partner assignment and secure invitation; it does not complete mobilisation or begin work.'}</p>
       {issuedWorkOrder?.id?<p className={css.meta} style={{marginTop:14}}>Reference: <strong>{issuedWorkOrder.reference}</strong></p>:null}
       {workOrderCanIssue?<form action={retryGovernedWorkOrderAction} style={{marginTop:18}}>
         <input type="hidden" name="project_id" value={id}/>
         <button type="submit" className={css.action} style={{border:0,cursor:'pointer'}}>
           Issue Partner Work Order &amp; queue invitation →
         </button>
       </form>:null}
       {!issuedWorkOrder?.id&&!workOrderCanIssue?<p className={css.meta} role="status" style={{marginTop:16}}>
         {evidenceUnavailable?'The Work Order evidence could not be loaded; please check the detailed readiness page.':
         !financial.authorised?'A verified opening deposit is required.':
         'Only a QA workspace owner or administrator can issue the Work Order.'}
       </p>:null}
       <p className={css.meta} style={{marginTop:18}}>
         <Link className={css.secondaryLink} href={'/opos-next/projects/'+id+'/work-order'}>
           Open detailed Work Order readiness and partner acceptance →
         </Link>
       </p>
     </div>
   </section>:null}
   <section id="project-controls" className={css.section} aria-label="Governed project controls">
     <div className={css.sectionHeading}><h2>Project stage controls</h2></div>
     {feedback.error?<p role="alert" className={css.empty}>Action blocked: {String(feedback.error).slice(0,450)}</p>:null}
     {feedback.updated||feedback.advanced?<p role="status" className={css.empty}>{String(feedback.updated||'Project stage updated to '+feedback.advanced).slice(0,450)}</p>:null}
     <div className={css.card}>
       <span className={css.overline}>CURRENT RELEASE GATE</span><h2 className={css.cardTitle}>{meta.label}</h2>
       <p className={css.cardDescription}>{meta.completion}</p>
       {waitingForPartnerStart?<p className={css.meta} style={{marginTop:16}}>OP mobilisation is complete and the Work Order accepted. The partner must use their existing secure Partner Portal to confirm start. OPOS moves to In Progress only after that declaration is recorded.</p>:null}
       {blockedReasons.length?<div style={{marginTop:20}}><strong>Evidence required for the next stage</strong><ul style={{marginTop:10,paddingLeft:20,color:'#b8bac0'}}>{blockedReasons.map((reason,index)=><li key={index} style={{marginBottom:8}}>{reason}</li>)}</ul></div>:<p className={css.meta} style={{marginTop:18}}>Stage-readiness service reports no outstanding reasons.</p>}
       {stage==='internal_review'?<section aria-label="Internal technical QA evidence" style={{display:'grid',gap:15,marginTop:24,padding:18,border:'1px solid #383b42',borderRadius:12}}>
         <h3 style={{fontSize:17,margin:0}}>Internal technical QA · R01</h3>
         <p className={css.meta}>Review the actual current-cycle Partner delivery and its files before signing or approving either controlled document. Moving into Internal Review did not inspect or approve the engineering work.</p>
         {internalQaEvidenceUnavailable?<p role="alert">Internal QA document or file evidence could not be loaded. Do not approve until it is available.</p>:null}
         <div>
           <strong>Submitted engineering files</strong>
           {internalQaFiles.length?<ul style={{paddingLeft:20,marginTop:10}}>{internalQaFiles.map(file=><li key={file.id} style={{marginBottom:10}}>
             <Link className={css.secondaryLink} target="_blank" rel="noreferrer" href={'/opos-next/projects/'+id+'/delivery/'+file.id}>Inspect {file.original_filename||'submitted attachment'} ↗</Link>
             <span className={css.meta}> · {Math.ceil(Number(file.size_bytes||0)/1024)} KB</span>
           </li>)}</ul>:<p className={css.meta}>No files are available for the current submission. Technical approval must stay blocked.</p>}
         </div>
         <div>
           <strong>Two controlled review documents</strong>
           <ol style={{paddingLeft:20,marginTop:10}}>{([
             {slug:'technical-review',label:'Technical Review · inspect scope, drawings, revisions and risks'},
             {slug:'document-register',label:'Document Register · verify filenames, revision and traceability'},
           ] as const).map(item=>{
             const record=internalQaDocuments.find(row=>row.document_type===item.slug);
             return <li key={item.slug} style={{marginBottom:12}}>
               {record?<><Link className={css.secondaryLink} href={'/opos-next/documents/'+record.id}>{item.label} ↗</Link><span className={css.meta}> · {record.reference} · {String(record.status).replaceAll('_',' ')}</span></>
                 :<span className={css.meta}>{item.label} — no controlled record; approval is not available</span>}
             </li>;
           })}</ol>
         </div>
         <p className={css.meta}>For each document: review evidence → submit for review → electronically sign with your actual reviewer authority → separately approve as authorised owner/admin. Only then will the release-stage button unlock. No automatic engineering approval is granted.</p>
       </section>:null}
       {!qaWritable?<p className={css.meta} style={{marginTop:18}}>Transactional controls are locked until the isolated QA commercial-write gate is verified. This page retains the current governed controls while testing is isolated.</p>:null}
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
       {stage==='mobilisation'&&!mayAdvance?<p className={css.meta} style={{marginTop:16}}>Stage advancement is intentionally separate from Work Order issuance. It becomes available only after the approved project Statement of Work, partner assignment and remaining mobilisation evidence are complete.</p>:null}
       {!completed&&stageHasStandardAction&&canWrite?<form action={advanceProjectStageAction} style={{display:'grid',gap:14,maxWidth:600,marginTop:25}}>
         <input type="hidden" name="opos_next" value="1"/><input type="hidden" name="project_id" value={id}/>
         <input type="hidden" name="target_stage" value={meta.next||''}/>
         <label style={{display:'grid',gap:7}}>Decision note (optional)<textarea name="note" rows={3} style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/></label>
         <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button type="submit" disabled={!mayAdvance} className={css.action} style={{border:0,cursor:mayAdvance?'pointer':'not-allowed',opacity:mayAdvance?1:.45,marginTop:0}}>{stage==='mobilisation'?'Complete mobilisation & advance':meta.action} →</button>
         {stage==='internal_review'?<button type="submit" name="target_stage" value="partner_correction" className={css.action} style={{border:0,cursor:'pointer',marginTop:0}}>Request partner correction →</button>:null}</div>
       </form>:null}
       {stage==='ready_for_client_issue'?<section style={{marginTop:24}}>
         <h3 style={{fontSize:17,marginBottom:8}}>Client Review Package · secure preview required</h3>
         <p className={css.meta}>This stage is deliberately blocked in Workspace 2.0 until a secure, watermarked, view-only browser review is implemented. An unprotected PDF attachment would allow downloading the review package and does not meet the agreed release policy. Native/editable files remain reserved for final verified payment and owner approval.</p>
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
   <section className={css.section} aria-label="Execution partner and delivery evidence">
     <div className={css.sectionHeading}><h2>Execution partner &amp; QA evidence</h2></div>
     <div className={css.card}>
       <span className={css.overline}>CONTROLLED DELIVERY POSITION</span>
       <p className={css.meta} style={{marginTop:12}}>Work Order is issued only to the commercially selected, NDA-ready Execution Partner against the current approved Statement of Work. Formal acceptance precedes commencement.</p>
       <Link className={css.secondaryLink} href={'/opos-next/projects/'+id+'/work-order'}>Review Work Order readiness and acceptance →</Link>
       {evidenceUnavailable?<p role="alert" className={css.meta}>Some delivery evidence could not be retrieved. Treat missing information as unverified, not as an approval.</p>:null}
       <dl className={css.detailFacts}>
         <div><dt>Execution Partner position</dt><dd>{assignmentDisplay}</dd></div>
         <div><dt>Formal Work Order acceptance</dt><dd>{workOrderAccepted?'Recorded':'Not recorded'}</dd></div>
         <div><dt>Secure Partner Portal</dt><dd>{partnerSession?String(partnerSession.status||'Status not recorded').replaceAll('_',' '):'No invitation recorded'}</dd></div>
         <div><dt>Engineering submissions</dt><dd>{submissions.length}{submissions.length===5?' (latest five)':''}</dd></div>
         <div><dt>Client review package</dt><dd>{transmittal?'Issued '+date(transmittal.issued_at):'Not issued'}</dd></div>
       </dl>
       {assignment?<p className={css.meta} style={{marginTop:18}}>Partner: {assignment.partner_contact_name||'Contact not recorded'} · Work Order reference: {assignment.release_reference||'Not recorded'} · Released: {date(assignment.released_at)} · Execution cycle: {assignment.execution_cycle||1}</p>:null}
       {partnerSession?<p className={css.meta} style={{marginTop:10}}>Partner session first opened: {date(partnerSession.first_opened_at)} · Expires: {date(partnerSession.expires_at)}. This is session evidence, not proof of Work Order acceptance.</p>:null}
       {workOrderAcceptance?.accepted_at?<p className={css.meta} style={{marginTop:10}}>Formal acceptance: {workOrderAcceptance.accepted_by_name} ({workOrderAcceptance.accepted_by_role}), {date(workOrderAcceptance.accepted_at)}.</p>:null}
       {submissions.length?<div style={{marginTop:22}}><h3 style={{fontSize:16,marginBottom:12}}>Latest engineering submissions</h3>
         <ul style={{paddingLeft:20}}>{submissions.map(item=><li key={item.id} style={{marginBottom:10}}>
           <strong>Revision {item.revision||'Unspecified'}</strong> · {String(item.review_status||'Review pending').replaceAll('_',' ')} · {date(item.submitted_at)}
           {item.delivery_summary?<p className={css.meta}>{item.delivery_summary}</p>:null}
         </li>)}</ul>
       </div>:<p className={css.meta} style={{marginTop:20}}>No partner engineering submission is recorded. Technical QA cannot be presumed complete.</p>}
       {deliveryItems.length?<div style={{marginTop:22}}><h3 style={{fontSize:16,marginBottom:12}}>Delivery item checkpoints</h3>
         <ul style={{paddingLeft:20}}>{deliveryItems.map(item=><li key={item.id} style={{marginBottom:10}}>
           <strong>{item.title}</strong> · {String(item.status||'Pending').replaceAll('_',' ')}
           <span className={css.meta}> · Internal QA: {String(item.internal_review_status||'Not recorded').replaceAll('_',' ')} · Client: {String(item.client_review_status||'Not recorded').replaceAll('_',' ')}</span>
         </li>)}</ul>
       </div>:null}
       {transmittal?<p className={css.meta} style={{marginTop:20}}>Last client transmittal: {transmittal.transmittal_reference||'Reference not recorded'} · {date(transmittal.issued_at)} · {transmittal.recipient_name||'Recipient not recorded'}.</p>:null}
       <p className={css.meta} style={{marginTop:22}}>This panel displays existing evidence only. Partner acceptance, technical QA approval, client review and settlement remain separate governed decisions; this screen does not issue or download controlled files.</p>
     </div>
   </section>
 </>;
}
