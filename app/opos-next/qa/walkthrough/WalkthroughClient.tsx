'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';
import {
  steps,phases,scenarioSteps,scenarioNames,actorNames,statusNames,
  type Actor,type Scenario,type JourneyStep
} from './journey';
import styles from './walkthrough.module.css';

type LiveSnapshot={
 qa:boolean;projectId:string|null;projectName:string;projectNumber:string;projectStage:string;
 revision:string|null;fileCount:number;storageComplete:boolean;engineeringAccepted:boolean;
 manifestVerified:boolean;releaseAuthorised:boolean;readinessReasons:string[];backendReadOk:boolean;
};
type Verdict='pass'|'fail'|'not_run';
const actors:Actor[]=['client','operator','partner'];
const actorLinks:Record<Actor,string>={
 client:'/portal/client',operator:'/opos-next',partner:'/portal/partner'
};
function titleCase(value:string){return value.replaceAll('_',' ').replace(/\b[a-z]/g,letter=>letter.toUpperCase());}
function linkFor(step:JourneyStep,role:Actor,live:LiveSnapshot){
 const original=step.portal?.[role]||actorLinks[role];
 if(role==='operator' && original==='/opos-next/projects' && live.projectId)
   return '/opos-next/projects/'+live.projectId;
 return original;
}
function Evidence({items}:{items:string[]}){
 return <ul className={styles.evidenceList}>{items.map(item=><li key={item}>{item}</li>)}</ul>;
}
function Status({step}:{step:JourneyStep}){
 return <span className={step.status==='blocked'?styles.blocked:styles.status}>
  {statusNames[step.status]}
 </span>;
}
function RoleCard({step,role,focused,onFocus,live}:{
 step:JourneyStep;role:Actor;focused:boolean;onFocus:()=>void;live:LiveSnapshot
}){
 const own=step.owner===role;
 const description=step[role];
 return <article className={focused?styles.roleFocused:styles.roleCard}>
  <div className={styles.roleTop}>
   <span className={styles.roleIdentity}><span className={styles.roleDot}/>{actorNames[role]}</span>
   {own?<span className={styles.ownerTag}>Owns this step</span>:<span className={styles.waitTag}>Informed / waiting</span>}
  </div>
  <div className={styles.portalWindow}>
   <div className={styles.mockToolbar}><span/><span/><span/><small>{role==='operator'?'WORKSPACE 2.0':role==='client'?'CLIENT ACCOUNT':'PARTNER ACCOUNT'}</small></div>
   <p className={styles.mockEyebrow}>{role==='operator'?'OPERATOR DECISION':role==='client'?'CUSTOMER VIEW':'PARTNER VIEW'}</p>
   <h3>{own?step.title:role==='client'?'Your engineering relationship':role==='partner'?'Assigned engineering work':'Control and oversight'}</h3>
   <p>{description}</p>
  </div>
  <div className={styles.roleActions}>
   <button type="button" onClick={onFocus} className={focused?styles.selectedRole:styles.roleFocusButton}>
    {focused?'Focused persona':'Focus persona'}
   </button>
   <Link className={styles.openPortal} href={linkFor(step,role,live)} target="_blank" rel="noopener noreferrer">
    Open actual {role==='operator'?'operator':role} portal ↗
   </Link>
  </div>
 </article>;
}
export default function WalkthroughClient({live}:{live:LiveSnapshot}){
 const [scenario,setScenario]=useState<Scenario>('standard');
 const [stepIndex,setStepIndex]=useState(0);
 const [focus,setFocus]=useState<Actor>('operator');
 const [visited,setVisited]=useState<Record<string,boolean>>({});
 const [verdicts,setVerdicts]=useState<Record<string,Verdict>>({});
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [mode,setMode]=useState<'journey'|'matrix'>('journey');
 const [copied,setCopied]=useState(false);
 const activeSteps=useMemo(()=>scenarioSteps(scenario),[scenario]);
 const index=Math.min(stepIndex,activeSteps.length-1);
 const step=activeSteps[index];
 const key=scenario+':'+step.id;
 const accepted=Object.keys(visited).filter(k=>k.startsWith(scenario+':')&&visited[k]).length;
 const statuses=Object.entries(verdicts).filter(([k,v])=>k.startsWith(scenario+':')&&v!=='not_run');
 const failures=statuses.filter(([,v])=>v==='fail').length;
 const uniquePhases=phases.filter(phase=>activeSteps.some(x=>x.phase===phase));
 const currentPhaseIndex=uniquePhases.indexOf(step.phase as typeof phases[number]);
 const isLast=index===activeSteps.length-1;
 const nextStep=activeSteps[index+1];
 const progress=Math.round((accepted/activeSteps.length)*100);
 const focusAction=step[focus];
 function changeScenario(value:Scenario){
  setScenario(value);setStepIndex(0);setFocus('operator');setCopied(false);
 }
 function goTo(i:number){setStepIndex(Math.max(0,Math.min(activeSteps.length-1,i)));setFocus(activeSteps[Math.max(0,Math.min(activeSteps.length-1,i))].owner);setCopied(false);}
 function understood(){
  setVisited(value=>({...value,[key]:true}));
  if(!isLast)goTo(index+1);
 }
 async function copyReport(){
  const date=new Date().toISOString();
  const rows=activeSteps.map((item,n)=>{
   const itemKey=scenario+':'+item.id;
   return {
    number:n+1,phase:item.phase,step:item.title,owner:actorNames[item.owner],
    walkthrough_acknowledged:!!visited[itemKey],
    reviewer_observation:verdicts[itemKey]||'not_run',comment:notes[itemKey]||'',
    implementation_status:statusNames[item.status],expected_gate:item.gate
   };
  });
  const report={title:'OPOS three-party E2E walkthrough — reviewer observations',generated_at:date,
   scenario:scenarioNames[scenario],source:'Manual observations on a read-only QA guide; NOT a database audit or authenticated E2E certification',
   northfield_qa_snapshot:live,steps:rows};
  try{
   await navigator.clipboard.writeText(JSON.stringify(report,null,2));
   setCopied(true);
  }catch{setCopied(false);}
 }
 return <div className={styles.root}>
  <header className={styles.hero}>
   <div>
    <p className={styles.eyebrow}>OPOS / ISOLATED QA / GUIDED E2E</p>
    <h1>One project. Three portals.<br/><span>Every decision.</span></h1>
    <p className={styles.intro}>Walk the same engineering order from first enquiry to financial closure. Switch between Client, OP Operator and Execution Partner. Every step shows the action, exact evidence, system result, failure route and real portal to inspect.</p>
   </div>
   <div className={styles.heroAside}>
    <strong>Read-only walkthrough</strong>
    <p>This guide does not create clients, payments, Work Orders or approvals. “Verified live” is your manual observation in this browser, not a server-side QA pass.</p>
    <div className={styles.heroLinks}>
     <Link target="_blank" rel="noopener noreferrer" href="/portal/client">Client Workspace ↗</Link>
     <Link target="_blank" rel="noopener noreferrer" href="/opos-next">OP Operator ↗</Link>
     <Link target="_blank" rel="noopener noreferrer" href="/portal/partner">Partner Workspace ↗</Link>
    </div>
    <small>Use authorised separate QA accounts/sessions for client and partner. Switching persona here never impersonates anyone.</small>
   </div>
  </header>

  <section className={styles.live} aria-label="Live Northfield QA snapshot">
   <div className={styles.liveHeading}>
    <div><span className={styles.eyebrow}>LIVE QA EVIDENCE · NORTHFIELD</span>
     <h2>{live.projectNumber}</h2><p>{live.projectName}</p></div>
    {live.projectId?<Link href={'/opos-next/projects/'+live.projectId} target="_blank" rel="noopener noreferrer">Open real Northfield Project 360 ↗</Link>:null}
   </div>
   <div className={styles.liveStats}>
    <div><span>Stage</span><strong>{titleCase(live.projectStage)}</strong></div>
    <div><span>Partner submission</span><strong>{live.revision||'Unverified'} · {live.fileCount} file(s)</strong></div>
    <div><span>Engineering accepted</span><strong>{live.engineeringAccepted?'Yes · recorded':'No'}</strong></div>
    <div><span>Manifest verified</span><strong>{live.manifestVerified?'Yes · recorded':'No'}</strong></div>
    <div><span>Client release authorised</span><strong>{live.releaseAuthorised?'Yes · recorded':'No'}</strong></div>
   </div>
   {!live.backendReadOk?<p className={styles.alert}>The current QA database evidence could not be read. Use the walkthrough for orientation only; no live state has been verified.</p>:null}
   {live.readinessReasons.length?<p className={styles.liveBlockers}><strong>Current genuine gate:</strong> {live.readinessReasons.join(' · ')}</p>:null}
  </section>

  <section className={styles.controls} aria-label="Walkthrough controls">
   <label>Scenario
    <select value={scenario} onChange={event=>changeScenario(event.target.value as Scenario)}>
     {Object.entries(scenarioNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
   </label>
   <label>View
    <select value={mode} onChange={event=>setMode(event.target.value as 'journey'|'matrix')}>
     <option value="journey">Guided experience</option>
     <option value="matrix">All steps / responsibility matrix</option>
    </select>
   </label>
   <div className={styles.progressArea}><div className={styles.progressLabel}><span>Walkthrough explored</span><strong>{accepted} / {activeSteps.length} · {progress}%</strong></div>
    <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Walkthrough explored"><span style={{width:progress+'%'}}/></div>
    <small>{statuses.length} manual live observations · {failures} reported issues</small>
   </div>
   <button type="button" onClick={copyReport} className={styles.copy}>{copied?'Report copied':'Copy manual QA observations'}</button>
  </section>

  {mode==='matrix'?<section className={styles.matrixWrap}>
   <div className={styles.matrixIntro}><h2>Complete lifecycle responsibility matrix</h2><p>Select any step to open its three-portal guided experience. “Configured” describes a code route, not proof of an end-to-end live test.</p></div>
   <div className={styles.matrixScroll}><table className={styles.matrix}>
    <thead><tr><th>Step</th><th>Stage</th><th>Decision owner</th><th>What gets done</th><th>Review readiness</th></tr></thead>
    <tbody>{activeSteps.map((item,n)=><tr key={item.id}>
     <td><button type="button" onClick={()=>{goTo(n);setMode('journey');}}>{String(n+1).padStart(2,'0')} · {item.title} ↗</button></td>
     <td>{item.phase}</td><td>{actorNames[item.owner]}</td><td>{item.system}</td><td>{statusNames[item.status]}</td>
    </tr>)}</tbody>
   </table></div>
  </section>:<div className={styles.layout}>
   <aside className={styles.rail} aria-label="End-to-end process timeline">
    <div className={styles.railHeader}><span className={styles.eyebrow}>THE ENTIRE BUSINESS</span><strong>{uniquePhases.length} stages · {activeSteps.length} handoffs</strong></div>
    {uniquePhases.map((phase,p)=><div key={phase} className={styles.phaseGroup}>
     <div className={p===currentPhaseIndex?styles.currentPhase:styles.phaseName}><span>{String(p+1).padStart(2,'0')}</span>{phase}</div>
     <div className={styles.phaseSteps}>{activeSteps.map((item,j)=>item.phase===phase?
      <button key={item.id} type="button" className={index===j?styles.activeStep:styles.stepLink} onClick={()=>goTo(j)} aria-current={index===j?'step':undefined}>
       <span>{visited[scenario+':'+item.id]?'✓':String(j+1).padStart(2,'0')}</span>{item.title}
      </button>:null)}</div>
    </div>)}
   </aside>
   <main className={styles.content} aria-label="Selected business workflow step">
    <section className={styles.stepHeader}>
     <div className={styles.stepEyebrow}><span>STAGE {currentPhaseIndex+1} OF {uniquePhases.length}</span><span>STEP {index+1} OF {activeSteps.length}</span></div>
     <p className={styles.stageLabel}>{step.phase} / {actorNames[step.owner]} owns the decision</p>
     <h2>{step.title}</h2>
     <p className={styles.stepWhy}>{step.why}</p>
     <Status step={step}/>
    </section>

    <section aria-label="Three portal views">
     <div className={styles.sectionTitle}><h3>What each portal does</h3><p>One process, separate identities, responsibilities and permissions.</p></div>
     <div className={styles.personas}>{actors.map(actor=><RoleCard key={actor} step={step} role={actor} focused={focus===actor} onFocus={()=>setFocus(actor)} live={live}/>)}</div>
     <div className={styles.focusStrip}>
      <span>{actorNames[focus]} · focused view</span><p>{focusAction}</p>
     </div>
    </section>

    <div className={styles.details}>
     <section className={styles.outcome}><span className={styles.eyebrow}>SYSTEM TRANSACTION / WHAT GETS DONE</span><h3>Recorded outcome</h3><p>{step.system}</p>
      {step.notification?<div className={styles.notification}><strong>Communication</strong><p>{step.notification}</p></div>:null}
     </section>
     <section className={styles.evidence}><span className={styles.eyebrow}>AUDIT / DOCUMENTS / EVIDENCE</span><h3>Proof OP must retain</h3><Evidence items={step.evidence}/></section>
     <section className={styles.gate}><span className={styles.eyebrow}>PASS CONDITION</span><h3>What unlocks the next step</h3><p>{step.gate}</p></section>
     <section className={styles.failure}><span className={styles.eyebrow}>NEGATIVE PATH / NEVER BYPASS</span><h3>If this fails</h3><p>{step.failure}</p></section>
    </div>

    {step.status==='blocked'?<div className={styles.blockedNotice} role="note">
     <strong>Known implementation gap</strong>
     <p>This stage is included for the complete business journey, but its protected client-review implementation is not available for authenticated QA. Do not mark an actual client issue or approval as passed.</p>
    </div>:null}
    <section className={styles.observations} aria-label="Manual observations for the selected step">
     <div><h3>Record what you actually tested</h3><p>This is a personal browser-session checklist only. It cannot approve R01, record payment or change the project database.</p></div>
     <div className={styles.verdictOptions}>
      <button type="button" aria-pressed={verdicts[key]==='pass'} className={verdicts[key]==='pass'?styles.positiveSelected:styles.verdict} onClick={()=>setVerdicts(value=>({...value,[key]:'pass'}))}>✓ Verified live</button>
      <button type="button" aria-pressed={verdicts[key]==='fail'} className={verdicts[key]==='fail'?styles.negativeSelected:styles.verdict} onClick={()=>setVerdicts(value=>({...value,[key]:'fail'}))}>! Issue found</button>
      <button type="button" aria-pressed={!verdicts[key]||verdicts[key]==='not_run'} className={styles.verdict} onClick={()=>setVerdicts(value=>({...value,[key]:'not_run'}))}>Not run</button>
     </div>
     <label>Observation / evidence reference (optional)
      <textarea value={notes[key]||''} onChange={event=>setNotes(value=>({...value,[key]:event.target.value}))} rows={3} placeholder="E.g. client portal denied unauthorised project; screenshot reference; exact issue or error."/>
     </label>
    </section>
    <footer className={styles.footerActions}>
     <button type="button" onClick={()=>goTo(index-1)} disabled={index===0} className={styles.back}>← Previous decision</button>
     <button type="button" onClick={understood} className={styles.forward}>{isLast?'Acknowledge final step ✓':'Acknowledge walkthrough · Next →'}</button>
    </footer>
    {nextStep?<p className={styles.nextInfo}>Next: <strong>{nextStep.title}</strong> · owned by {actorNames[nextStep.owner]}</p>
      :<p className={styles.nextInfo}><strong>End of scenario.</strong> Export your manual observations; then select another exception path to verify the correction and variation rules.</p>}
   </main>
  </div>}

  <footer className={styles.pageFooter}>
   <p><strong>Boundary:</strong> This is a fully navigable business walkthrough and QA guide—not a claim that each portal action has passed live E2E testing. Actual technical sign-off, quote acceptance, financial reconciliation and file release must occur only in the authorised portal with real QA evidence.</p>
   <p>External client-review distribution remains blocked until the secure watermarked viewer and scoped issue flow are implemented and authenticated end-to-end tests pass.</p>
  </footer>
 </div>;
}
