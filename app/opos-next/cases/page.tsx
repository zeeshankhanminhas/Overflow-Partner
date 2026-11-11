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
  const [projects,quotes,issues]=await Promise.all([
    ids.length?supabase.from('projects').select('lead_id').eq('organisation_id',organisationId).in('lead_id',ids):Promise.resolve({data:[],error:null}),
    ids.length?supabase.from('quotes').select('id,lead_id,revision,status').eq('organisation_id',organisationId).in('lead_id',ids):Promise.resolve({data:[],error:null}),
    ids.length?supabase.from('quote_issue_records').select('lead_id,quote_id,quote_revision,client_response').eq('organisation_id',organisationId).in('lead_id',ids).eq('client_response','accepted'):Promise.resolve({data:[],error:null}),
  ]);
  if(projects.error||quotes.error||issues.error)throw new Error('Could not verify Case 360 ownership and commercial commitments.');
  const projectOwned=new Set((projects.data||[]).map(p=>p.lead_id));
  const accepted=new Set((issues.data||[]).filter(issue=>(quotes.data||[]).some(quote=>
    quote.id===issue.quote_id&&quote.lead_id===issue.lead_id&&Number(quote.revision)===Number(issue.quote_revision)&&quote.status==='issued'
  )).map(issue=>issue.lead_id));
  const rows:OperatorRow[]=cases.filter(item=>!projectOwned.has(item.id)).map(item=>{
    const presentation=resolveCaseQueuePresentation(item.workflow_stage);
    const clientAccepted=accepted.has(item.id);
    return {id:item.id,title:item.title||item.company_name,subtitle:item.company_name,
      state:clientAccepted?'Quotation accepted':presentation.state,
      next:clientAccepted?'Awaiting contractual advance verification':presentation.nextAction.label,
      href:'/opos-next/cases/'+item.id};
  });
  return <section>
    <OperatorPageIntro eyebrow="WORK / CASES" title="Cases" subtitle="Governed technical and commercial work before verified project mobilisation." count={rows.length}/>
    <OperatorRegister rows={rows} heading="Case register" empty="No active Cases are waiting in this view."/>
  </section>;
}
