import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {resolveCaseQueuePresentation} from '@/lib/presentation/queueState';
import {OperatorRecord} from '../../OperatorViews';
export default async function CasePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('leads').select('id,title,company_name,status,workflow_stage,reference,created_at')
    .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(error)throw new Error('Case record could not be loaded.'); if(!data)notFound();
  const view=resolveCaseQueuePresentation(data.workflow_stage||'assessment');
  return <OperatorRecord eyebrow="WORK / CASE 360" title={data.title||data.company_name}
    position={view.state} description={view.summary}
    fields={[{label:'Company',value:data.company_name},{label:'Reference',value:data.reference||id.slice(0,8)},
      {label:'Stage',value:String(data.workflow_stage||'Not recorded').replaceAll('_',' ')},
      {label:'Business status',value:String(data.status||'Not recorded')}]}
    previous="/opos-next/cases" governedHref={'/workspace/leads/'+id}
    waiting={view.nextAction.kind==='wait'&&!view.approval?.required}/>;
}
