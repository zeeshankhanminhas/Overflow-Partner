import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {resolveAcquisitionState} from '@/lib/acquisition/state';
import {canInviteFromLinkedIn} from '@/lib/acquisition/linkedinFunnel';
import {isKnownIsolatedQaBackend,isKnownIsolatedQaStep2Backend} from '@/lib/qa/isolation';
import OpportunityWork from '../OpportunityWork';
import QaPartnerHandoff from '../QaPartnerHandoff';
import QaIssueReview from '../QaIssueReview';
import QaIssueExistingReview from '../QaIssueExistingReview';
import {sendQueuedQaStep2InvitationAction} from '../qa-step2-actions';
import css from '../opportunity.module.css';

const date = (value:string|null|undefined) => value
  ? new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'Europe/London'}).format(new Date(value))
  : 'Not recorded';

function emailLabel(status:string|null|undefined) {
  switch(String(status||'').toLowerCase()) {
    case 'sent': return 'Accepted by email provider';
    case 'delivered': return 'Provider confirmed delivery';
    case 'queued': case 'pending': case 'retry': case 'processing': return 'Invitation queued / processing';
    case 'failed': case 'permanently_failed': case 'dead_letter': return 'Email delivery failed — review required';
    case 'not_configured': return 'Email service not configured';
    default: return 'Email delivery not independently verified';
  }
}

export default async function OpportunityPreview({
  params,searchParams,
}:{params:Promise<{id:string}>;searchParams?:Promise<{error?:string;updated?:string;partnerReviewCreated?:string;partnerDecision?:string;notificationWarning?:string;qaInvitationQueued?:string;qaInvitationSent?:string}>}) {
  const {id}=await params;
  const query=searchParams?await searchParams:{};
  const {supabase,organisationId,profile}=await requireUserContext();

  const [prospectResult,sessionResult,requestResult,partnerListResult,deliveryResult,eventsResult]=await Promise.all([
    supabase.from('prospects')
      .select('id,company_name,contact_name,email,source,status,outreach_status,response_outcome,next_action,created_at,converted_lead_id,requirement_summary')
      .eq('organisation_id',organisationId).eq('id',id).maybeSingle(),
    supabase.from('intake_sessions')
      .select('id,status,created_at,expires_at,opened_at,submitted_at,email_status,email_error')
      .eq('organisation_id',organisationId).eq('prospect_id',id)
      .order('created_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('partner_review_requests')
      .select('id,partner_id,status,response_due_at,case_reference,created_at,submitted_at')
      .eq('organisation_id',organisationId).eq('prospect_id',id)
      .order('created_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('partners').select('id,company_name,email')
      .eq('organisation_id',organisationId).eq('status','approved').eq('nda_signed',true)
      .order('company_name'),
    // Scoped by active user's organisation inside the existing RPC.
    // Only invitation events for this prospect are displayed; never infer inbox delivery from "sent".
    supabase.rpc('op_list_notification_delivery',{p_status:null,p_category:null,p_limit:150}),
    supabase.from('activity_events')
      .select('id,event_type,created_at').eq('organisation_id',organisationId)
      .eq('entity_type','prospect').eq('entity_id',id)
      .order('created_at',{ascending:false}).limit(12),
  ]);
  if(prospectResult.error || sessionResult.error || requestResult.error || partnerListResult.error || eventsResult.error)
    throw new Error('Opportunity evidence could not be loaded securely.');
  const prospect=prospectResult.data;
  if(!prospect)notFound();

  const session=sessionResult.data;
  const request=requestResult.data;
  const [submissionResult,responseResult,decisionResult,quoteResult,partnerResult]=await Promise.all([
    session?.id?supabase.from('intake_submissions')
      .select('id,description,submitted_at').eq('organisation_id',organisationId)
      .eq('intake_session_id',session.id).maybeSingle():Promise.resolve({data:null,error:null}),
    request?.id?supabase.from('partner_review_responses')
      .select('id,feasibility,capacity_status,confidence_percent,technical_risks,assumptions,missing_information,estimated_lead_time_days,submitted_at')
      .eq('organisation_id',organisationId).eq('partner_review_request_id',request.id)
      .order('revision',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null,error:null}),
    request?.id?supabase.from('partner_review_internal_decisions')
      .select('id,decision,review_notes,approved_at,created_at')
      .eq('organisation_id',organisationId).eq('partner_review_request_id',request.id)
      .order('created_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null,error:null}),
    request?.id?supabase.from('partner_quotes')
      .select('id,price,currency,valid_until')
      .eq('organisation_id',organisationId).eq('partner_review_request_id',request.id)
      .order('created_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null,error:null}),
    request?.partner_id?supabase.from('partners')
      .select('company_name').eq('organisation_id',organisationId).eq('id',request.partner_id).maybeSingle()
      :Promise.resolve({data:null,error:null}),
  ]);
  if(submissionResult.error||responseResult.error||decisionResult.error||quoteResult.error||partnerResult.error)
    throw new Error('Partner assessment evidence could not be loaded securely.');

  const submission=submissionResult.data;
  const response=responseResult.data;
  const decision=decisionResult.data;
  const quote=quoteResult.data;
  const convertedCaseId=prospect.converted_lead_id||null;
  const acquisition=resolveAcquisitionState({
    prospectStatus:prospect.status,
    hasSession:!!session,sessionStatus:session?.status,
    hasSubmission:!!submission,convertedCaseId,
    hasPartnerRequest:!!request,partnerRequestStatus:request?.status,
    hasPartnerResponse:!!response,partnerDecision:decision?.decision,
    hasPartnerPricing:!!quote && Number(quote.price)>0,
  });
  const {data:qaHandoffEvidence}=organisationId==='717262cb-68da-4e7b-a9fa-238dc6c5d16b' && id==='dcaad06e-853d-466a-af5a-08b7ae7cc24d' ? await supabase.from('activity_events').select('id,created_at').eq('organisation_id',organisationId).eq('entity_type','prospect').eq('entity_id',id).eq('event_type','qa.partner_assessment_handoff_rehearsed').limit(1).maybeSingle():{data:null};
  const role=String(profile.role);
  const canWrite=['owner','admin','business_development','operator'].includes(role);
  const canRequestPartner=['owner','admin','business_development','operator','engineering'].includes(role);
  const canDecide=['owner','admin','commercial','engineering'].includes(role);
  const source=prospect.source==='website'?'Website enquiry':prospect.source==='linkedin'?'LinkedIn qualification':prospect.source||'Other enquiry';
  const invite=(deliveryResult.data||[]).find((event:{entity_type:string;entity_id:string;event_key:string;status:string;sent_at:string|null;created_at:string})=>
    event.entity_type==='prospect' && event.entity_id===id && event.event_key==='requirements.requested' &&
    (!session?.created_at || new Date(event.created_at).getTime()>=new Date(session.created_at).getTime()));
  const recordedSessionStatus = ['sent','delivered','failed'].includes(String(session?.email_status||'')) ? session?.email_status : null;
  const sendStatus=recordedSessionStatus==='failed' && invite?.status!=='sent' ? 'failed' : invite?.status || recordedSessionStatus || null;
  const emailFact=emailLabel(sendStatus);
  const partnerName=partnerResult.data?.company_name||null;
  const actionKey=acquisition.actionKey;
  const previewWritable=isKnownIsolatedQaBackend();
  const qaStep2Available=isKnownIsolatedQaStep2Backend() &&
    organisationId==='717262cb-68da-4e7b-a9fa-238dc6c5d16b' &&
    String(prospect.company_name).startsWith('QA - ') &&
    String(prospect.email||'').toLowerCase().endsWith('+client@gmail.com');
  const qaRecoverableInvitation=qaStep2Available && !!session && !acquisition.submitted &&
    session.status==='invited' && ['pending','failed'].includes(String(session.email_status||'')) &&
    invite?.status==='pending';
  const failedDelivery=!!session&&!acquisition.submitted &&
    ['failed','permanently_failed','dead_letter'].includes(String(sendStatus||'').toLowerCase());
  const actionNeeded=qaRecoverableInvitation||failedDelivery||['create_intake','request_partner','issue_partner_review','review_partner_response','create_case'].includes(actionKey);
  const state=qaRecoverableInvitation?'Invitation queued - delivery needs action':failedDelivery?'Secure invitation delivery needs attention':acquisition.currentState;
  const reason=qaRecoverableInvitation
    ? 'The secure QA form and invitation are saved, but the email was not sent. Send the original invitation without creating another session.'
    : failedDelivery
    ? 'The latest requirements invitation has a delivery failure on record. Do not assume the customer received the form. Review notification evidence before arranging a controlled recovery.'
    : acquisition.nextReason;
  const stageIndex=acquisition.converted||['create_case','open_case'].includes(actionKey)?2:
    ['request_partner','wait_partner','review_partner_response','resolve_clarification'].includes(actionKey)?2:
    session?1:0;
  const followupOverdue=!!session && ['invited','opened','in_progress'].includes(session.status)
    && !!session.expires_at && new Date(session.expires_at).getTime()<Date.now();
  const activity=eventsResult.data||[];
  const formRole=actionKey==='request_partner'?canRequestPartner:canWrite;
  return <article aria-labelledby="opos-opportunity-name">
    <div className={css.frame}>
      <div className={css.header}>
        <div><p className={css.headerTitle}>OP / OPOS</p><p className={css.headerDescription}>Opportunity / {source}</p></div>
        <span className={css.pill}>{acquisition.converted?'Case created':actionNeeded?'Action required':acquisition.waitingExternally?'Awaiting external response':state}</span>
      </div>
      <div className={css.rule}/>
      <h1 id="opos-opportunity-name" className={css.title}>{prospect.company_name||'Opportunity'}</h1>
      <p className={css.subtitle}>OP-{prospect.id.slice(0,8).toUpperCase()} · {source}</p>

      {query.error?<p className={css.feedbackError} role="alert">Action could not be completed: {String(query.error).slice(0,500)}</p>:null}
      {query.qaInvitationSent?<p className={css.feedbackSuccess} role="status">The QA email provider accepted the original requirements invitation. Check the test Gmail inbox; provider acceptance does not prove delivery.</p>:null}
      {query.qaInvitationQueued?<p className={css.feedbackSuccess} role="status">QA secure requirements session created and email queued. Actual delivery requires the independent QA email sending check.</p>:null}
      {query.notificationWarning?<p className={css.feedbackError} role="alert">The partner review was created, but its email notification needs investigation.</p>:null}
      {(query.updated||query.partnerReviewCreated||query.partnerDecision)&&!query.error?
        <p className={css.feedbackSuccess} role="status">Operating record updated. The current position below reflects the saved evidence.</p>:null}

      <section className={css.section} aria-label="Current operating position">
        <p className={css.overline}>CURRENT POSITION</p>
        <h2 className={css.position}>{state}</h2>
        <p className={css.description}>{reason}</p>
        {followupOverdue?<p className={css.feedbackError} role="status">The current invitation's recorded expiry has passed. Review the secure intake status before any retry.</p>:null}
        <div className={css.badges}>
          <span className={css.pill+' '+(session&&acquisition.submitted?css.pillOk:'')}>
            <span className={css.dot}/>
            {acquisition.submitted?'Customer requirements received':session?'Secure intake session '+String(session.status).replaceAll('_',' '):'Requirements not yet requested'}
          </span>
          {session&&!acquisition.submitted?<span className={css.pill}><span className={css.dot}/>{emailFact}</span>:null}
          {request?<span className={css.pill}><span className={css.dot}/>Partner review {request.status.replaceAll('_',' ')}</span>:null}
        </div>
        {session&&!acquisition.submitted?<p className={css.note}>Delivery evidence: {emailFact}{invite?.sent_at?' · provider accepted '+date(invite.sent_at):''}. Provider acceptance does not prove inbox delivery.</p>:null}
        {actionNeeded?<div className={css.workArea}>
          {qaStep2Available && id==='dcaad06e-853d-466a-af5a-08b7ae7cc24d' && acquisition.submitted && actionKey==='request_partner' ? (qaHandoffEvidence ? <div className={css.workHint}><strong>QA handoff rehearsal completed.</strong> The submitted requirements and PDF metadata were verified against the fictional partner. Next tests: authorised private-file download, simulated partner communication, and partner response. No real partner invitation has been issued.</div> : <QaPartnerHandoff/>) : null}
          {qaStep2Available && id==='dcaad06e-853d-466a-af5a-08b7ae7cc24d' && acquisition.submitted && actionKey==='request_partner' && qaHandoffEvidence ? <QaIssueReview/> : null}
          {!previewWritable&&!qaStep2Available&&!failedDelivery?<p className={css.workHint}>Actions are connected but locked while the isolated QA environment's safe test-email rules are prepared. No invitations, partner assessments or Case creations can be triggered until the QA write gate is explicitly enabled.</p>:null}
          <p className={css.overline}>NEXT GOVERNED ACTION</p>
          {actionKey==='issue_partner_review' && qaStep2Available && request?.id==='e8d6be99-5b5a-446b-a071-cc5c05a102c7'?<QaIssueExistingReview/>:qaRecoverableInvitation?<form action={sendQueuedQaStep2InvitationAction} className={css.workForm}>
            <input type="hidden" name="prospect_id" value={id}/>
            <p className={css.workHint}>This sends the existing invitation once to the QA +client mailbox without creating a new session, reminders or opportunity.</p>
            <button className={css.workButton} type="submit">Send queued QA invitation →</button>
          </form>:failedDelivery?<Link className={css.workButton} href={'/opos-next/notifications?prospect='+id}>Review delivery failure evidence →</Link>:
          <OpportunityWork prospectId={id} actionKey={actionKey} canWrite={formRole} canDecide={canDecide} previewWritable={previewWritable}
            hasContactEmail={Boolean(prospect.email)} linkedinEligible={canInviteFromLinkedIn(prospect)} qaStep2Available={qaStep2Available}
            sessionId={session?.id||null} scopeSummary={String(submission?.description||prospect.requirement_summary||'Engineering requirement')}
            partners={partnerListResult.data||[]} partnerRequestId={request?.id||null}
            partnerResponse={response} partnerQuote={quote}
            partnerName={partnerName} convertedCaseId={convertedCaseId}/>}
        </div>:actionKey==='open_case'?<div className={css.workArea}><OpportunityWork prospectId={id} actionKey={actionKey}
          canWrite={canWrite} canDecide={canDecide} previewWritable={previewWritable} hasContactEmail={Boolean(prospect.email)}
          linkedinEligible={canInviteFromLinkedIn(prospect)} sessionId={session?.id||null}
          scopeSummary={String(submission?.description||prospect.requirement_summary||'Engineering requirement')}
          partners={partnerListResult.data||[]} partnerRequestId={request?.id||null}
          partnerResponse={response} partnerQuote={quote} 
          partnerName={partnerName} convertedCaseId={convertedCaseId}/></div>:
        <p className={css.note}>No operator action is required while the next dependency is outstanding.</p>}
      </section>

      <section className={css.section} aria-labelledby="op-journey">
        <h2 className={css.sectionHeading} id="op-journey">Journey progress</h2>
        <div className={css.journey}>
          {['Enquiry','Requirements','Feasibility'].map((label,index)=>{
            const done=index<stageIndex;
            const current=index===stageIndex;
            return <div className={css.stage} key={label}>
              <div className={css.stageTop}>
                <span className={css.stageNumber}>{String(index+1).padStart(2,'0')}</span>
                <span className={css.stageSign+(done?' '+css.stageComplete:'')} aria-label={done?'Completed':current?'Current':'Upcoming'}>{done?'✓':current?'◉':'○'}</span>
              </div>
              <strong className={css.stageName}>{label}</strong>
            </div>;
          })}
        </div>
      </section>

      <section className={css.section} aria-labelledby="op-evidence">
        <div className={css.headingRow}><h2 className={css.sectionHeading} id="op-evidence">Activity and evidence</h2>
          <a href="#op-full-history" className={css.secondary}>View history ↗</a>
        </div>
        <div className={css.evidenceList}>
          {decision?<div className={css.evidence}><span className={css.evidenceIcon} aria-hidden="true">✓</span><div>
            <p className={css.evidenceTitle}>Feasibility decision: {decision.decision.replaceAll('_',' ')}</p>
            <p className={css.evidenceSub}>{date(decision.approved_at||decision.created_at)} · Governed internal approval</p>
          </div></div>:null}
          {response?<div className={css.evidence}><span className={css.evidenceIcon} aria-hidden="true">▣</span><div>
            <p className={css.evidenceTitle}>Execution Partner response received</p>
            <p className={css.evidenceSub}>{date(response.submitted_at)} · {partnerName||'Execution Partner'} · Price {quote?Number(quote.price).toLocaleString('en-GB')+' '+quote.currency:'not recorded'}</p>
          </div></div>:null}
          {request?<div className={css.evidence}><span className={css.evidenceIcon} aria-hidden="true">↗</span><div>
            <p className={css.evidenceTitle}>Partner assessment {request.status.replaceAll('_',' ')}</p>
            <p className={css.evidenceSub}>{date(request.created_at)} · {partnerName||'Execution Partner'} · Due {date(request.response_due_at)}</p>
          </div></div>:null}
          {submission?<div className={css.evidence}><span className={css.evidenceIcon} aria-hidden="true">✓</span><div>
            <p className={css.evidenceTitle}>Customer requirements submitted</p>
            <p className={css.evidenceSub}>{date(submission.submitted_at)} · Secure intake recorded</p>
          </div></div>:session?<div className={css.evidence}><span className={css.evidenceIcon} aria-hidden="true">✉</span><div>
            <p className={css.evidenceTitle}>Secure requirements invitation</p>
            <p className={css.evidenceSub}>{date(session.created_at)} · {emailFact}</p>
          </div></div>:null}
          <div className={css.evidence}><span className={css.evidenceIcon} aria-hidden="true">▣</span><div>
            <p className={css.evidenceTitle}>{prospect.source==='website'?'Website enquiry received':'Opportunity recorded'}</p>
            <p className={css.evidenceSub}>{date(prospect.created_at)} · Initial enquiry captured</p>
          </div></div>
        </div>
        <details className={css.history} id="op-full-history">
          <summary>Full record history and controlled context</summary>
          <div className={css.historyBody}>
            <p>Opportunity status: {String(prospect.status||'Not recorded').replaceAll('_',' ')}</p>
            {session?<p>Intake: {session.status} · Expires {date(session.expires_at)} · Email {emailFact}</p>:null}
            {request?<p>Partner review: {request.case_reference} · {request.status}</p>:null}
            {activity.map(item=><p key={item.id}>{date(item.created_at)} · {item.event_type.replaceAll('_',' ')}</p>)}
            <p><Link className={css.secondary} href={'/opos-next/notifications?prospect='+id}>Inspect notification delivery evidence ↗</Link></p>
            <p><Link className={css.secondary} href={'/workspace/acquisition/' + id}>Inspect existing governed record ↗</Link></p>
          </div>
        </details>
      </section>
    </div>
    <p className={css.footer}>Live organisation-scoped OPOS record · Governed actions are connected to the existing business engine. External customer and partner forms remain protected by their established validation.</p>
  </article>;
}
