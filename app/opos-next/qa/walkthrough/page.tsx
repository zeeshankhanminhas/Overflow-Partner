import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import WalkthroughClient from './WalkthroughClient';

export const dynamic='force-dynamic';
export const metadata={title:'Three-portal end-to-end walkthrough | OPOS QA',robots:{index:false,follow:false}};
const northfieldId='b447f586-bf79-4839-be5e-1af607d9ca43';
type Gate={
 submission_id?:string|null;revision?:string|null;file_count?:number;
 storage_complete?:boolean;engineering_accepted?:boolean;
 manifest_verified?:boolean;release_authorised?:boolean;
};
type Readiness={ready?:boolean;reasons?:string[]};
export default async function GuidedWorkflowWalkthrough(){
 // The entire training surface is preview-only, and cannot be used as an
 // alternate execution/approval surface in production or other environments.
 if(!isKnownIsolatedQaBackend())notFound();
 const {supabase,organisationId}=await requireUserContext();
 const [project,readiness,gate]=await Promise.all([
  supabase.from('projects').select('id,project_number,title,project_stage').eq('organisation_id',organisationId).eq('id',northfieldId).maybeSingle(),
  supabase.rpc('op_project_stage_readiness',{p_project_id:northfieldId}),
  supabase.rpc('op_qa_delivery_gate',{p_project_id:northfieldId}),
 ]);
 const current=(project.data&&!project.error)?project.data:null;
 const safeReadiness=(!readiness.error?readiness.data:null) as Readiness|null;
 const safeGate=(!gate.error?gate.data:null) as Gate|null;
 const data={
  qa:true,
  projectId:current?.id||null,
  projectName:current?.title||'Northfield fictional QA example',
  projectNumber:current?.project_number||'Not linked',
  projectStage:current?.project_stage||'Unavailable',
  revision:safeGate?.revision||null,
  fileCount:Number(safeGate?.file_count||0),
  storageComplete:!!safeGate?.storage_complete,
  engineeringAccepted:!!safeGate?.engineering_accepted,
  manifestVerified:!!safeGate?.manifest_verified,
  releaseAuthorised:!!safeGate?.release_authorised,
  readinessReasons:Array.isArray(safeReadiness?.reasons)?safeReadiness.reasons:[],
  backendReadOk:!!current&&!readiness.error&&!gate.error,
 };
 return <WalkthroughClient live={data}/>;
}
