import {saveOutreachResearchAction} from '@/app/outreach/research-actions';
import {researchGaps,isReviewedForManualContact,type OutreachResearch} from '@/lib/outreach/research';
import styles from '@/app/outreach/research.module.css';

export default function OutreachResearchPanel({id,research,canWrite,closed}:{
 id:string;research:OutreachResearch|null;canWrite:boolean;closed:boolean
}){
 const blank:OutreachResearch=research||{
  outreach_id:id,evidence_description:'',engineering_evidence:'',decision_maker_evidence:'',
  workload_pressure_signal:'',source_url:null,observed_on:null,confidence:'unverified',
  evidence_state:'missing',review_status:'pending',review_reason:'',next_action:'',
  next_action_date:null,approved_at:null
 };
 const gaps=researchGaps(blank);
 const approved=isReviewedForManualContact(research);
 const readOnly=closed||!canWrite;
 return <section className={styles.panel} aria-labelledby="research-heading">
  <header className={styles.head}>
   <div>
    <p>ACCOUNT RESEARCH / HUMAN REVIEW</p>
    <h2 id="research-heading">Qualification evidence</h2>
    <p>Research stays in Outreach until a person records an interested reply and authorizes CRM handoff. Approval permits <strong>manual</strong> first contact; it never sends a message.</p>
   </div>
   <span className={styles.state}>{closed?'Read-only':
     approved?'Approved for manual contact':research?.review_status==='rejected'?'Rejected':
     research?.review_status==='blocked'?'Blocked':
     research?.review_status==='approved'?'Approval stale — refresh evidence':
     'Awaiting review'}</span>
  </header>
  {gaps.length>0?<div className={styles.gaps} aria-label="Research evidence gaps">
   <strong>Evidence gaps / freshness warnings</strong>
   <ul>{gaps.map(gap=><li key={gap}>{gap}</li>)}</ul>
  </div>:null}
  <form action={saveOutreachResearchAction} className={styles.form}>
   <input type="hidden" name="outreach_id" value={id}/>
   <fieldset disabled={readOnly} style={{border:0,padding:0,margin:0,display:'contents'}}>
    <label className={styles.wide}>Observed company evidence
     <small>Include the exact claim seen on the source page. Do not invent a staffing shortage.</small>
     <textarea name="evidence_description" maxLength={4000} defaultValue={blank.evidence_description} placeholder="E.g. company lists an internal engineering department and recent design programs."/>
    </label>
    <label>In-house engineering or CAD evidence
     <small>Which technical function exists inside this company?</small>
     <textarea name="engineering_evidence" maxLength={4000} defaultValue={blank.engineering_evidence}/>
    </label>
    <label>Decision-maker relevance
     <small>Why is this person responsible for capacity or technical delivery?</small>
     <textarea name="decision_maker_evidence" maxLength={2000} defaultValue={blank.decision_maker_evidence}/>
    </label>
    <label className={styles.wide}>Workload pressure signal
     <small>Label inference explicitly. A hiring advert is a signal, not proof the team is overloaded.</small>
     <textarea name="workload_pressure_signal" maxLength={4000} defaultValue={blank.workload_pressure_signal}/>
    </label>
    <label>Source URL
     <input name="source_url" type="url" maxLength={1500} placeholder="https://company.example/engineering" defaultValue={blank.source_url||''}/>
    </label>
    <label>Observed date
     <input name="observed_on" type="date" defaultValue={blank.observed_on||''}/>
    </label>
    <label>Confidence
     <select name="confidence" defaultValue={blank.confidence}>
      <option value="unverified">Unverified</option><option value="inferred">Inferred — plausible, not confirmed</option>
      <option value="directly_confirmed">Directly confirmed</option>
     </select>
    </label>
    <label>Evidence state
     <select name="evidence_state" defaultValue={blank.evidence_state}>
      <option value="missing">Missing</option><option value="tentative">Tentative</option>
      <option value="evidenced">Evidenced</option>
     </select>
    </label>
    <label className={styles.wide}>Next manual action
     <input name="next_action" maxLength={1000} defaultValue={blank.next_action} placeholder="Review technical director's remit; prepare personalized first contact"/>
    </label>
    <label>Next action date
     <input name="next_action_date" type="date" defaultValue={blank.next_action_date||''}/>
    </label>
    <label className={styles.wide}>Review decision notes
     <textarea name="review_reason" maxLength={2000} defaultValue={blank.review_reason} placeholder="Approval reasoning, uncertainty, why rejected, or what blocks the account"/>
    </label>
    <div className={styles.actions+' '+styles.wide}>
     <button name="review_action" value="save" type="submit">Save research</button>
     <button name="review_action" value="approve" type="submit" className={styles.approve}>Approve manual contact</button>
     <button name="review_action" value="block" type="submit">Mark blocked</button>
     <button name="review_action" value="reject" type="submit">Reject account</button>
    </div>
   </fieldset>
   <p className={styles.foot}>Only an evidenced, fresh account can be approved. Save as pending while information is missing. A separate human action must record any message or reply on LinkedIn.</p>
  </form>
 </section>;
}
