/** Pre-CRM, manually reviewed outreach research. Never an inferred payment status. */
export const OUTREACH_WEEKLY_TARGETS = {qualifiedResearchLow:25,qualifiedResearchHigh:30,firstContactLow:15,firstContactHigh:20} as const;
export const OUTREACH_FRESH_DAYS=30;

export type OutreachResearch = {
  outreach_id:string; evidence_description:string; engineering_evidence:string;
  decision_maker_evidence:string; workload_pressure_signal:string; source_url:string|null;
  observed_on:string|null; confidence:'unverified'|'inferred'|'directly_confirmed';
  evidence_state:'missing'|'tentative'|'evidenced';
  review_status:'pending'|'approved'|'rejected'|'blocked';
  review_reason:string; next_action:string; next_action_date:string|null;
  approved_at:string|null;
};
type ResearchEvidence = Pick<OutreachResearch,'evidence_description'|'engineering_evidence'|'decision_maker_evidence'|'workload_pressure_signal'|'source_url'|'observed_on'|'confidence'|'evidence_state'>;

export function researchGaps(record:ResearchEvidence, today=new Date()):string[]{
 const gaps:string[]=[];
 if(record.evidence_description.trim().length<12)gaps.push('Describe what the source actually shows');
 if(record.engineering_evidence.trim().length<12)gaps.push('Evidence of an in-house engineering, design or CAD team');
 if(record.decision_maker_evidence.trim().length<8)gaps.push('Evidence that this is an appropriate decision-maker');
 if(record.workload_pressure_signal.trim().length<8)gaps.push('Describe the workload pressure signal, including uncertainty');
 if(!record.source_url||!/^https:\/\/[^\s]+$/i.test(record.source_url)){
   gaps.push('Valid HTTPS source URL');
 }else{
   try{const url=new URL(record.source_url);if(url.username||url.password)gaps.push('Evidence URL must not contain credentials')}
   catch{gaps.push('Valid evidence source URL')}
 }
 if(!record.observed_on||!/^\d{4}-\d{2}-\d{2}$/.test(record.observed_on)){
   gaps.push('Observation date');
 }else{
   const t=Date.parse(record.observed_on+'T12:00:00Z');
   const now=Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate(),12);
   if(!Number.isFinite(t)||t>now)gaps.push('Observation date cannot be in the future');
   else if((now-t)/86400000>OUTREACH_FRESH_DAYS)gaps.push('Research older than 30 days — refresh evidence');
 }
 if(record.confidence==='unverified')gaps.push('Confidence must be inferred or directly confirmed');
 if(record.evidence_state!=='evidenced')gaps.push('Evidence state must be evidenced (not missing or tentative)');
 return gaps;
}

/** Research status is not proof of an interested reply, a signed contract, or payment. */
export function isReviewedForManualContact(record:OutreachResearch|null|undefined, now=new Date()):boolean{
 return Boolean(record?.review_status==='approved'&&record.approved_at&&researchGaps(record,now).length===0);
}
export function outreachPhase(threadState:string,review:OutreachResearch|null|undefined):string{
 if(threadState==='converted')return 'Handoff to governed CRM';
 if(threadState==='interested')return 'Positive interest — review CRM handoff';
 if(threadState==='closed')return 'Closed / lost';
 if(threadState==='waiting')return 'Contacted manually — awaiting reply';
 if(threadState==='followup')return 'Manual follow-up due or scheduled';
 if(isReviewedForManualContact(review))return 'Approved for manual first contact';
 if(review?.review_status==='rejected')return 'Rejected';
 if(review?.review_status==='blocked')return 'Blocked';
 if(review?.review_status==='pending'&&review.evidence_state==='evidenced')return 'Researched — awaiting approval';
 return 'Research candidate / evidence missing';
}
