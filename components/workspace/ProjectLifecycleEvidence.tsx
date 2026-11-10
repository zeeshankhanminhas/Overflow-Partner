import Link from 'next/link';
import {authenticatedProjectLifecycle} from '@/lib/lifecycle/authenticatedProjectEvidence';
import {lifecycleGates,type WorkspaceActor} from '@/lib/lifecycle/currentAction';

/**
 * One primary project decision shared by the three authenticated workspaces.
 * Existing action endpoints enforce permissions independently of this view.
 * The full 28-gate audit is visible only to internal Controllers.
 */
export default async function ProjectLifecycleEvidence({
 actor,projectId,
}:{actor:WorkspaceActor;projectId:string}){
 const position=await authenticatedProjectLifecycle(actor,projectId);
 if(!position)return null;
 const {action,known,total,ready}=position;
 const internal=actor==='operator';
 const owner=action.owner==='none'?'No task owner':action.owner==='operator'?'Overflow Partner Controller':
  action.owner==='client'?'Client':'Execution Partner';
 const blocked=!ready||action.state==='unknown'||action.state==='blocked';
 const publicReason=blocked&&!internal
  ?'Overflow Partner must verify the required project records before this step can proceed.'
  :action.reason;
 // Only attach fixed in-page anchors to previously allowed, scoped task URLs.
 // No arbitrary redirect, query string or untrusted fragment is introduced.
 const anchor=actor==='operator'?'#project-controls':
  actor==='partner'?'#partner-work-controls':
  action.key==='client_review_accepted'?'#drawing-review':'';
 const destination=action.target?`${action.target}${anchor}`:null;
 return <section aria-label="Authoritative project next action" style={{
  margin:'18px 0',border:'1px solid #303238',background:'#101113',
  borderRadius:12,padding:'19px 21px',color:'#f4f4f5'}}>
  <p style={{margin:'0 0 8px',fontSize:10,letterSpacing:'.12em',color:'#b8bac0',fontWeight:700}}>
   {action.canExecute?'YOUR VERIFIED NEXT STEP':blocked?'VERIFICATION REQUIRED':'CURRENT HANDOFF'}
  </p>
  <h2 style={{fontSize:20,margin:'0 0 9px',lineHeight:1.35}}>
   {ready?(internal?action.title:action.canExecute?action.title:
    action.owner===actor?'Await verification':'Await the next authorised decision'):
    'Project verification unavailable'}
  </h2>
  <p style={{margin:'0 0 10px',fontSize:13,color:'#b8bac0',lineHeight:1.6}}>{publicReason}</p>
  <p style={{margin:'0 0 12px',fontSize:12,color:'#c2c4cb'}}>Responsible role: {owner}</p>
  {action.canExecute&&destination?<Link href={destination}
   style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
    background:'#f4f4f5',color:'#101113',borderRadius:7,padding:'10px 14px',
    textDecoration:'none',fontSize:12,fontWeight:700}}>
    Open authorised task →
   </Link>:null}
  {!ready?<p role="status" style={{margin:'6px 0',color:'#f1c076',fontSize:12}}>
   Evidence could not be verified. This view cannot authorise work.
  </p>:null}
  {internal?<details style={{marginTop:14,borderTop:'1px solid #303238',paddingTop:12}}>
   <summary style={{cursor:'pointer',fontSize:12,color:'#b8bac0'}}>
    Lifecycle evidence · {ready?known+' of '+total+' gates assessed':'Verification unavailable'}
   </summary>
   <p style={{fontSize:12,color:'#b8bac0'}}>Decision state: {action.state.replaceAll('_',' ')}. {action.reason}</p>
   <div style={{display:'grid',marginTop:10,gap:5}}>
    {lifecycleGates.map(gate=><div key={gate.key} style={{display:'flex',
     gap:12,justifyContent:'space-between',alignItems:'baseline',
     borderBottom:'1px solid #252629',padding:'7px 0'}}>
     <span style={{fontSize:12}}>{gate.title}</span>
     <span style={{color:position.evidence[gate.key]?.state==='verified'?'#72cfa1':'#b8bac0',
      fontSize:11,whiteSpace:'nowrap'}}>{position.evidence[gate.key]?.state||'unknown'}</span>
    </div>)}
   </div>
   <p style={{fontSize:11,color:'#9497a0'}}>
    Read-only evidence. Actual task endpoints must independently authorise the user and current revision.
   </p>
  </details>:null}
 </section>;
}
