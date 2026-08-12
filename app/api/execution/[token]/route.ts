import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { executionSessionIdFromToken } from '@/lib/execution/sessionToken';

const commencementSchema=z.object({action:z.literal('commencement'),execution_lead_name:z.string().trim().min(2).max(200),execution_lead_role:z.string().trim().max(200).optional().default(''),planned_commencement_date:z.string().trim().min(8),forecast_delivery_date:z.string().trim().min(8),scope_reviewed:z.literal(true),inputs_received:z.literal(true),capacity_confirmed:z.literal(true),no_unresolved_blocker:z.literal(true),assumptions:z.string().trim().max(5000).optional().default(''),declaration_checked:z.literal(true),submitted_by_name:z.string().trim().min(2).max(200),submitted_by_role:z.string().trim().max(200).optional().default('')});
const progressSchema=z.object({action:z.literal('progress'),progress_state:z.enum(['on_track','at_risk','blocked']),percent_complete:z.union([z.coerce.number().min(0).max(100),z.literal('')]).optional(),work_completed:z.string().trim().min(2).max(10000),work_in_progress:z.string().trim().min(2).max(10000),forecast_delivery_date:z.string().trim().optional().default(''),next_update_date:z.string().trim().optional().default(''),notes:z.string().trim().max(5000).optional().default(''),submitted_by_name:z.string().trim().min(2).max(200),submitted_by_role:z.string().trim().max(200).optional().default('')});
const exceptionSchema=z.object({action:z.literal('exception'),severity:z.enum(['low','medium','high','critical']),title:z.string().trim().min(2).max(300),description:z.string().trim().min(2).max(10000),delivery_impact:z.string().trim().max(5000).optional().default(''),required_from:z.enum(['overflow_partner','client','partner','unknown']).default('overflow_partner'),submitted_by_name:z.string().trim().min(2).max(200),submitted_by_role:z.string().trim().max(200).optional().default('')});
const deliverySchema=z.object({action:z.literal('delivery'),revision:z.string().trim().max(100).optional().default(''),delivery_summary:z.string().trim().min(2).max(10000),deliverables_manifest:z.string().trim().min(2).max(15000),declaration_checked:z.literal(true),submitted_by_name:z.string().trim().min(2).max(200),submitted_by_role:z.string().trim().max(200).optional().default('')});
const submissionSchema=z.discriminatedUnion('action',[commencementSchema,progressSchema,exceptionSchema,deliverySchema]);

function admin(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error('Supabase server credentials are not configured.');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
function refreshProject(projectId:string){revalidatePath(`/workspace/projects/${projectId}`);revalidatePath(`/workspace/projects/${projectId}/execution`);revalidatePath(`/workspace/projects/${projectId}/delivery`);revalidatePath('/workspace/projects');}

async function loadSession(token:string){
  const supabase=admin();
  const signedSessionId=executionSessionIdFromToken(token);
  const sessionQuery=supabase.from('partner_execution_sessions').select('*');
  const{data:session,error}=signedSessionId
    ? await sessionQuery.eq('id',signedSessionId).maybeSingle()
    : await sessionQuery.eq('token_hash',hashToken(token)).maybeSingle();
  if(error||!session)return{supabase,session:null,assignment:null};
  if(new Date(session.expires_at).getTime()<Date.now()&&!['expired','revoked'].includes(session.status)){await supabase.from('partner_execution_sessions').update({status:'expired'}).eq('id',session.id);return{supabase,session:null,assignment:null};}
  if(['expired','revoked'].includes(session.status))return{supabase,session:null,assignment:null};
  const{data:assignment,error:assignmentError}=await supabase.from('project_execution_assignments').select('*').eq('id',session.assignment_id).eq('project_id',session.project_id).maybeSingle();
  if(assignmentError||!assignment||['closed','cancelled'].includes(assignment.execution_state))return{supabase,session:null,assignment:null};return{supabase,session,assignment};
}
async function audit(supabase:any,assignment:any,eventType:string,eventData:Record<string,unknown>){await supabase.from('activity_events').insert({organisation_id:assignment.organisation_id,entity_type:'project',entity_id:assignment.project_id,user_id:null,event_type:eventType,event_data:{...eventData,assignmentId:assignment.id,partnerId:assignment.partner_id,source:'execution_partner',partnerReported:true}});}

export async function GET(_:Request,context:{params:Promise<{token:string}>}){
  try{
    const{token}=await context.params;const{supabase,session,assignment}=await loadSession(token);if(!session||!assignment)return NextResponse.json({message:'This Partner Execution link is invalid, expired or revoked.'},{status:404});
    const now=new Date().toISOString();const firstOpen=!session.first_opened_at;await supabase.from('partner_execution_sessions').update({status:session.status==='invited'?'opened':session.status,first_opened_at:session.first_opened_at||now,last_opened_at:now}).eq('id',session.id);if(firstOpen)await audit(supabase,assignment,'partner_execution.workspace_opened',{sessionId:session.id,recipientEmail:session.recipient_email});
    const[projectResult,partnerResult,scopeResult,commencementResult,progressResult,exceptionsResult,submissionsResult]=await Promise.all([
      supabase.from('projects').select('id,project_number,title,start_date,due_date,project_stage').eq('id',assignment.project_id).single(),
      supabase.from('partners').select('id,company_name,contact_name').eq('id',assignment.partner_id).single(),
      assignment.scope_document_id?supabase.from('documents').select('id,title,reference,status,revision_code,issue_purpose').eq('id',assignment.scope_document_id).maybeSingle():Promise.resolve({data:null,error:null}),
      supabase.from('partner_commencement_declarations').select('*').eq('assignment_id',assignment.id).maybeSingle(),
      supabase.from('partner_progress_updates').select('id,progress_state,percent_complete,work_completed,work_in_progress,forecast_delivery_date,next_update_date,notes,submitted_by_name,submitted_by_role,submitted_at').eq('assignment_id',assignment.id).order('submitted_at',{ascending:false}).limit(20),
      supabase.from('partner_execution_exceptions').select('id,severity,title,description,delivery_impact,required_from,status,raised_at,resolved_at,resolution_note').eq('assignment_id',assignment.id).order('raised_at',{ascending:false}).limit(20),
      supabase.from('partner_delivery_submissions').select('id,execution_cycle,revision,delivery_summary,deliverables_manifest,submitted_by_name,submitted_by_role,submitted_at,review_status').eq('assignment_id',assignment.id).order('submitted_at',{ascending:false}).limit(20),
    ]);
    for(const result of [projectResult,partnerResult,scopeResult,commencementResult,progressResult,exceptionsResult,submissionsResult])if(result.error)throw result.error;
    return NextResponse.json({execution:{assignment_id:assignment.id,execution_state:assignment.execution_state,execution_cycle:assignment.execution_cycle||1,release_reference:assignment.release_reference,planned_start_date:assignment.planned_start_date,committed_due_date:assignment.committed_due_date,reporting_cadence:assignment.reporting_cadence,release_notes:assignment.release_notes,released_at:assignment.released_at},project:projectResult.data,partner:partnerResult.data,controlled_scope:scopeResult.data,commencement:commencementResult.data,progress_updates:progressResult.data||[],exceptions:exceptionsResult.data||[],delivery_submissions:submissionsResult.data||[]});
  }catch(error){console.error('Partner execution load failed',error);return NextResponse.json({message:'Unable to load the Partner Execution workspace.'},{status:500});}
}

export async function POST(request:Request,context:{params:Promise<{token:string}>}){
  try{
    const{token}=await context.params;const payload=submissionSchema.parse(await request.json());const{supabase,session,assignment}=await loadSession(token);if(!session||!assignment)return NextResponse.json({message:'This Partner Execution link is invalid, expired or revoked.'},{status:404});
    const{data:project,error:projectError}=await supabase.from('projects').select('id,project_stage').eq('id',assignment.project_id).single();if(projectError||!project)throw projectError||new Error('Project not found.');

    if(payload.action==='commencement'){
      const{data:existing}=await supabase.from('partner_commencement_declarations').select('id').eq('assignment_id',assignment.id).maybeSingle();if(existing)return NextResponse.json({message:'A commencement declaration is already recorded for this execution assignment.'},{status:409});
      const{data,error}=await supabase.rpc('op_record_partner_commencement',{p_assignment_id:assignment.id,p_session_id:session.id,p_execution_lead_name:payload.execution_lead_name,p_execution_lead_role:payload.execution_lead_role||'',p_planned_commencement_date:payload.planned_commencement_date,p_forecast_delivery_date:payload.forecast_delivery_date,p_assumptions:payload.assumptions||'',p_submitted_by_name:payload.submitted_by_name,p_submitted_by_role:payload.submitted_by_role||''});if(error)throw error;
      refreshProject(assignment.project_id);
      return NextResponse.json({success:true,stage:data?.projectStage||'in_progress',message:'Commencement declaration recorded. Project 360 has moved to In progress.'});
    }

    if(payload.action==='progress'){
      const{data:commencement}=await supabase.from('partner_commencement_declarations').select('id').eq('assignment_id',assignment.id).maybeSingle();if(!commencement)return NextResponse.json({message:'Commencement must be declared before progress can be reported.'},{status:409});
      if(!['in_progress','partner_correction'].includes(String(project.project_stage)))return NextResponse.json({message:'Progress can be reported only during active execution or correction.'},{status:409});
      const{data,error}=await supabase.from('partner_progress_updates').insert({organisation_id:assignment.organisation_id,assignment_id:assignment.id,project_id:assignment.project_id,partner_id:assignment.partner_id,progress_state:payload.progress_state,percent_complete:payload.percent_complete===''||payload.percent_complete===undefined?null:payload.percent_complete,work_completed:payload.work_completed,work_in_progress:payload.work_in_progress,forecast_delivery_date:payload.forecast_delivery_date||null,next_update_date:payload.next_update_date||null,notes:payload.notes||null,submitted_by_name:payload.submitted_by_name,submitted_by_role:payload.submitted_by_role||null}).select('id,submitted_at').single();if(error)throw error;
      await supabase.from('project_execution_assignments').update({execution_state:payload.progress_state==='blocked'?'blocked':'executing'}).eq('id',assignment.id);await audit(supabase,assignment,'partner_execution.progress_reported',{updateId:data.id,submittedAt:data.submitted_at,progressState:payload.progress_state,percentComplete:payload.percent_complete===''?null:payload.percent_complete,forecastDeliveryDate:payload.forecast_delivery_date||null});refreshProject(assignment.project_id);return NextResponse.json({success:true,message:'Progress update recorded as Partner-reported execution evidence.'});
    }

    if(payload.action==='exception'){
      if(!['ready_for_execution','in_progress','partner_correction'].includes(String(project.project_stage)))return NextResponse.json({message:'Execution exceptions can be raised only while release, execution or correction is active.'},{status:409});
      const{data,error}=await supabase.from('partner_execution_exceptions').insert({organisation_id:assignment.organisation_id,assignment_id:assignment.id,project_id:assignment.project_id,partner_id:assignment.partner_id,severity:payload.severity,title:payload.title,description:payload.description,delivery_impact:payload.delivery_impact||null,required_from:payload.required_from,status:'open',submitted_by_name:payload.submitted_by_name,submitted_by_role:payload.submitted_by_role||null}).select('id,raised_at').single();if(error)throw error;
      await supabase.from('project_execution_assignments').update({execution_state:'blocked'}).eq('id',assignment.id);await audit(supabase,assignment,'partner_execution.exception_raised',{exceptionId:data.id,raisedAt:data.raised_at,severity:payload.severity,title:payload.title,requiredFrom:payload.required_from});refreshProject(assignment.project_id);return NextResponse.json({success:true,message:'Execution exception raised and surfaced to Overflow Partner.'});
    }

    const{data,error}=await supabase.rpc('op_record_partner_delivery_submission',{p_assignment_id:assignment.id,p_session_id:session.id,p_revision:payload.revision||'',p_delivery_summary:payload.delivery_summary,p_deliverables_manifest:payload.deliverables_manifest,p_submitted_by_name:payload.submitted_by_name,p_submitted_by_role:payload.submitted_by_role||''});if(error)throw error;
    refreshProject(assignment.project_id);
    return NextResponse.json({success:true,execution_cycle:data?.executionCycle||assignment.execution_cycle||1,file_count:data?.fileCount||0,message:`Engineering delivery submitted with ${data?.fileCount||0} attached output file${Number(data?.fileCount||0)===1?'':'s'} for Overflow Partner internal review.`});
  }catch(error){if(error instanceof z.ZodError)return NextResponse.json({message:error.issues[0]?.message||'Please check the execution update.'},{status:400});console.error('Partner execution submission failed',error);return NextResponse.json({message:error instanceof Error?error.message:'Unable to record this Partner Execution update.'},{status:500});}
}
