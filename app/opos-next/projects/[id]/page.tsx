import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import WorkRecordV2 from '../../WorkRecordV2';

const date=(iso:string|null)=>iso?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'Europe/London'}).format(new Date(iso)):'Not set';
export default async function ProjectPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('projects')
    .select('id,project_number,title,status,project_stage,due_date,created_at')
    .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(error)throw new Error('Project record could not be loaded.');
  if(!data)notFound();
  const stage=String(data.project_stage||'mobilisation').replaceAll('_',' ');
  const lower=stage.toLowerCase();
  const stageIndex=lower.includes('close')||lower.includes('settle')||lower.includes('quality')||lower.includes('deliver')||lower.includes('review')?3:
    lower.includes('execut')?2:lower.includes('order')?1:0;
  const completed=['closed','complete','completed','cancelled'].includes(String(data.status||'').toLowerCase());
  return <WorkRecordV2 eyebrow={'WORK / PROJECT 360 / '+(data.project_number||id.slice(0,8))}
    title={data.title||data.project_number}
    subtitle={'Controlled engineering delivery · Target '+date(data.due_date)}
    state={stage} owner="Overflow Partner / assigned delivery team"
    nextTitle={completed?'Project completion recorded':'Review current project position'}
    nextDescription={completed?'The project is recorded as completed. Inspect the governed closure evidence before further action.':
      'The live project stage is recorded below. Mobilisation, execution, QA, customer review and settlement require governed evidence. Open the controlled record for the precise permitted next decision.'}
    stages={[
      {name:'Mobilisation',detail:'Advance and preparation'},
      {name:'Work Order',detail:'Partner acceptance required'},
      {name:'Execution',detail:'Technical work and delivery'},
      {name:'QA & Delivery',detail:'Review, settlement and closure'},
    ]}
    stageIndex={stageIndex} waiting={completed}
    evidence={[
      {label:'Project reference',value:data.project_number||id.slice(0,8)},
      {label:'Current stage',value:stage},
      {label:'Delivery target',value:date(data.due_date)},
    ]}
    facts={[
      {label:'Project status',value:String(data.status||'Not recorded').replaceAll('_',' ')},
      {label:'Created',value:date(data.created_at)},
      {label:'Financial release',value:'Verify in the governed project controls'},
    ]}
    governedHref={'/workspace/projects/'+id}
    previous="/opos-next/projects"/>;
}
