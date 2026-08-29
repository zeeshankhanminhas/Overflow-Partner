// Human-facing journey language only. Technical execution/revision counters stay
// in the evidence model and must not become normal operator or Partner workflow terms.
export const projectPhaseOrder = ['setup','partner_work','op_review','client_review','closeout'] as const;
export type ProjectPhase = typeof projectPhaseOrder[number];

export const projectPhaseMeta: Record<ProjectPhase,{label:string;owner:string}> = {
  setup: { label: 'Project setup', owner: 'Overflow Partner' },
  partner_work: { label: 'Partner work', owner: 'Delivery Partner' },
  op_review: { label: 'Overflow Partner review', owner: 'Overflow Partner' },
  client_review: { label: 'Client review', owner: 'Client' },
  closeout: { label: 'Complete', owner: 'Overflow Partner' },
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
  const partner=input.partnerName||'Delivery Partner';
  const openIssues=Math.max(0,Number(input.openExceptions||0));
  const delivered=Boolean(input.deliverySubmitted||input.executionState==='delivery_submitted');

  if(stage==='ready_for_execution'&&!input.commenced){
    return {status:'Ready to start',owner:partner,next:'Confirm start',summary:'Review the agreed scope and confirm when work can begin.'};
  }
  if(stage==='partner_correction'){
    return delivered
      ? {status:'Revised work submitted',owner:'Overflow Partner',next:'Await Overflow Partner review',summary:'The revised work has been returned for review.'}
      : {status:'Changes needed',owner:partner,next:'Submit revised work',summary:'Overflow Partner has requested changes before the work can progress.'};
  }
  if(stage==='in_progress'){
    if(delivered)return {status:'Work submitted',owner:'Overflow Partner',next:'Await Overflow Partner review',summary:'Partner work is complete for now and is being reviewed by Overflow Partner.'};
    if(openIssues>0)return {status:'Blocked',owner:'Overflow Partner',next:'Resolve delivery issue',summary:`${openIssues} open ${openIssues===1?'issue needs':'issues need'} attention before delivery can progress.`};
    return {status:input.commenced?'In progress':'Ready to start',owner:partner,next:input.commenced?'Submit completed work':'Confirm start',summary:input.commenced?'Engineering work is with the Delivery Partner.':'Work starts when the Delivery Partner confirms they are ready.'};
  }
  if(['internal_review','ready_for_client_issue'].includes(stage))return {status:'Ready for review',owner:'Overflow Partner',next:'Complete Overflow Partner review',summary:'Partner work is complete unless further changes are requested.'};
  if(['issued_to_client','client_review'].includes(stage))return {status:'With client',owner:'Client',next:'Await client response',summary:'The approved work has been sent to the client for review.'};
  if(['completion','closed'].includes(stage))return {status:'Complete',owner:'Overflow Partner',next:'No further partner action',summary:'Partner work is complete for this project.'};
  return {status:'Preparing project',owner:'Overflow Partner',next:'Send work to partner',summary:'Overflow Partner is preparing the approved work package for the Delivery Partner.'};
}

export function deliverySubmissionLabel(executionCycle?: unknown, revision?: unknown) {
  const explicit=String(revision||'').trim();
  if(explicit)return explicit;
  return Number(executionCycle||1)>1?'Revised work':'Original work';
}
