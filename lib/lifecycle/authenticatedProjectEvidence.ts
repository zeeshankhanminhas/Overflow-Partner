import 'server-only';
import {createClient as createPrivilegedClient} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {lifecycleGates,resolveCurrentAction,type GateKey,type GateEvidence,type WorkspaceActor} from './currentAction';
const stageName=(value:unknown)=>String(value||'');


/**
 * Read-only 28-gate evidence projection for an exact authenticated project.
 * This never grants action capability: the owning transaction service must
 * independently authorise it. Unmapped historic gates remain UNKNOWN, not true.
 *
 * Isolation: only the explicitly verified OPOS-QA backend may use the private
 * evidence reader while the production migrations and RLS audit are incomplete.
 */
export async function authenticatedProjectLifecycle(actor:WorkspaceActor,projectId:string){
 const db=await createClient();
 const identity=await db.auth.getUser();
 if(identity.error||!identity.data.user)return null;
 if(!/^[0-9a-f-]{36}$/i.test(projectId))return null;

 let organisationId:string|undefined;
 if(actor==='operator'){
  const {data,error}=await db.from('profiles').select('organisation_id,is_active')
   .eq('id',identity.data.user.id).maybeSingle();
  if(error||!data?.is_active||!data.organisation_id)return null;
  organisationId=data.organisation_id;
 }else{
  const {data,error}=await db.rpc('portal_my_projects',{p_kind:actor});
  const match=!error&&Array.isArray(data)?data.find(
   (p:{project_id:string;organisation_id:string;portal_kind:string})=>
    p.project_id===projectId&&p.portal_kind===actor):null;
  if(!match)return null;
  organisationId=match.organisation_id;
 }
 if(!organisationId)return null;
 const empty=Object.fromEntries(lifecycleGates.map(g=>[g.key,{state:'unknown'}])) as Record<GateKey,GateEvidence>;
 const unavailable=()=>({
  action:resolveCurrentAction({actor,phase:'mobilisation',evidence:empty,capabilities:{}}),
  evidence:empty,ready:false,known:0,total:lifecycleGates.length,
 });
 if(!isKnownIsolatedQaBackend())return unavailable();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return unavailable();
 const trusted=createPrivilegedClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 // Recheck exact project organisation before reading private records.
 const project=await trusted.from('projects')
  .select('id,organisation_id,project_stage,lead_id,quote_id')
  .eq('organisation_id',organisationId).eq('id',projectId).maybeSingle();
 if(project.error||!project.data)return null;
 const p=project.data;
 const evidence={...empty};
 const verified=(gate:GateKey,ok:boolean,available=true)=>{
  evidence[gate]={state:!available?'unknown':ok?'verified':'missing'};
 };
 const read=async(table:string,select:string,filters:Record<string,string|number|boolean|null>,
  order?:string)=>{
  let q=trusted.from(table).select(select).eq('organisation_id',organisationId!);
  for(const [key,val] of Object.entries(filters)){
   if(val===null)q=q.is(key,null);
   else q=q.eq(key,val);
  }
  if(order)q=q.order(order,{ascending:false});
  const result=await q.limit(1).maybeSingle();
  return {row:result.error?null:result.data as Record<string,unknown>|null,
   available:!result.error};
 };
 const check=(gate:GateKey,value:{row:Record<string,unknown>|null;available:boolean},predicate:(r:Record<string,unknown>)=>boolean)=>{
  verified(gate,Boolean(value.row&&predicate(value.row)),value.available);
 };
 // Existing project existence is an independent fact, not stage-derived.
 verified('project_created',true);
 const quote=p.quote_id?String(p.quote_id):'';
 const lead=p.lead_id?String(p.lead_id):'';
 if(lead){
  const [opportunity,intake,scope,terms]=await Promise.all([
   read('leads','id,status,prospect_id',{id:lead}),
   read('technical_intakes','id,submitted_at,reviewed_at,status',{lead_id:lead},'created_at'),
   read('documents','id,document_type,approved_at,is_current_revision',{lead_id:lead,document_type:'client-requirements',is_current_revision:true},'approved_at'),
   read('commercial_terms','id,authorised_at,authorisation_basis',{project_id:projectId}),
  ]);
  // Lead status alone does not prove formal qualification; preserve unknown.
  if(opportunity.row?.prospect_id){
   const feasibility=await read('prospect_technical_reviews',
    'id,approved_at,status,decision',{prospect_id:String(opportunity.row.prospect_id)},'approved_at');
   check('feasibility_approved',feasibility,r=>Boolean(r.approved_at&&['approved','feasible'].includes(String(r.decision))));
  }
  const request=await read('partner_review_requests','id,lead_id,prospect_id',{lead_id:lead},'created_at');
  if(request.row?.id){
   const decision=await read('partner_review_internal_decisions',
    'id,decision,approved_at',{partner_review_request_id:String(request.row.id)},'approved_at');
   check('partner_terms_approved',decision,r=>r.decision==='approved'&&Boolean(r.approved_at));
  }
  // A formally approved technical intake proves its own approval; a reviewed
  // but unapproved intake does not.
  check('requirements_approved',intake,r=>r.status==='approved'&&Boolean(r.reviewed_at));
  if(scope.row?.approved_at)verified('requirements_approved',true);
  // Commercial terms do not prove a historic mobilisation-stage approval.
  void terms;
 }
 if(quote){
  const [commercial,offer,accept,openingInvoice,openingReceipt]=await Promise.all([
   lead?read('commercial_reviews','id,status,approved_at',{lead_id:lead}):Promise.resolve({row:null,available:false}),
   read('quote_issue_records','id,issued_at',{quote_id:quote},'issued_at'),
   read('quote_acceptance_records','id,accepted_at',{quote_id:quote},'accepted_at'),
   read('invoices','id,issued_at,invoice_type',{quote_id:quote,invoice_type:'deposit'},'issued_at'),
   read('quote_payment_provider_confirmations','id,paid_at,livemode',{quote_id:quote},'paid_at'),
  ]);
  check('commercial_approved',commercial,r=>Boolean(r.approved_at));
  check('offer_issued',offer,r=>Boolean(r.issued_at));
  check('contract_accepted',accept,r=>Boolean(r.accepted_at));
  check('opening_invoice_issued',openingInvoice,r=>Boolean(r.issued_at));
  // This read is evidence of a provider confirmation only, not a live
  // release permission. Transaction handlers still verify full amount/mode.
  check('opening_payment_verified',openingReceipt,r=>Boolean(r.paid_at));
 }
 const assignment=await read('project_execution_assignments','id,execution_cycle,partner_id',{project_id:projectId},'created_at');
 const assignmentId=assignment.row?.id?String(assignment.row.id):'';
 const cycle=Number(assignment.row?.execution_cycle);
 if(assignment.available){
  if(!assignmentId){
   ['work_order_issued','work_order_accepted','commencement_confirmed',
    'delivery_submitted'].forEach(k=>verified(k as GateKey,false));
  }else if(Number.isInteger(cycle)&&cycle>0){
   const [order,acceptance,commencement,submission]=await Promise.all([
    read('partner_work_orders','id,issued_at,status,scope_revision_code',{project_id:projectId,assignment_id:assignmentId},'issued_at'),
    read('partner_work_order_acceptances','id,accepted_at,scope_revision_code',{project_id:projectId,assignment_id:assignmentId},'accepted_at'),
    read('partner_commencement_declarations','id,submitted_at',{project_id:projectId,assignment_id:assignmentId},'submitted_at'),
    read('partner_delivery_submissions','id,submitted_at,review_status,execution_cycle',{project_id:projectId,assignment_id:assignmentId,execution_cycle:cycle},'submitted_at'),
   ]);
   check('work_order_issued',order,r=>Boolean(r.issued_at));
   check('work_order_accepted',acceptance,r=>Boolean(r.accepted_at&&order.row?.issued_at&&r.scope_revision_code===order.row.scope_revision_code));
   check('commencement_confirmed',commencement,r=>Boolean(r.submitted_at));
   check('delivery_submitted',submission,r=>Boolean(r.submitted_at));
   if(submission.row?.id){
    const submissionId=String(submission.row.id);
    verified('engineering_approved',submission.row.review_status==='accepted',submission.available);
    const [manifest,clientIssue]=await Promise.all([
     read('op_qa_manifest_verifications','id,submission_id,verified_at',{project_id:projectId,submission_id:submissionId},'verified_at'),
     read('op_qa_client_review_issues','id,issued_at,submission_id,execution_cycle,transmittal_id',{project_id:projectId,submission_id:submissionId,execution_cycle:cycle},'issued_at'),
    ]);
    check('manifest_verified',manifest,r=>Boolean(r.verified_at));
    // Only the protected, recipient-bound current-cycle issue is evidence of
    // an externally actionable review, not merely a project stage/transmittal.
    check('client_review_issued',clientIssue,r=>Boolean(r.issued_at&&r.transmittal_id));
    if(clientIssue.row?.id){
     const [clientDecision,internalDecision]=await Promise.all([
      read('op_qa_client_review_decisions','id,outcome,decided_at,decided_by',{project_id:projectId,issue_id:String(clientIssue.row.id)},'decided_at'),
      read('project_client_reviews','id,outcome,recorded_at,execution_cycle',{project_id:projectId,execution_cycle:cycle},'recorded_at'),
     ]);
     verified('client_review_accepted',Boolean(
      clientDecision.available&&internalDecision.available&&
      clientDecision.row?.decided_at&&clientDecision.row?.decided_by&&
      internalDecision.row?.recorded_at&&
      ['accepted','accepted_with_comments'].includes(String(clientDecision.row?.outcome))&&
      clientDecision.row?.outcome===internalDecision.row?.outcome),
      clientDecision.available&&internalDecision.available);
    }

   }
  }
 }
 // A stage label alone is not historical gate evidence. Governed transitions
 // are recorded as immutable organisation-scoped activity events.
 const history=await trusted.from('activity_events').select('new_value,event_data')
  .eq('organisation_id',organisationId).eq('entity_type','project')
  .eq('entity_id',projectId).eq('event_type','project.stage_advanced')
  .order('created_at',{ascending:true}).limit(100);
 if(!history.error){
  const advanced=(to:string)=>(history.data||[]).some(event=>
   (event.new_value as {project_stage?:string}|null)?.project_stage===to&&
   (event.event_data as {canonicalLifecycle?:boolean}|null)?.canonicalLifecycle===true);
  verified('mobilisation_approved',advanced('ready_for_execution'));
  verified('closure_approved',stageName(p.project_stage)==='closed'&&advanced('closed'));
 }
 const [transmittal,finalInvoice,settlement,release,handover,payable]=await Promise.all([
  Number.isInteger(cycle)&&cycle>0?read('project_client_transmittals','id,issued_at,execution_cycle',{project_id:projectId,execution_cycle:cycle},'issued_at'):Promise.resolve({row:null,available:false}),
  read('invoices','id,issued_at,invoice_type',{project_id:projectId,invoice_type:'final'},'issued_at'),
  read('op_project_final_settlements','project_id,verified_at',{project_id:projectId}),
  read('op_project_final_release_approvals','project_id,approved_at,submission_id',{project_id:projectId}),
  read('documents','id,issued_at,approved_at,is_current_revision,status,storage_path',{project_id:projectId,document_type:'handover-pack',is_current_revision:true},'issued_at'),
  read('partner_payables','id,status,invoice_reference,evidence_confirmed,approved_at',{project_id:projectId},'approved_at'),
 ]);
 // Issued transmittal alone is insufficient proof of protected portal access.
 // Its gate remains unknown until generic recipient-scoped issuance is wired.
 void transmittal;
 check('final_invoice_issued',finalInvoice,r=>Boolean(r.issued_at));
 check('final_payment_verified',settlement,r=>Boolean(r.verified_at));
 check('owner_release_approved',release,r=>Boolean(r.approved_at&&r.submission_id));
 check('handover_issued',handover,r=>Boolean(r.issued_at&&r.approved_at&&r.storage_path&&r.is_current_revision&&['issued','published'].includes(String(r.status))));
 // Partner invoice and its matched transfer are independent evidence.
 check('partner_invoice_verified',payable,r=>Boolean(r.approved_at&&r.evidence_confirmed&&r.invoice_reference));
 if(payable.row?.id){
  const payment=await read('partner_payments','id,status,paid_at,payable_id,reference',
   {project_id:projectId,payable_id:String(payable.row.id)},'paid_at');
  check('partner_payment_verified',payment,r=>Boolean(r.paid_at&&r.status==='cleared'&&r.reference));
 }
 const stage=String(p.project_stage||'');
 const phase=stage==='closed'?'closure':stage==='completion'?'payment_settlement':
  ['client_review','issued_to_client','ready_for_client_issue'].includes(stage)?'delivery':
  stage==='internal_review'?'quality_assurance':
  ['in_progress','partner_correction','ready_for_execution'].includes(stage)?'execution':'mobilisation';
 const action=resolveCurrentAction({actor,phase,evidence,capabilities:{}});
 return {action,evidence,ready:true,
  known:Object.values(evidence).filter(e=>e.state!=='unknown').length,total:lifecycleGates.length};
}
