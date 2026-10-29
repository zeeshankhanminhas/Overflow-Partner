import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {resolveCaseQueuePresentation} from '@/lib/presentation/queueState';
import {OperatorRecord} from '../../OperatorViews';
export default async function CasePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('leads').select('id,title,company_name,status,reference,created_at')
    .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(error)throw new Error('Case record could not be loaded.'); if(!data)notFound();
  const {data: queue, error: queueError} = await supabase.rpc('op_case_queue', {
    p_organisation_id: organisationId, p_view: 'all', p_limit: 200, p_offset: 0,
  });
  // The workflow stage is a derived queue fact, not a column on the lead master record.
  const stage = queueError ? null : (queue||[]).find((entry: {id:string}) => entry.id===id)?.workflow_stage || null;
  const view = stage ? resolveCaseQueuePresentation(stage) : null;
  return <OperatorRecord eyebrow="WORK / CASE 360" title={data.title||data.company_name}
    position={view?.state||'Case requires review'} description={view?.summary||'Open the governed Case 360 record for its current operational state.'}
    fields={[{label:'Company',value:data.company_name},{label:'Reference',value:data.reference||id.slice(0,8)},
      {label:'Stage',value:String(stage||'Unverified in preview').replaceAll('_',' ')},
      {label:'Business status',value:String(data.status||'Not recorded')}]}
    previous="/opos-next/cases" governedHref={'/workspace/leads/'+id}
    waiting={Boolean(view?.nextAction.kind==='wait'&&!view?.approval?.required)}/>;
}
