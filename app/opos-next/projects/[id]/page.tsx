import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {resolveFinancialGate} from '@/lib/finance/state';
import {normaliseProjectStage,projectStageMeta} from '@/lib/projects/stages';
import {updateProjectMobilisationAction,advanceProjectStageAction} from '@/app/workspace/projects/[id]/actions';
import {approveFinalEngineeringReleaseAction} from '@/app/workspace/projects/[id]/final-release-action';
import WorkRecordV2 from '../../WorkRecordV2';
import {retryGovernedWorkOrderAction} from './work-order/action';
import {recordEngineeringDecisionAction,verifyDeliveryManifestAction,authoriseClientReviewReleaseAction,issueProtectedClientReviewAction,reconcileProtectedClientReviewAction} from './qa-actions';
import css from '../../opos.module.css';
import {operatorProjectNextStep} from '@/lib/presentation/threePortalNextAction';
import {inviteNorthfieldClientQaAction} from './qa-client-invite-action';

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

 // Read the canonical, submission-specific QA state. Old document draft/approval
 // statuses remain historical document records and are not engineering decisions.
 type QaFile={id:string;filename:string;size:number};
 type QaGate={submission_id:string|null;revision:string|null;execution_cycle:number|null;files:QaFile[];
   file_count:number;storage_complete:boolean;manifest_hash:string;
   engineering_accepted:boolean;manifest_verified:boolean;release_authorised:boolean};
 const qaGateResult=['internal_review','ready_for_client_issue'].includes(stage)
   ? await supabase.rpc('op_qa_delivery_gate',{p_project_id:id}) : null;
 const qaGate=(qaGateResult?.data||null) as QaGate|null;
 const internalQaEvidenceUnavailable=['internal_review','ready_for_client_issue'].includes(stage)
   &&(Boolean(qaGateResult?.error)||!qaGate);
 type StaffReview={issued:boolean;issueId:string|null;revision:string|null;decisionId:string|null;decision:string|null;
  decisionComments:string|null;decidedAt:string|null;clientAttestationPending:boolean;opReconciliationRequired:boolean};
 const staffReviewResult=['ready_for_client_issue','issued_to_client','client_review'].includes(stage)
   ?await supabase.rpc('op_qa_staff_client_review_state',{p_project_id:id}):null;
 const staffReview=(!staffReviewResult?.error?staffReviewResult?.data:null) as StaffReview|null;
 const staffReviewEvidenceUnavailable=Boolean(staffReviewResult?.error)||
   (['issued_to_client','client_review'].includes(stage)&&!staffReview);
 type QaRecipient={ready:boolean;activeRecipients:number;staffIdentityConflict:boolean;
  verifiedRecipients:number;setupRequired:boolean};
 const recipientResult=isKnownIsolatedQaBackend()&&
  stage==='ready_for_client_issue'&&['owner','admin'].includes(String(profile.role))?
   await supabase.rpc('op_qa_northfield_client_recipient_state',{p_project_id:id}):null;
 const qaRecipient=(recipientResult&&!recipientResult.error&&recipientResult.data?
  recipientResult.data:null) as QaRecipient|null;
 const clientInvitePending=Boolean(qaRecipient&&qaRecipient.activeRecipients===1&&
   !qaRecipient.staffIdentityConflict&&qaRecipient.verifiedRecipients===0);

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
 // QA-only display routing: database gates are still authoritative.
 const role=String(profile.role||'');
 const operatorNext=operatorProjectNextStep({
   stage,completed,canWrite,
   canReviewEngineering:['owner','admin','engineering'].includes(role),
   canVerifyManifest:['owner','admin','operator','engineering'].includes(role),
   canAuthoriseRelease:['owner','admin'].includes(role),
   needsWorkOrder,workOrderCanIssue,workOrderAccepted,waitingForEngineering,
   qaAvailable:!internalQaEvidenceUnavailable,
   hasSubmission:Boolean(qaGate?.submission_id&&Number(qaGate.file_count)>0),
   storageComplete:Boolean(qaGate?.storage_complete),
   engineeringAccepted:Boolean(qaGate?.engineering_accepted),
   manifestVerified:Boolean(qaGate?.manifest_verified),
   releaseAuthorised:Boolean(qaGate?.release_authorised),mayAdvance,
   canApproveFinalRelease:stage==='completion'&&Boolean(finalStatus?.clientAccepted&&finalStatus?.finalPaid&&!finalStatus?.ownerApproved)&&['owner','admin'].includes(role),
   canClose:stage==='completion'&&Boolean(finalStatus?.readyForManualClosure),
   canRecordClientOutcome:stage==='client_review'&&!latestClientReview&&Boolean(staffReview?.decisionId),
   partnerSubmitted:assignment?.execution_state==='delivery_submitted',
   // A client transmittal alone cannot prove protected browser review.
   protectedReviewIssued:Boolean(staffReview?.issued),
   clientAccepted:Boolean(finalStatus?.clientAccepted),
   finalPaid:Boolean(finalStatus?.finalPaid),
   finalReleaseApproved:Boolean(finalStatus?.ownerApproved),
   partnerPaid:Boolean(finalStatus?.partnerPaid),
 });
 // An independent Client login is a prerequisite, not an optional polish task.
 const displayNext=stage==='ready_for_client_issue'&&qaWritable&&
   ['owner','admin'].includes(String(profile.role))&&!qaRecipient?.ready
    ?{...operatorNext,
       title:clientInvitePending?'Await independent QA Client sign-in':'Invite a separate QA Client account',
       description:clientInvitePending
        ?'The Northfield Client recipient is invited but its email sign-in is not verified. Do not issue R01 until the account confirms access.'
        :'Northfield has no independently verified Client identity. Invite a separate QA email before releasing R01.',
       action:clientInvitePending?'View client setup status':'Set up independent Client access',
       anchor:'#release-authorisation',waiting:clientInvitePending}
    :operatorNext;
 return <>
   <WorkRecordV2 eyebrow={'WORK / PROJECT 360 / '+(data.project_number||id.slice(0,8))}
     title={data.title||data.project_number} subtitle={'Controlled engineering delivery · Target '+date(data.due_date)}
     state={meta.label} owner="Overflow Partner / assigned delivery team"
     nextTitle={displayNext.title}
     nextDescription={displayNext.description}
     stages={[{name:'Mobilisation',detail:'Advance and preparation'},{name:'Work Order',detail:workOrderAccepted?'Formally accepted':'Partner acceptance required'},{name:'Execution',detail:waitingForPartnerStart?'Await partner start':'Technical work and internal QA'},{name:'Delivery & Closeout',detail:'Client review and settlement'}]}
     stageIndex={stageIndex} waiting={displayNext.waiting}
     evidence={[{label:'Project reference',value:data.project_number||id.slice(0,8)},{label:'Current stage',value:meta.label},{label:'Delivery target',value:date(data.due_date)},{label:'Next transition',value:stage==='ready_for_client_issue'?'Protected client issue not recorded':readiness.ready?'Requirements satisfied':waitingForEngineering?'Awaiting engineering delivery':'Supporting evidence required'}]}
     facts={[{label:'Project status',value:String(data.status||'Not recorded').replaceAll('_',' ')},{label:'Created',value:date(data.created_at)},{label:'Financial authorisation',value:financial.displayState+' · '+financial.reason}]}
     governedHref={'/opos-next/projects/'+id+displayNext.anchor} previous="/opos-next/projects" actionLabel={displayNext.action||'Review controls'}/>
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
       {stage==='internal_review'?<section aria-label="Engineering acceptance and document control" style={{display:'grid',gap:18,marginTop:24,padding:18,border:'1px solid #383b42',borderRadius:12}}>
         <h3 style={{fontSize:19,margin:0}}>Engineering QA · {qaGate?.revision||'Current submission'}</h3>
         <p className={css.meta}>The partner submission must be inspected and technically accepted before its document manifest can be verified. These are two different decisions; neither requires approving a generic document template.</p>
         {internalQaEvidenceUnavailable?<p role="alert">Canonical QA evidence could not be loaded. No technical acceptance is permitted.</p>:null}
         {qaGate?<div style={{display:'grid',gap:8}}>
           <p className={css.meta}>Revision <strong>{qaGate.revision||'Not recorded'}</strong> · Execution cycle <strong>{qaGate.execution_cycle||'Unknown'}</strong> · {qaGate.file_count} submitted file(s)</p>
           <strong>1. Inspect actual engineering evidence</strong>
           {(qaGate.files||[]).map(file=><p key={file.id} className={css.meta}>
             <Link className={css.secondaryLink} target="_blank" rel="noreferrer" href={'/opos-next/projects/'+id+'/delivery/'+file.id}>Open {file.filename} ↗</Link>
             {' · '+Math.ceil(Number(file.size||0)/1024)+' KB'}
           </p>)}
           {!qaGate.storage_complete?<p role="alert">The current files are missing from private storage or their manifest is incomplete. Stop review.</p>:null}
           <p className={css.meta}>Evidence fingerprint: <code>{qaGate.manifest_hash}</code>. This fingerprint ties each decision to the exact submitted revision, files, sizes and storage paths.</p>
         </div>:null}
         <div style={{display:'grid',gap:12}}>
           <strong id="engineering-review" style={{scrollMarginTop:24}}>2. Engineering review and decision</strong>
           {qaGate?.engineering_accepted?<p role="status" className={css.meta}>Engineering accepted for this exact submission, with signed reviewer evidence recorded.</p>
             :qaWritable&&['owner','admin','engineering'].includes(String(profile.role))&&qaGate?.submission_id&&qaGate.storage_complete?
             <form action={recordEngineeringDecisionAction} style={{display:'grid',gap:12,maxWidth:650}}>
               <input type="hidden" name="project_id" value={id}/><input type="hidden" name="submission_id" value={qaGate.submission_id}/>
               <p className={css.meta}>Open the drawings first. Confirm each check only after actual inspection; corrections or rejection do not require all checks.</p>
               <fieldset className={css.qaChecklist}>
                 <legend className={css.qaChecklistLegend}>Engineering acceptance checks</legend>
                 {([
                   ['scope','Delivered work matches the approved scope and Statement of Work'],
                   ['completeness','All required outputs are present and legible'],
                   ['revision','Drawing identifiers, references and revisions are consistent'],
                   ['quality','Dimensions, interfaces and technical risks have been reviewed'],
                   ['exceptions','All exceptions, deviations and open issues are resolved'],
                 ] as const).map(([key,label])=><label key={key} className={css.qaChecklistRow}>
                   <input type="checkbox" name={key} value="true"/>
                   <span>{label}</span>
                 </label>)}
               </fieldset>
               <label style={{display:'grid',gap:6}}>Engineering findings and evidence (required)
                 <textarea required minLength={12} name="findings" rows={4} placeholder="Document findings, drawing references, exceptions and technical rationale." style={{background:'#151619',color:'#fff',padding:12,border:'1px solid #484b52',borderRadius:8}}/>
               </label>
               <label style={{display:'grid',gap:6}}>Decision
                 <select name="decision" required defaultValue="" style={{background:'#151619',color:'#fff',padding:12,border:'1px solid #484b52',borderRadius:8}}>
                   <option value="" disabled>Choose after inspecting evidence</option>
                   <option value="accepted">Accept engineering submission</option>
                   <option value="correction_required">Request partner correction (new revision required)</option>
                   <option value="rejected">Reject and return to partner</option>
                 </select>
               </label>
               <button className={css.action} style={{border:0}} type="submit">Record engineering decision →</button>
             </form>:<p className={css.meta}>Engineering decision pending or inaccessible to your current role.</p>}
         </div>
         <div style={{display:'grid',gap:12}}>
           <strong id="manifest-verification" style={{scrollMarginTop:24}}>3. Document-control verification</strong>
           {qaGate?.manifest_verified?<p role="status" className={css.meta}>Current revision and file manifest verified. No duplicate document-signature workflow is required.</p>
             :qaGate?.engineering_accepted&&qaWritable&&['owner','admin','operator','engineering'].includes(String(profile.role))?
             <form action={verifyDeliveryManifestAction} style={{display:'grid',gap:12,maxWidth:650}}>
               <input type="hidden" name="project_id" value={id}/>
               <p className={css.meta}>Check filenames, revision, document references, file identity, completeness and intended recipient against the accepted engineering submission.</p>
               <label className={css.qaChecklistRow}><input type="checkbox" required name="confirmed" value="true"/><span>I verified this exact current-cycle manifest against the accepted deliverables.</span></label>
               <button className={css.action} style={{border:0}} type="submit">Verify delivery document manifest →</button>
             </form>:<p className={css.meta}>Locked until the engineering submission has been accepted.</p>}
         </div>
         {qaGate?.engineering_accepted&&qaGate?.manifest_verified?<p role="status" className={css.meta}><strong>Ready for package preparation.</strong> Use the project-stage action below. This does not send files or authorise client access.</p>:null}
       </section>:null}
       {!qaWritable?<p className={css.meta} style={{marginTop:18}}>Transactional controls are locked until the isolated QA commercial-write gate is verified. This page retains the current governed controls while testing is isolated.</p>:null}
       {stage==='mobilisation'&&canWrite?<details id="mobilisation-controls" style={{marginTop:22,scrollMarginTop:24}} open={!data.project_manager_id||!data.start_date||!data.due_date}>
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
       {!completed&&stageHasStandardAction&&canWrite?<form id="stage-advance" action={advanceProjectStageAction} style={{display:'grid',gap:14,maxWidth:600,marginTop:25,scrollMarginTop:24}}>
         <input type="hidden" name="opos_next" value="1"/><input type="hidden" name="project_id" value={id}/>
         <input type="hidden" name="target_stage" value={meta.next||''}/>
         <label style={{display:'grid',gap:7}}>Decision note (optional)<textarea name="note" rows={3} style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/></label>
         <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button type="submit" disabled={!mayAdvance} className={css.action} style={{border:0,cursor:mayAdvance?'pointer':'not-allowed',opacity:mayAdvance?1:.45,marginTop:0}}>{stage==='mobilisation'?'Complete mobilisation & advance':meta.action} →</button>
</div>
       </form>:null}
       {stage==='ready_for_client_issue'?<section id="release-authorisation" style={{display:'grid',gap:12,marginTop:24}} aria-label="Client review release authority">
         <h3 style={{fontSize:17,marginBottom:8}}>Client Review Package · release authority</h3>
         <p className={css.meta}>Technical acceptance and manifest verification establish readiness. Owner release authorisation is a separate approval and does not send the package to a client.</p>
         {internalQaEvidenceUnavailable?<p role="alert">Release evidence unavailable; release remains blocked.</p>:null}
         {qaGate?.release_authorised?<div style={{display:'grid',gap:12}}>
             <p role="status">R01 preparation authorised. No client transmittal or external review access has been issued.</p>
             <Link className={css.action} href={'/opos-next/projects/'+id+'/review-preview'} style={{marginTop:4}}>Open watermarked QA review preview →</Link>
             {qaWritable&&['owner','admin'].includes(String(profile.role))&&
               (!qaRecipient?.ready&&!clientInvitePending)?
               <div style={{display:'grid',gap:13,maxWidth:650,marginTop:14,
                 padding:20,border:'1px solid #9b6861',borderRadius:8,background:'#211b1d'}}>
                <strong role="alert">QA client identity must be separated before issue</strong>
                <p className={css.meta}>Northfield currently has an OP staff login linked to the Client Workspace, or an unverified client recipient. That cannot establish independent acceptance. Invite a separate email account controlled by your QA client tester before issuing R01.</p>
                {recipientResult?.error?<p role="alert">Recipient verification failed; external release is blocked until it succeeds.</p>:null}
                <form action={inviteNorthfieldClientQaAction} style={{display:'grid',gap:12}}>
                 <input type="hidden" name="project_id" value={id}/>
                 <label style={{display:'grid',gap:7}}>Separate QA client email
                  <input type="email" name="email" required placeholder="your-separate-qa-client@example.com"
                   style={{padding:12,background:'#151619',color:'#fff',border:'1px solid #5d636a',borderRadius:8}}/>
                 </label>
                 <label className={css.qaChecklistRow}>
                  <input type="checkbox" name="confirm_separate_login" value="yes" required/>
                  <span>I control this separate QA inbox and authorise one test invitation. It must not be the OP operator's login.</span>
                 </label>
                 <button type="submit" className={css.action} style={{border:0,cursor:'pointer'}}>
                  Send separate QA Client Portal invitation →
                 </button>
                </form>
                <p className={css.meta}>After the invited account confirms its email, this screen will enable the actual controlled R01 issue. No invitation is sent until you submit the form.</p>
               </div>:null}
             {clientInvitePending?<div style={{display:'grid',gap:9,marginTop:12}}>
               <p role="status" className={css.meta}><strong>Invitation pending confirmation.</strong> The separate QA client is assigned, but must sign in through its own email link. Do not send duplicate invitations.</p>
               <Link className={css.action} href="/login?next=%2Fportal%2Fclient">Open separate QA Client sign-in →</Link>
             </div>:null}
             {qaRecipient?.ready?<p role="status" className={css.meta}>Verified: one independent, email-confirmed QA Client recipient is linked to Northfield.</p>:null}
             {qaWritable&&['owner','admin'].includes(String(profile.role))&&!staffReviewEvidenceUnavailable&&!staffReview?.issued&&qaRecipient?.ready?
               <form action={issueProtectedClientReviewAction} style={{display:'grid',gap:12,maxWidth:650,marginTop:14,
                padding:18,border:'1px solid #454951',borderRadius:8}}>
                 <strong>Issue R01 to the verified Client Portal account</strong>
                 <p className={css.meta}>The server checks the project's true company and exactly one active, authenticated Client Workspace recipient. This is an in-app issue; no email is sent.</p>
                 <input type="hidden" name="project_id" value={id}/>
                 <label className={css.qaChecklistRow}>
                  <input type="checkbox" name="preview_confirmed" value="yes" required/>
                  <span>I inspected the watermarked R01 review PDF and confirmed it matches the current accepted engineering submission.</span>
                 </label>
                 <label style={{display:'grid',gap:7}}>Release and programme rationale
                  <textarea name="note" required minLength={18} rows={3}
                   placeholder="Confirm the approved revision, recipient authority and mitigation of the recorded delivery forecast variance."
                   style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/>
                 </label>
                 <button type="submit" className={css.action} style={{border:0,cursor:'pointer'}}>
                  Issue protected R01 review in Client Portal →
                 </button>
               </form>:null}
           </div>
           :qaGate?.engineering_accepted&&qaGate?.manifest_verified&&qaWritable&&['owner','admin'].includes(String(profile.role))?
           <form action={authoriseClientReviewReleaseAction} style={{display:'grid',gap:12,maxWidth:650}}>
             <input type="hidden" name="project_id" value={id}/>
             <label style={{display:'grid',gap:6}}>Release decision rationale
               <textarea name="note" rows={3} minLength={12} required placeholder="State the basis for authorising this exact revision for client review." style={{background:'#151619',color:'#fff',padding:12,border:'1px solid #484b52',borderRadius:8}}/>
             </label>
             <button className={css.action} style={{border:0}} type="submit">Authorise client-review preparation →</button>
           </form>:<p className={css.meta}>Release authority is pending engineering acceptance, manifest verification and owner/admin approval.</p>}
         <p className={css.meta}>This internal QA preview is not client issue. The separate Client Portal login, current engineering revision and recipient-specific permissions must be verified before authorised in-app release. Native files remain reserved for verified final payment and owner-approved final handover.</p>
       </section>:null}
       {stage==='client_review'?<section id="client-review-outcome" aria-label="Governed client review" style={{display:'grid',gap:13,marginTop:24}}>
          <h3 style={{fontSize:17}}>Authenticated client review decision</h3>
          {staffReviewEvidenceUnavailable?<p role="alert" className={css.meta}>Client issue/attestation evidence could not be verified; no client decision can be assumed.</p>:null}
          {staffReview?.issued?<p className={css.meta}>Current controlled R01 review was issued to a verified Client Workspace account. Only its actual signed-in client can respond; this operator cannot impersonate that client.</p>:null}
          {staffReview?.issued&&!staffReview?.decisionId?<p role="status" className={css.meta}>Awaiting the authorised client's review of the watermarked drawings and their explicit decision.</p>:null}
          {staffReview?.decisionId?<div className={css.card} style={{display:'grid',gap:11}}>
           <strong>Authenticated client outcome: {String(staffReview.decision||'').replaceAll('_',' ')}</strong>
           {staffReview.decisionComments?<p className={css.meta}>Written client feedback: {staffReview.decisionComments}</p>:null}
           {staffReview.opReconciliationRequired?<p className={css.meta}>OP must reconcile this externally attributable decision into the governed project record. No acceptance can be inferred without this source record.</p>:<p className={css.meta}>Current-cycle client outcome has been reconciled by OP.</p>}
           {staffReview.opReconciliationRequired&&canWrite?
             staffReview.decision==='accepted'||staffReview.decision==='accepted_with_comments'?
               <form action={reconcileProtectedClientReviewAction} style={{display:'grid',gap:12,marginTop:8}}>
                 <input type="hidden" name="project_id" value={id}/>
                 <button type="submit" className={css.action} style={{border:0,cursor:'pointer'}}>Reconcile verified client acceptance →</button>
               </form>:
               <p className={css.meta}>The client's correction/rejection is preserved. Partner rework is explicitly blocked until OP classifies the request as an included correction, partner defect or a separately authorised commercial variation.</p>
             :null}
          </div>:null}
          {latestClientReview?<p role="status" className={css.meta}>Governed current-cycle outcome: {String(latestClientReview.outcome).replaceAll('_',' ')}. Every subsequent transition is independently gated.</p>:null}
          {latestClientReview&&['accepted','accepted_with_comments'].includes(String(latestClientReview.outcome))&&mayAdvance&&canWrite?
           <form action={advanceProjectStageAction} style={{display:'grid',gap:12,maxWidth:600}}>
            <input type="hidden" name="opos_next" value="1"/>
            <input type="hidden" name="project_id" value={id}/>
            <input type="hidden" name="target_stage" value="completion"/>
            <label style={{display:'grid',gap:7}}>Transition note
             <textarea name="note" rows={3} required minLength={12}
              placeholder="Reference this current-cycle accepted review and the independent completion-readiness controls."
              style={{background:'#151619',color:'#f4f4f5',padding:12,border:'1px solid #484b52',borderRadius:8}}/>
            </label>
            <button type="submit" className={css.action} style={{border:0,cursor:'pointer'}}>Advance accepted review to completion →</button>
           </form>:null}
          {latestClientReview&&!mayAdvance&&Array.isArray(readiness.reasons)&&readiness.reasons.length?
           <p className={css.meta}>Further transition blocked: {readiness.reasons.join('; ')}</p>:null}
        </section>:null}
        {stage==='completion'?<section id="final-release" style={{marginTop:24}}>
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
         {finalStatus?.readyForManualClosure&&canWrite?<form id="project-closure" action={advanceProjectStageAction} style={{marginTop:22}}>
           <input type="hidden" name="opos_next" value="1"/><input type="hidden" name="project_id" value={id}/><input type="hidden" name="target_stage" value="closed"/>
           <button type="submit" className={css.action} style={{border:0,cursor:'pointer',marginTop:0}}>Close governed project →</button>
         </form>:null}
       </section>:null}
     </div>
     <div style={{display:'flex',gap:12,marginTop:20,flexWrap:'wrap'}}><Link className={css.secondaryLink} href="/opos-next/documents">Review document register ↗</Link><Link className={css.secondaryLink} href="/opos-next/finance">Review financial register ↗</Link></div>
   </section>
   <section id="partner-delivery-evidence" className={css.section} aria-label="Execution partner and delivery evidence" style={{scrollMarginTop:24}}>
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
