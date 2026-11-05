'use client';
import {useActionState} from 'react';
import {createNorthfieldQaCase} from './qa-create-case';
import css from './opportunity.module.css';
export default function QaCreateCase(){
 const [state,action,pending]=useActionState(createNorthfieldQaCase,{ok:false,message:''});
 return <section className={css.workForm}>
  <p className={css.workHint}>The fictional Northfield assessment and internal approval are complete. Convert the qualified opportunity to Case 360 once, inheriting its technical evidence and partner quotation.</p>
  {!state.caseId?<form action={action} className={css.workForm}>
   <input type="hidden" name="prospect_id" value="dcaad06e-853d-466a-af5a-08b7ae7cc24d"/>
   <label className={css.workCheck}><input type="checkbox" required name="confirm" value="yes"/> Confirm isolated fictional QA Case creation</label>
   <button className={css.workButton} disabled={pending||state.ok} type="submit">{pending?'Creating Case 360…':'Create governed Case 360 →'}</button>
  </form>:null}
  {state.message?<p role={state.ok?'status':'alert'} className={state.ok?css.feedbackSuccess:css.feedbackError}>{state.message}</p>:null}
  {state.caseId?<a className={css.workButton} href={'/opos-next/cases/'+state.caseId}>Open Case 360 →</a>:null}
 </section>;
}
