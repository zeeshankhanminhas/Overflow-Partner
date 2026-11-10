import {authenticatedProjectLifecycle} from '@/lib/lifecycle/authenticatedProjectEvidence';
import {lifecycleGates,type WorkspaceActor} from '@/lib/lifecycle/currentAction';

/** Shared read-only status for authenticated operator, client and partner.
 * Never presents an executable link without separately verified capability. */
export default async function ProjectLifecycleEvidence({
 actor,projectId,
}:{actor:WorkspaceActor;projectId:string}){
 const position=await authenticatedProjectLifecycle(actor,projectId);
 if(!position)return null;
 const {action,known,total,ready}=position;
 const internal=actor==='operator';
 const owner=action.owner==='none'?'No task owner':action.owner==='operator'?'Overflow Partner Controller':
  action.owner==='client'?'Client':'Execution Partner';
 return <details style={{margin:'18px 0',border:'1px solid #303238',background:'#101113',
  borderRadius:12,padding:'16px 20px',color:'#f4f4f5'}}>
  <summary style={{cursor:'pointer',fontSize:13,fontWeight:600,minHeight:30}}>
   Lifecycle evidence · {ready?known+' of '+total+' gates verified or assessed':'Verification unavailable'}
  </summary>
  <div style={{display:'grid',gap:8,marginTop:14,fontSize:13}}>
   <strong>{internal?action.state==='unknown'?'Evidence gap: '+action.title:action.title:'Project verification status'}</strong>
   <span>Responsible role: {owner}</span>
   <span>Decision state: {action.state.replaceAll('_',' ')}</span>
   <p style={{margin:0,color:'#b8bac0'}}>{action.reason}</p>
   {!ready?<p style={{margin:0,color:'#f1c076'}}>The isolated QA evidence service is unavailable. This view cannot authorise any work.</p>:null}
   <p style={{margin:0,color:'#9497a0',fontSize:11}}>Read-only, permission-scoped evidence; unknown prerequisites remain blocked until a trusted source is verified. Use only the authorised task controls in the project workspace.</p>
   {internal&&ready?<div style={{marginTop:12,borderTop:'1px solid #303238',paddingTop:12}}>
    <strong>Full lifecycle evidence register · {total} gates</strong>
    <div style={{display:'grid',marginTop:10,gap:5}}>
     {lifecycleGates.map(gate=><div key={gate.key} style={{display:'flex',gap:12,justifyContent:'space-between',alignItems:'baseline',borderBottom:'1px solid #252629',padding:'7px 0'}}>
      <span>{gate.title}</span>
      <span style={{color:position.evidence[gate.key]?.state==='verified'?'#72cfa1':'#b8bac0',fontSize:11,whiteSpace:'nowrap'}}>{position.evidence[gate.key]?.state||'unknown'}</span>
     </div>)}
    </div>
   </div>:null}
  </div>
 </details>;
}
