import {notFound} from 'next/navigation';
import styles from './caseDocuments.module.css';
import {requireUserContext} from '@/lib/auth/context';
import {resolveCaseQueuePresentation} from '@/lib/presentation/queueState';
import WorkRecordV2 from '../../WorkRecordV2';
import {getWorkflowCase} from '@/lib/orchestration/service';
import {getCaseDocumentRequirements} from '@/lib/cases/documentRequirements';
import DocumentGenerationPanel from '@/components/workspace/documents/DocumentGenerationPanel';
import {approveIntakeAction,createCommercialReviewAction,approveCommercialAction,issueQuoteAction,resendClientQuoteAction} from '@/app/workspace/orchestration/actions';
import MarginSimulator from '@/app/workspace/leads/[id]/MarginSimulator';
import QuoteIssueContractFields from '@/app/workspace/leads/[id]/QuoteIssueContractFields';

export default async function CasePage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string,success?:string}>}){
  const {id}=await params;
  const feedback=await searchParams;
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
  const {data:quoteIssue}=workflow.clientQuote?.status==='issued' ? await supabase.from('quote_issue_records').select('recipient_name,recipient_email,client_response,quote_revision').eq('organisation_id',organisationId).eq('quote_id',workflow.clientQuote.id).maybeSingle() : {data:null};
  const clientAccepted=quoteIssue?.client_response==='accepted';
  const {data:releaseContract}=clientAccepted&&workflow.clientQuote ? await supabase.from('quote_release_contracts').select('release_basis,opening_amount').eq('organisation_id',organisationId).eq('quote_id',workflow.clientQuote.id).eq('quote_revision',workflow.clientQuote.revision).maybeSingle() : {data:null};
  const openingAmount=Number(releaseContract?.opening_amount);
  const awaitingAdvance=clientAccepted&&['payment','deposit'].includes(String(releaseContract?.release_basis));
  const nextDecisionTitle=clientAccepted?(awaitingAdvance?'Awaiting advance payment verification':'Awaiting contractual release verification'):view.nextAction.label;
  const nextDecisionDescription=clientAccepted?(awaitingAdvance?(Number.isFinite(openingAmount)&&openingAmount>0?`Client accepted the quotation. Opening payment of £${openingAmount.toFixed(2)} must be received and verified before Project 360 can be created.`:'Client accepted the quotation. Confirm the agreed opening amount and verify payment before creating Project 360.'):'Client accepted the quotation. Verify the agreed release condition before Project 360 can be created.'):view.summary;
  const caseDocuments=getCaseDocumentRequirements({hasIntake:Boolean(workflow.technicalIntake),scopeApproved,hasReview:Boolean(partnerReviews?.length),partnerResponseReady:Boolean(partnerReviews?.some(r=>['approved','approved_with_conditions'].includes(r.status))),commercialApproved:workflow.commercialReview?.status==='approved',quoteStatus:workflow.clientQuote?.status});
  const clientRequirements=documents.find(d=>d.document_type==='client-requirements');
  const partnerAssessment=documents.find(d=>/partner.*assessment|technical.*assessment/i.test(d.document_type||''));
  const quoteDocument=documents.find(d=>d.document_type==='client-quote' && d.status==='approved');
  const stage=String(queueRecord?.workflow_stage||'assessment');
  const view=resolveCaseQueuePresentation(stage);
  const normalised=stage.toLowerCase().replaceAll('_','-');
  const stageIndex=normalised.includes('project')?3:normalised.includes('commercial')||normalised.includes('quote')?2:normalised.includes('partner')?1:0;
  const waiting=view.nextAction.kind==='wait'&&!view.approval?.required;
  return <><WorkRecordV2 eyebrow={'WORK / CASE 360 / '+(lead.reference||id.slice(0,8))}
    title={lead.title||lead.company_name}
    subtitle={lead.company_name+' · Controlled pre-project commercial record'}
    state={view.state} owner="Overflow Partner"
    nextTitle={nextDecisionTitle}
    nextDescription={nextDecisionDescription}
    stages={[
      {name:'Requirements',detail:'Governed scope'},
      {name:'Feasibility',detail:'Partner technical assessment'},
      {name:'Commercial offer',detail:'Price and quote decisions'},
      {name:'Commitment',detail:'Client decision and advance'},
    ]}
    stageIndex={clientAccepted?3:stageIndex} waiting={clientAccepted||waiting}
    evidence={[
      {label:'Case record',value:lead.reference||id.slice(0,8)},
      {label:'Governed workflow position',value:queueResult.error?'Unavailable — verify in controlled record':view.state},
      {label:'Client Requirements Record',value:clientRequirements?`${clientRequirements.reference||'Document'} · ${clientRequirements.status}`:'Missing'},
      {label:'Partner Technical Assessment Report',value:partnerAssessment?`${partnerAssessment.reference||'Document'} · ${partnerAssessment.status}`:'Not generated'},
    ]}
    facts={[
      {label:'Company',value:lead.company_name},
      {label:'Record status',value:clientAccepted?'Quotation accepted':String(lead.status||'Not recorded').replaceAll('_',' ')},
      {label:'Current stage',value:clientAccepted?'Commitment — release pending':stage.replaceAll('_',' ')},
    ]}
    governedHref={'/opos-next/cases/'+id+'#case-decision'}
    previous="/opos-next/cases"/>
    <section id="case-decision" className={styles.panel}>
      {feedback.error?<div role="alert" className={styles.errorNotice}><strong>Quotation not sent</strong><p>{feedback.error}</p><p>No successful issue confirmation has been recorded. Resolve this error before trying again.</p></div>:null}
      {feedback.success?<div role="status" className={styles.successNotice}><strong>Action completed</strong><p>{feedback.success}</p></div>:null}
      {workflow.clientQuote?.status==='issued'&&quoteIssue&&!quoteIssue.client_response&&quoteIssue.recipient_email&&Number(quoteIssue.quote_revision)===Number(workflow.clientQuote.revision)?<div className={styles.actionCard}>
        <div className={styles.eyebrow}>CLIENT QUOTATION · ISSUED</div>
        <h2>Resend issued quotation</h2>
        <p>Resend the current approved revision to its original authorised recipient. This preserves the quotation and issuance audit history.</p>
        <p><strong>Recipient:</strong> {quoteIssue.recipient_name||'Client'} · {quoteIssue.recipient_email}</p>
        <form action={resendClientQuoteAction}>
          <input type="hidden" name="return_to" value={`/opos-next/cases/${id}`}/>
          <input type="hidden" name="lead_id" value={id}/>
          <input type="hidden" name="quote_id" value={workflow.clientQuote.id}/>
          <input type="hidden" name="request_id" value={crypto.randomUUID()}/>
          <button type="submit" className={styles.submit}>Resend Client Quote email</button>
        </form>
      </div>:null}
      {scopeApproved&&workflow.partnerQuote&&!workflow.commercialReview?<div className={styles.actionCard}>
        <h2>Set commercial position</h2>
        <p>Use the approved partner price to calculate the client price and margin.</p>
        <form action={createCommercialReviewAction}><input type="hidden" name="return_to" value={`/opos-next/cases/${id}`}/>
          <input type="hidden" name="lead_id" value={id}/>
          <input type="hidden" name="partner_quote_id" value={workflow.partnerQuote.id}/>
          <MarginSimulator cost={Number(workflow.partnerQuote.price||0)} currency={workflow.partnerQuote.currency||'GBP'}/>
          <label className={styles.note}>Optional commercial note<textarea name="commercial_note" rows={3}/></label>
          <button type="submit" className={styles.submit}>Set commercial position</button>
        </form>
      </div>:null}
      {workflow.commercialReview&&!workflow.clientQuote?<div className={styles.actionCard}>
        <h2>Approve commercial position</h2>
        <p>Confirm the recorded position and generate the Client Quote through the governed action.</p>
        <form action={approveCommercialAction}><input type="hidden" name="return_to" value={`/opos-next/cases/${id}`}/>
          <input type="hidden" name="lead_id" value={id}/>
          <input type="hidden" name="commercial_review_id" value={workflow.commercialReview.id}/>
          <button type="submit" className={styles.submit}>Approve position and generate Client Quote</button>
        </form>
      </div>:null}
      {workflow.clientQuote&&quoteDocument&&['draft','internal_review'].includes(workflow.clientQuote.status)?<div className={styles.actionCard}>
        <div className={styles.eyebrow}>COMMERCIAL OFFER · READY FOR ISSUE</div>
        <h2>Send the client quotation</h2>
        <p className={styles.intro}>The approved technical scope, delivery proposal and commercial terms are ready to be formally presented to the client.</p>
        <div className={styles.offerSummary}>
          <div><span>Quotation value</span><strong>{new Intl.NumberFormat('en-GB',{style:'currency',currency:String(workflow.clientQuote.currency||'GBP')}).format(Number(workflow.clientQuote.total||0))}</strong><small>Including applicable tax, where charged</small></div>
          <div><span>Opening payment</span><strong>30% advance</strong><small>Due after client acceptance</small></div>
        </div>
        <form action={issueQuoteAction}>
          <input type="hidden" name="return_to" value={`/opos-next/cases/${id}`}/>
          <input type="hidden" name="lead_id" value={id}/>
          <input type="hidden" name="quote_id" value={workflow.clientQuote.id}/>
          <div className={styles.formSection}><h3>Confirm the authorised recipient</h3>
            <div className={styles.fieldGrid}>
              <label className={styles.note}>Recipient name<input name="recipient_name" required defaultValue={workflow.lead.contact_name||''}/></label>
              <label className={styles.note}>Recipient email<input name="recipient_email" type="email" required defaultValue={workflow.lead.contact_email||''}/></label>
            </div>
          </div>
          <div className={styles.formSection}><h3>Payment and commercial terms</h3><QuoteIssueContractFields total={Number(workflow.clientQuote.total||0)} currency={String(workflow.clientQuote.currency||'GBP')}/></div>
          <label className={styles.note}>Optional message to accompany the quotation<textarea name="issue_note" rows={3} placeholder="Add a short personal note, if needed."/></label>
          <div className={styles.nextStep}><strong>What happens next</strong><p>The client receives the controlled quotation and secure response options. OPOS records issuance evidence and tracks the client decision. No project begins until acceptance and advance payment verification.</p></div>
          <button type="submit" className={styles.submit}>Send approved quotation by email</button>
        </form>
      </div>:null}
    </section>
    <section id="case-evidence" className={styles.panel}>
      <DocumentGenerationPanel context="case" recordId={id} quoteId={workflow.clientQuote?.id} returnTo={`/opos-next/cases/${id}`} stageLabel={caseDocuments.stageLabel} items={caseDocuments.items}/>
      {workflow.technicalIntake&&!scopeApproved?<form action={approveIntakeAction} style={{marginTop:24}}><input type="hidden" name="lead_id" value={id}/><input type="hidden" name="intake_id" value={workflow.technicalIntake.id}/><button className="button" type="submit">Approve technical scope after document approval</button></form>:null}
    </section></>;
}
