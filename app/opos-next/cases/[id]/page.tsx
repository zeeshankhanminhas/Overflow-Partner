import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {resolveCaseQueuePresentation} from '@/lib/presentation/queueState';
import WorkRecordV2 from '../../WorkRecordV2';

export default async function CasePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const {supabase,organisationId}=await requireUserContext();
  const [leadResult,queueResult]=await Promise.all([
    supabase.from('leads').select('id,title,company_name,status,reference,created_at')
      .eq('organisation_id',organisationId).eq('id',id).maybeSingle(),
    supabase.rpc('op_case_queue',{p_organisation_id:organisationId,p_view:'all',p_limit:200,p_offset:0}),
  ]);
  if(leadResult.error)throw new Error('Case record could not be loaded.');
  const lead=leadResult.data;if(!lead)notFound();
  const queueRecord=queueResult.error?null:(queueResult.data||[]).find((item:{id:string})=>item.id===id);
  const stage=String(queueRecord?.workflow_stage||'assessment');
  const view=resolveCaseQueuePresentation(stage);
  const normalised=stage.toLowerCase().replaceAll('_','-');
  const stageIndex=normalised.includes('project')?3:normalised.includes('commercial')||normalised.includes('quote')?2:normalised.includes('partner')?1:0;
  const waiting=view.nextAction.kind==='wait'&&!view.approval?.required;
  return <WorkRecordV2 eyebrow={'WORK / CASE 360 / '+(lead.reference||id.slice(0,8))}
    title={lead.title||lead.company_name}
    subtitle={lead.company_name+' · Controlled pre-project commercial record'}
    state={view.state} owner="Overflow Partner"
    nextTitle={view.nextAction.label}
    nextDescription={view.summary}
    stages={[
      {name:'Requirements',detail:'Governed scope'},
      {name:'Feasibility',detail:'Partner technical assessment'},
      {name:'Commercial offer',detail:'Price and quote decisions'},
      {name:'Commitment',detail:'Client decision and advance'},
    ]}
    stageIndex={stageIndex} waiting={waiting}
    evidence={[
      {label:'Case record',value:lead.reference||id.slice(0,8)},
      {label:'Governed workflow position',value:queueResult.error?'Unavailable — verify in controlled record':view.state},
    ]}
    facts={[
      {label:'Company',value:lead.company_name},
      {label:'Record status',value:String(lead.status||'Not recorded').replaceAll('_',' ')},
      {label:'Current stage',value:stage.replaceAll('_',' ')},
    ]}
    governedHref={'/workspace/leads/'+id}
    previous="/opos-next/cases"/>;
}
