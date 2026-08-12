import type { OperatingPresentation, OperatingTone } from './operatingState';

function base(input:{state:string;summary:string;tone:OperatingTone;waitingOn?:'internal'|'partner'|'client'|null;nextAction:string;available?:boolean;approval?:boolean}):OperatingPresentation{
  const actor=input.waitingOn??'internal';
  return {
    state:input.state,
    headline:input.state,
    summary:input.summary,
    tone:input.tone,
    waitingOn:actor?{actor,label:actor==='partner'?'Execution Partner':actor==='client'?'Client':'Overflow Partner'}:null,
    nextAction:{label:input.nextAction,available:input.available??input.tone!=='waiting',kind:input.approval?'approve':input.tone==='waiting'?'wait':'act'},
    blockers:[],warnings:[],completed:[],primaryActions:[],
    approval:input.approval?{required:true,type:input.nextAction,status:'ready',owner:'Overflow Partner'}:undefined,
  };
}

export function resolveCaseQueuePresentation(workflowStage:string):OperatingPresentation{
  const stage=String(workflowStage||'assessment').toLowerCase().replaceAll('_','-');
  if(['assessment','technical-assessment','technical-basis'].includes(stage))return base({state:'Technical basis',summary:'Technical definition or controlled scope needs internal work.',tone:'active',nextAction:'Complete technical basis'});
  if(['partner-review','partner-evidence'].includes(stage))return base({state:'Partner evidence',summary:'Review the inherited Acquisition Partner evidence; do not create a second Partner Assessment.',tone:'attention',nextAction:'Review inherited Partner evidence'});
  if(['partner-pricing','partner-price'].includes(stage))return base({state:'Partner price',summary:'The governed Partner cost is ready to be used in the commercial position.',tone:'active',nextAction:'Set commercial position'});
  if(['commercial-review','commercial'].includes(stage))return base({state:'Commercial decision',summary:'The controlled selling position needs an authorised commercial decision.',tone:'waiting',nextAction:'Approve commercial position',approval:true});
  if(['client-quotes','quote','quotation'].includes(stage))return base({state:'Client Quote',summary:'The Case is in controlled quotation preparation, issue or client decision.',tone:'active',nextAction:'Open Client Quote'});
  if(stage==='project')return base({state:'Handed off',summary:'Delivery ownership has moved to Project 360.',tone:'complete',waitingOn:null,nextAction:'Open Project 360',available:true});
  return base({state:'Case active',summary:'Open Case 360 for the authoritative operating state.',tone:'active',nextAction:'Open Case 360'});
}

export function resolvePartnerAssessmentQueuePresentation(input:{requestStatus?:string|null;hasResponse?:boolean;hasDecision?:boolean;hasPositivePrice?:boolean}):OperatingPresentation{
  const status=String(input.requestStatus||'draft');
  if(input.hasDecision)return base({state:'Decision recorded',summary:'The Go / No-Go decision has been recorded in Acquisition.',tone:'complete',waitingOn:null,nextAction:'Open Enquiry',available:true});
  if(input.hasResponse){
    if(input.hasPositivePrice)return base({state:'Approval needed',summary:'Partner feasibility and price are complete. The internal Go / No-Go decision is due.',tone:'waiting',nextAction:'Record Go / No-Go',approval:true});
    return base({state:'Partner response received',summary:'Feasibility is back, but a positive governed Partner price is still required.',tone:'attention',nextAction:'Complete Partner price'});
  }
  if(status==='clarification_required')return base({state:'Clarification needed',summary:'The Execution Partner needs more information before completing the assessment.',tone:'attention',nextAction:'Resolve clarification'});
  if(['invited','opened','in_progress'].includes(status))return base({state:'Waiting for Partner',summary:'The assessment is with the Execution Partner.',tone:'waiting',waitingOn:'partner',nextAction:'Await Partner assessment',available:false});
  return base({state:'Partner Assessment',summary:'Prepare and send the controlled Partner assessment from Acquisition.',tone:'active',nextAction:'Send Partner assessment'});
}
