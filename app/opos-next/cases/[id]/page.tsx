import {notFound} from 'next/navigation';
import styles from './caseDocuments.module.css';
import {requireUserContext} from '@/lib/auth/context';
import {resolveCaseQueuePresentation} from '@/lib/presentation/queueState';
import WorkRecordV2 from '../../WorkRecordV2';
import {getWorkflowCase} from '@/lib/orchestration/service';
import {getCaseDocumentRequirements} from '@/lib/cases/documentRequirements';
import DocumentGenerationPanel from '@/components/workspace/documents/DocumentGenerationPanel';
import {approveIntakeAction} from '@/app/workspace/orchestration/actions';

export default async function CasePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const {supabase,organisationId}=await requireUserContext();
  const [leadResult,queueResult,documentsResult]=await Promise.all([
    supabase.from('leads').select('id,title,company_name,status,reference,created_at')
      .eq('organisation_id',organisationId).eq('id',id).maybeSingle(),
    supabase.rpc('op_case_queue',{p_organisation_id:organisationId,p_view:'all',p_limit:200,p_offset:0}),
    supabase.from('documents').select('id,title,document_type,status,reference').eq('organisation_id',organisationId).eq('lead_id',id).order('created_at',{ascending:false}),
  ]);
  if(leadResult.error)throw new Error('Case record could not be loaded.');
  const lead=leadResult.data;if(!lead)notFound();
  const queueRecord=queueResult.error?null:(queueResult.data||[]).find((item:{id:string})=>item.id===id);
  const documents=documentsResult.data||[];
  const workflow=await getWorkflowCase(supabase,organisationId,id);
  const {data:partnerReviews}=await supabase.from('partner_review_requests').select('id,status').eq('organisation_id',organisationId).eq('lead_id',id).limit(1);
  if(!workflow)notFound();
  const scopeApproved=workflow.technicalIntake?.status==='approved';
  const caseDocuments=getCaseDocumentRequirements({hasIntake:Boolean(workflow.technicalIntake),scopeApproved,hasReview:Boolean(partnerReviews?.length),partnerResponseReady:Boolean(partnerReviews?.some(r=>['approved','approved_with_conditions'].includes(r.status))),commercialApproved:workflow.commercialReview?.status==='approved',quoteStatus:workflow.clientQuote?.status});
  const clientRequirements=documents.find(d=>d.document_type==='client-requirements');
  const partnerAssessment=documents.find(d=>/partner.*assessment|technical.*assessment/i.test(d.document_type||''));
  const stage=String(queueRecord?.workflow_stage||'assessment');
  const view=resolveCaseQueuePresentation(stage);
  const normalised=stage.toLowerCase().replaceAll('_','-');
  const stageIndex=normalised.includes('project')?3:normalised.includes('commercial')||normalised.includes('quote')?2:normalised.includes('partner')?1:0;
  const waiting=view.nextAction.kind==='wait'&&!view.approval?.required;
  return <><WorkRecordV2 eyebrow={'WORK / CASE 360 / '+(lead.reference||id.slice(0,8))}
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
      {label:'Client Requirements Record',value:clientRequirements?`${clientRequirements.reference||'Document'} · ${clientRequirements.status}`:'Missing'},
      {label:'Partner Technical Assessment Report',value:partnerAssessment?`${partnerAssessment.reference||'Document'} · ${partnerAssessment.status}`:'Not generated'},
    ]}
    facts={[
      {label:'Company',value:lead.company_name},
      {label:'Record status',value:String(lead.status||'Not recorded').replaceAll('_',' ')},
      {label:'Current stage',value:stage.replaceAll('_',' ')},
    ]}
    governedHref={'/opos-next/cases/'+id+'#case-evidence'}
    previous="/opos-next/cases"/>
    <section id="case-evidence" className={styles.panel}>
      <DocumentGenerationPanel context="case" recordId={id} quoteId={workflow.clientQuote?.id} returnTo={`/opos-next/cases/${id}`} stageLabel={caseDocuments.stageLabel} items={caseDocuments.items}/>
      {workflow.technicalIntake&&!scopeApproved?<form action={approveIntakeAction} style={{marginTop:24}}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="intake_id" value={workflow.technicalIntake.id}/><button className="button" type="submit">Approve technical scope after document approval</button></form>:null}
    </section></>;
}
