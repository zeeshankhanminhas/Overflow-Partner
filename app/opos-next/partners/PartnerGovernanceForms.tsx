'use client';
import {useActionState} from 'react';
import {verifySignedPartnerNda,approvePartnerAfterNda} from './governance-actions';

const style={display:'grid',gap:12,marginTop:14,maxWidth:600} as const;
const field={display:'block',width:'100%',padding:11,borderRadius:7,background:'#151619',color:'#f4f4f5',border:'1px solid #52555a',marginTop:5} as const;
export default function PartnerGovernanceForms({partnerId,ndaVerified,approved}:{
  partnerId:string;ndaVerified:boolean;approved:boolean
}){
  const [nda,recordNda,ndaBusy]=useActionState(verifySignedPartnerNda,{ok:false,message:''});
  const [approval,recordApproval,approvalBusy]=useActionState(approvePartnerAfterNda,{ok:false,message:''});
  return <section style={{border:'1px solid #4446',padding:22,borderRadius:12,marginTop:25}}>
    <p style={{fontSize:11,letterSpacing:1.5,opacity:.7}}>AUTHORISED PARTNER ONBOARDING · QA PREVIEW</p>
    <h2 style={{fontSize:20,marginTop:12}}>Controlled confidentiality and internal approval</h2>
    <p style={{fontSize:13,opacity:.8,marginTop:8}}>These actions record verification of externally signed, genuine evidence. Do not use fictional, unsigned or simulated documents here. Only owner/admin reviewers can submit them.</p>
    {!ndaVerified?<form action={recordNda} style={style}>
      <h3 style={{fontSize:16}}>1. Verify executed NDA evidence</h3>
      <input type="hidden" name="partner_id" value={partnerId}/>
      <label>Signed NDA document reference<input style={field} name="evidence_reference" minLength={8} maxLength={300} required placeholder="Controlled document or storage reference"/></label>
      <label>External signatory name<input style={field} name="signed_by_name" minLength={3} maxLength={200} required/></label>
      <label>Actual date of signature<input style={field} type="datetime-local" name="signed_at" required/></label>
      <label style={{display:'flex',gap:10,fontSize:13}}><input type="checkbox" name="verified_external_evidence" value="yes" required/>
      I personally reviewed the actual executed NDA and can substantiate this verification.</label>
      <button disabled={ndaBusy} style={field} type="submit">{ndaBusy?'Verifying…':'Record verified NDA evidence'}</button>
      {nda.message?<p role={nda.ok?'status':'alert'}>{nda.message}</p>:null}
    </form>:<p style={{marginTop:20,fontSize:13}}>✓ Current NDA verification exists. Internal partner approval is assessed separately.</p>}
    {ndaVerified&&!approved?<form action={recordApproval} style={style}>
      <h3 style={{fontSize:16}}>2. Approve technical partner capability</h3>
      <input type="hidden" name="partner_id" value={partnerId}/>
      <label>Verified capability evidence reference<input style={field} name="capability_evidence_reference" minLength={8} maxLength={300} required/></label>
      <label>Authorised approval rationale<textarea style={{...field,minHeight:95}} name="decision_note" minLength={15} maxLength={1000} required/></label>
      <label style={{display:'flex',gap:10,fontSize:13}}><input type="checkbox" name="capability_review_confirmed" value="yes" required/>
      I have checked the execution partner's capability and suitability.</label>
      <button type="submit" disabled={approvalBusy} style={field}>{approvalBusy?'Recording…':'Record internal partner approval'}</button>
      {approval.message?<p role={approval.ok?'status':'alert'}>{approval.message}</p>:null}
    </form>:null}
    {approved?<p style={{marginTop:18,fontSize:13}}>Partner approved. Before any Work Order, a separately verified Execution Partner Agreement and paid-project controls remain compulsory.</p>:null}
  </section>;
}
