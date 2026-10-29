import { requireUserContext } from '@/lib/auth/context';
import { resolveCaseQueuePresentation } from '@/lib/presentation/queueState';
import { OperatorPageIntro, OperatorRegister, type OperatorRow } from '../OperatorViews';

type CaseRow = {id:string;title:string|null;company_name:string;contact_name:string|null;lead_status:string;workflow_stage:string};
export default async function CasesPage() {
  const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.rpc('op_case_queue',{p_organisation_id:organisationId,p_view:'all',p_limit:75,p_offset:0});
  if(error)throw new Error('Case register could not be loaded.');
  const cases=(data||[]) as CaseRow[];
  const ids=cases.map(item=>item.id);
  const projects=ids.length?await supabase.from('projects').select('lead_id').eq('organisation_id',organisationId).in('lead_id',ids):{data:[],error:null};
  if(projects.error)throw new Error('Could not verify Case 360 ownership.');
  const projectOwned=new Set((projects.data||[]).map(p=>p.lead_id));
  const rows:OperatorRow[]=cases.filter(item=>!projectOwned.has(item.id)).map(item=>{
    const presentation=resolveCaseQueuePresentation(item.workflow_stage);
    return {id:item.id,title:item.title||item.company_name,subtitle:item.company_name, state:presentation.state,
      next:presentation.nextAction.label,href:'/opos-next/cases/'+item.id};
  });
  return <section>
    <OperatorPageIntro eyebrow="WORK / CASES" title="Cases" subtitle="Governed technical and commercial work before verified project mobilisation." count={rows.length}/>
    <OperatorRegister rows={rows} heading="Case register" empty="No active Cases are waiting in this view."/>
  </section>;
}
