// Human-facing journey language only. Technical execution/revision counters stay
// in the evidence model and must not become normal operator or Partner workflow terms.
export const projectPhaseOrder = ['setup','partner_work','op_review','client_review','closeout'] as const;
export type ProjectPhase = typeof projectPhaseOrder[number];

export const projectPhaseMeta: Record<ProjectPhase,{label:string;owner:string}> = {
  setup: { label: 'Setup & release', owner: 'Overflow Partner' },
  partner_work: { label: 'Partner work', owner: 'Execution Partner' },
  op_review: { label: 'OP review', owner: 'Overflow Partner' },
  client_review: { label: 'Client review', owner: 'Client' },
  closeout: { label: 'Closeout', owner: 'Overflow Partner' },
};

export function projectPhaseForStage(stage?: string | null): ProjectPhase {
  switch (String(stage || 'mobilisation')) {
    case 'mobilisation':
    case 'ready_for_execution':
      return 'setup';
    case 'in_progress':
    case 'partner_correction':
      return 'partner_work';
    case 'internal_review':
    case 'ready_for_client_issue':
      return 'op_review';
    case 'issued_to_client':
    case 'client_review':
      return 'client_review';
    case 'completion':
    case 'closed':
      return 'closeout';
    default:
      return 'setup';
  }
}

export function deliveryHealthLabel(value?: unknown) {
  switch (String(value || '')) {
    case 'on_track': return 'On track';
    case 'at_risk': return 'At risk';
    case 'blocked': return 'Blocked';
    default: return 'No update';
  }
}

export function partnerWorkPresentation(input:{
  stage?:string|null;
  executionState?:string|null;
  commenced?:boolean;
  deliverySubmitted?:boolean;
  openExceptions?:number;
  partnerName?:string|null;
}) {
  const stage=String(input.stage||'mobilisation');
  const partner=input.partnerName||'Execution Partner';
  const openExceptions=Math.max(0,Number(input.openExceptions||0));
  const delivered=Boolean(input.deliverySubmitted||input.executionState==='delivery_submitted');

  if(stage==='ready_for_execution'&&!input.commenced){
    return {status:'Ready to start',owner:partner,next:'Confirm commencement',summary:'Review the controlled scope and confirm when work can begin.'};
  }
  if(stage==='partner_correction'){
    return delivered
      ? {status:'Revised delivery submitted',owner:'Overflow Partner',next:'Await OP review',summary:'The revised engineering delivery has been returned for review.'}
      : {status:'Changes requested',owner:partner,next:'Submit revised delivery',summary:'Overflow Partner has returned the work for correction.'};
  }
  if(stage==='in_progress'){
    if(delivered)return {status:'Final delivery submitted',owner:'Overflow Partner',next:'Await OP review',summary:'Partner work is complete for now. Overflow Partner owns the review.'};
    if(openExceptions>0)return {status:'Blocked',owner:'Overflow Partner',next:'Resolve Partner exception',summary:`${openExceptions} open execution ${openExceptions===1?'exception needs':'exceptions need'} resolution.`};
    return {status:input.commenced?'Working':'Ready to start',owner:partner,next:input.commenced?'Submit final delivery':'Confirm commencement',summary:input.commenced?'Engineering work is with the Execution Partner.':'Work starts when the Partner confirms commencement.'};
  }
  if(['internal_review','ready_for_client_issue'].includes(stage))return {status:'Partner delivery complete',owner:'Overflow Partner',next:'Complete OP review',summary:'Partner work is complete unless Overflow Partner requests changes.'};
  if(['issued_to_client','client_review'].includes(stage))return {status:'Partner delivery accepted',owner:'Client',next:'Await client outcome',summary:'The approved delivery has left Partner execution.'};
  if(['completion','closed'].includes(stage))return {status:'Partner work complete',owner:'Overflow Partner',next:'No Partner action',summary:'Partner execution is complete for this Project.'};
  return {status:'Preparing release',owner:'Overflow Partner',next:'Release Partner work',summary:'Overflow Partner is preparing the controlled execution package.'};
}

export function deliverySubmissionLabel(executionCycle?: unknown, revision?: unknown) {
  const explicit=String(revision||'').trim();
  if(explicit)return explicit;
  return Number(executionCycle||1)>1?'Revised delivery':'Original delivery';
}
