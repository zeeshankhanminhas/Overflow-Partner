import {authenticatedProjectLifecycle} from '@/lib/lifecycle/authenticatedProjectEvidence';
import type {WorkspaceActor} from '@/lib/lifecycle/currentAction';

/** Shared read-only status for authenticated operator, client and partner.
 * Never presents an executable link without separately verified capability. */
export default async function ProjectLifecycleEvidence({
 actor,projectId,
}:{actor:WorkspaceActor;projectId:string}){
 const position=await authenticatedProjectLifecycle(actor,projectId);
 if(!position)return null;
 const {action,known,total,ready}=position;
 const owner=action.owner==='none'?'No task owner':action.owner==='operator'?'Overflow Partner Controller':
  action.owner==='client'?'Client':'Execution Partner';
 return <details style={{margin:'18px 0',border:'1px solid #303238',background:'#101113',
  borderRadius:12,padding:'16px 20px',color:'#f4f4f5'}}>
  <summary style={{cursor:'pointer',fontSize:13,fontWeight:600,minHeight:30}}>
   Lifecycle evidence · {ready?known+' of '+total+' gates verified or assessed':'Verification unavailable'}
  </summary>
  <div style={{display:'grid',gap:8,marginTop:14,fontSize:13}}>
   <strong>{action.title}</strong>
   <span>Responsible role: {owner}</span>
   <span>Decision state: {action.state.replaceAll('_',' ')}</span>
   <p style={{margin:0,color:'#b8bac0'}}>{action.reason}</p>
   {!ready?<p style={{margin:0,color:'#f1c076'}}>The isolated QA evidence service is unavailable. This view cannot authorise any work.</p>:null}
   <p style={{margin:0,color:'#9497a0',fontSize:11}}>Read-only, permission-scoped evidence; previous unknown gates remain blocked until a trusted source is verified. Use only the authorised task controls in the project workspace.</p>
  </div>
 </details>;
}
