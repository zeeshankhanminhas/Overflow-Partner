import type {SupabaseClient} from '@supabase/supabase-js';
import {ensureApprovedPartnerAssignment,releaseApprovedPartnerWorkOrder} from '@/lib/execution/autoWorkOrder';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';

export type WorkOrderHandoffResult={status:'queued'|'awaiting_evidence';reason?:string;assignmentId?:string};

/**
 * Called only AFTER the verified opening deposit has been reconciled AND
 * Project 360 committed. The partner and price are inherited from the frozen
 * commercial approval; OP never selects or re-approves the partner here.
 *
 * Missing governance evidence becomes a durable, visible blocker. The
 * client payment and Project 360 are not rolled back, fabricated or duplicated.
 */
export async function issueWorkOrderAfterVerifiedOpeningPayment(
  db:SupabaseClient,organisationId:string,projectId:string
):Promise<WorkOrderHandoffResult>{
  if(process.env.VERCEL_ENV==='preview'&&!isKnownIsolatedQaBackend())
    throw new Error('Automatic QA Work Order dispatch requires the isolated database.');

  const {data:project,error:projectError}=await db.from('projects')
    .select('id,organisation_id,created_by,project_stage,quote_id')
    .eq('id',projectId).eq('organisation_id',organisationId).maybeSingle();
  if(projectError||!project?.quote_id)throw new Error('Payment handoff project cannot be verified.');
  const {data:existing,error:existingError}=await db.from('project_work_order_handoffs')
    .select('status,attempts,assignment_id').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
  if(existingError)throw new Error('Existing Work Order handoff could not be checked.');
  // Stripe may replay the same signed payment months after work has begun.
  // A successfully issued, immutable Work Order must never be downgraded
  // just because its project has since advanced beyond Mobilisation.
  if(existing?.status==='queued'){
    const {data:priorOrder,error:priorOrderError}=await db.from('partner_work_orders')
      .select('id,assignment_id').eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
    if(priorOrderError)throw new Error('Previously issued Work Order could not be checked.');
    if(priorOrder?.id&&priorOrder.assignment_id===existing.assignment_id)
      return {status:'queued',assignmentId:existing.assignment_id};
  }

  let outcome:WorkOrderHandoffResult;
  let workOrderId:string|null=null;
  try{
    if(!['mobilisation','ready_for_execution'].includes(String(project.project_stage)))
      throw new Error('The Work Order must issue before engineering execution starts.');

    // Scope was approved during the technical/commercial assessment before the
    // client quote. The later project SOW is a distinct mobilisation document.
    const {data:scopes,error:scopeError}=await db.from('documents')
      .select('id,document_type,status,is_current_revision')
      .eq('organisation_id',organisationId).eq('project_id',projectId)
      .in('document_type',['scope-of-work','statement-of-work'])
      .in('status',['approved','issued','published']).eq('is_current_revision',true)
      .order('created_at',{ascending:false}).limit(12);
    if(scopeError)throw new Error('Approved technical scope could not be verified.');
    const approvedTech=(scopes||[]).filter(doc=>doc.document_type==='scope-of-work');
    const candidates=approvedTech.length?approvedTech:(scopes||[]).filter(doc=>doc.document_type==='statement-of-work');
    if(candidates.length!==1)throw new Error('Exactly one previously approved technical scope is required for automatic Work Order issuance.');

    const assignment=await ensureApprovedPartnerAssignment(
      db,organisationId,String(project.created_by),projectId,String(candidates[0].id)
    );
    const released=await releaseApprovedPartnerWorkOrder(db,organisationId,String(project.created_by),projectId);
    if(released.assignmentId!==assignment.id)
      throw new Error('Work Order release did not match the inherited approved assignment.');

    const {data:workOrder,error:workOrderError}=await db.from('partner_work_orders')
      .select('id').eq('organisation_id',organisationId).eq('project_id',projectId)
      .eq('assignment_id',assignment.id).maybeSingle();
    if(workOrderError||!workOrder?.id)throw new Error('Issued Work Order snapshot was not persisted.');
    workOrderId=workOrder.id;
    outcome={status:'queued',assignmentId:assignment.id};
  }catch(error){
    // Not "approved" and not "issued" is a valid outcome for incomplete
    // synthetic fixtures. Retrying after evidence completion is not a new
    // discretionary approval.
    const reason=error instanceof Error?error.message:'Work Order evidence is unavailable.';
    outcome={status:'awaiting_evidence',reason:reason.slice(0,350)};
  }
  const {error:stateError}=await db.from('project_work_order_handoffs').upsert({
    organisation_id:organisationId,project_id:projectId,status:outcome.status,
    assignment_id:outcome.assignmentId||null,work_order_id:workOrderId,
    last_blocker:outcome.reason||null,attempts:Number(existing?.attempts||0)+1,
    updated_at:new Date().toISOString()
  },{onConflict:'project_id'});
  if(stateError)throw new Error('Work Order outcome could not be committed; webhook must retry.');

  // Only one operational event for a new status. Replays are naturally
  // idempotent at partner_work_orders / assignment / session / outbox layers.
  if(existing?.status!==outcome.status){
    await db.from('activity_events').insert({
      organisation_id:organisationId,entity_type:'project',entity_id:projectId,
      user_id:null,event_type:outcome.status==='queued'?'partner_work_order.queued':'partner_work_order.awaiting_evidence',
      event_data:{source:'verified_opening_payment_handoff',assignmentId:outcome.assignmentId||null,
        requiresOperatorCorrection:outcome.status!=='queued',
        message:outcome.reason||null,emailDeliveryUnverified:true}
    });
  }
  return outcome;
}
