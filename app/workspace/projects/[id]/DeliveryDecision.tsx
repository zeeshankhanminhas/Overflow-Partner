import WatermarkedPdfViewer from '@/app/opos-next/projects/[id]/review-preview/WatermarkedPdfViewer';
import {recordEngineeringDecisionAction,verifyDeliveryManifestAction,authoriseClientReviewReleaseAction,issueProtectedClientReviewAction} from './delivery-actions';

export type DeliveryGate = {
  submission_id:string; revision:string; storage_complete:boolean; engineering_accepted:boolean;
  manifest_verified:boolean; release_authorised:boolean; files:{id:string; filename:string}[];
};

export function deliveryTitle(gate:DeliveryGate|null, stage:string) {
  if (!gate?.submission_id || !gate.storage_complete || !gate.files?.length) return 'Await the complete partner submission';
  if (!gate.engineering_accepted) return 'Review the engineering submission';
  if (!gate.manifest_verified) return 'Verify the delivery manifest';
  if (stage === 'internal_review') return null;
  return gate.release_authorised ? 'Inspect and issue the client review' : 'Authorise client review preparation';
}

export default function DeliveryDecision({gate,projectId,role,stage}:{gate:DeliveryGate|null;projectId:string;role:string;stage:string}) {
  if (!gate?.storage_complete || !gate.submission_id || !gate.files?.length) return <p>Delivery control needs a complete, accessible submission from the current execution cycle.</p>;
  const owner=['owner','admin'].includes(role);
  const project=<input type="hidden" name="project_id" value={projectId}/>;
  const base='/workspace/projects/'+projectId;
  let form;
  if (!gate.engineering_accepted) {
    form=owner || role==='engineering' ? <form action={recordEngineeringDecisionAction}>{project}
      <input type="hidden" name="submission_id" value={gate.submission_id}/>
      <fieldset><legend>Engineering acceptance checks</legend>
        {Object.entries({scope:'Matches the agreed scope',completeness:'Required outputs are present and legible',revision:'Identifiers and revisions match',quality:'Dimensions, interfaces and risks reviewed',exceptions:'Exceptions resolved'}).map(([key,label])=><label key={key}><input type="checkbox" name={key} value="true"/> {label}</label>)}
      </fieldset><label>Findings and evidence<textarea required minLength={12} name="findings"/></label>
      <label>Decision<select name="decision" defaultValue="" required><option disabled value="">Select a decision</option><option value="accepted">Accept</option><option value="correction_required">Request correction</option><option value="rejected">Reject</option></select></label>
      <button className="button">Record engineering decision</button></form> : <p>Awaiting the engineering reviewer.</p>;
  } else if (!gate.manifest_verified) {
    form=owner || ['operator','engineering'].includes(role) ? <form action={verifyDeliveryManifestAction}>{project}
      <label><input required type="checkbox" name="confirmed" value="true"/> I checked the current revision and its files against the accepted submission.</label>
      <button className="button">Verify manifest</button></form> : <p>Awaiting document control.</p>;
  } else if (stage==='ready_for_client_issue' && owner) {
    if (!gate.release_authorised) form=<form action={authoriseClientReviewReleaseAction}>{project}<label>Release evidence<textarea required name="note" minLength={12}/></label><button className="button">Authorise review preparation</button></form>;
    else {
      const drawings=gate.files.filter(file=>file.filename.toLowerCase().endsWith('.pdf'));
      form=drawings.length ? <>{drawings.map(file=><WatermarkedPdfViewer key={file.id} projectId={projectId} fileId={file.id} filename={file.filename} sourceUrl={base+'/review-preview/'+file.id}/>)}<form action={issueProtectedClientReviewAction}>{project}
        <label><input type="checkbox" name="preview_confirmed" value="yes" required/> I inspected the watermarked review package.</label>
        <label>Issue note<textarea required name="note" minLength={12}/></label><button className="button">Issue to verified client workspace</button></form></> : <p>A controlled PDF is required for client review.</p>;
    }
  } else form=<p>Awaiting the release owner.</p>;
  return <div className="stack"><strong>Submitted revision {gate.revision}</strong><ul>{gate.files.map(file=><li key={file.id}><a href={base+'/delivery/'+file.id} target="_blank" rel="noreferrer">{file.filename}</a></li>)}</ul>{form}</div>;
}
