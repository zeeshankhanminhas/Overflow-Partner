'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PartnerDeliveryFiles from '@/components/execution/PartnerDeliveryFiles';
import { deliveryHealthLabel, deliverySubmissionLabel, partnerWorkPresentation } from '@/lib/presentation/projectJourney';

type ExecutionState={
  execution?:{assignment_id:string;execution_state:string;execution_cycle?:number;release_reference?:string|null;planned_start_date?:string|null;committed_due_date?:string|null;reporting_cadence:string;release_notes?:string|null;released_at?:string|null};
  project?:{id:string;project_number:string;title:string;start_date?:string|null;due_date?:string|null;project_stage:string};
  partner?:{id:string;company_name:string;contact_name?:string|null};
  controlled_scope?:{id:string;title:string;reference:string;status:string;revision_code?:string|null;issue_purpose?:string|null}|null;
  commencement?:Record<string,unknown>|null;
  progress_updates?:Array<Record<string,unknown>>;
  exceptions?:Array<Record<string,unknown>>;
  delivery_submissions?:Array<Record<string,unknown>>;
  message?:string;
};
type Mode='commencement'|'progress'|'exception'|'delivery'|null;
type DeliveryFileState={count:number;locked:boolean;cycle:number};

const field='w-full border-0 border-b border-black/20 bg-transparent px-0 py-3 text-base outline-none focus:border-black';
const label='grid gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-neutral-500';
const quietButton='min-h-11 border border-black/20 px-5 py-2.5 text-sm font-medium transition hover:bg-black hover:text-white';
const primaryButton='min-h-11 bg-black px-5 py-2.5 text-sm font-medium text-white disabled:bg-neutral-400';
function pretty(value?:unknown){return String(value||'not recorded').replaceAll('_',' ').replace(/\b\w/g,char=>char.toUpperCase());}
function date(value?:unknown){if(!value)return'Not set';const d=new Date(String(value));return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
function partnerMessage(value?:unknown){return String(value||'').replace(/current execution cycle/gi,'current delivery').replace(/execution cycle/gi,'delivery').replace(/current cycle/gi,'current delivery').replace(/correction cycle/gi,'requested changes').replace(/Cycle\s*\d+/gi,'delivery');}

function Fact({label:factLabel,value}:{label:string;value:ReactNode}){
  return <div className="border-t border-black/10 pt-4"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">{factLabel}</p><div className="mt-2 text-sm font-medium text-neutral-900">{value}</div></div>;
}

function Drawer({title,eyebrow,onClose,children}:{title:string;eyebrow:string;onClose:()=>void;children:ReactNode}){
  return <div className="fixed inset-0 z-50 bg-black/25" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <aside className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto bg-[#f5f4ef] shadow-2xl" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sticky top-0 z-10 flex items-start justify-between gap-6 border-b border-black/10 bg-[#f5f4ef]/95 px-6 py-5 backdrop-blur md:px-9">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">{title}</h2></div>
        <button type="button" onClick={onClose} className="border border-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]">Close</button>
      </div>
      <div className="px-6 py-8 md:px-9">{children}</div>
    </aside>
  </div>;
}

export default function PartnerExecutionWorkspace(){
  const{token}=useParams<{token:string}>();
  const[state,setState]=useState<ExecutionState>({});const[loading,setLoading]=useState(true);const[submitting,setSubmitting]=useState(false);const[message,setMessage]=useState('');const[mode,setMode]=useState<Mode>(null);const[deliveryFiles,setDeliveryFiles]=useState<DeliveryFileState>({count:0,locked:false,cycle:1});
  const load=useCallback(async()=>{const response=await fetch(`/api/execution/${token}`,{cache:'no-store'});const body=await response.json();setState(body);setLoading(false);},[token]);
  useEffect(()=>{load().catch(()=>{setState({message:'Unable to load this Partner workspace.'});setLoading(false);});},[load]);

  async function submit(event:FormEvent<HTMLFormElement>,action:'commencement'|'progress'|'exception'|'delivery'){
    event.preventDefault();setMessage('');
    if(action==='delivery'&&deliveryFiles.count<1){setMessage('Attach at least one engineering output file before submitting this delivery.');return;}
    if(action==='delivery'&&deliveryFiles.locked){setMessage('This delivery has already been submitted. Its evidence is locked.');return;}
    setSubmitting(true);const form=event.currentTarget;const data=new FormData(form);const payload:Record<string,unknown>=Object.fromEntries(data.entries());payload.action=action;
    if(action==='commencement'){payload.scope_reviewed=data.get('scope_reviewed')==='true';payload.inputs_received=data.get('inputs_received')==='true';payload.capacity_confirmed=data.get('capacity_confirmed')==='true';payload.no_unresolved_blocker=data.get('no_unresolved_blocker')==='true';payload.declaration_checked=data.get('declaration_checked')==='true';}
    if(action==='delivery')payload.declaration_checked=data.get('declaration_checked')==='true';
    try{
      const response=await fetch(`/api/execution/${token}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await response.json();setMessage(partnerMessage(body.message||(response.ok?'Update recorded.':'Unable to record update.')));
      if(response.ok){form.reset();setMode(null);await load();}
    }finally{setSubmitting(false);}
  }

  if(loading)return <main className="min-h-screen bg-[#f5f4ef] px-6 py-16 text-[#151515]"><div className="mx-auto max-w-6xl animate-pulse"><div className="h-3 w-36 bg-black/10"/><div className="mt-8 h-12 w-3/5 bg-black/10"/><div className="mt-14 grid gap-5 md:grid-cols-3"><div className="h-28 bg-black/5"/><div className="h-28 bg-black/5"/><div className="h-28 bg-black/5"/></div></div></main>;
  if(!state.execution||!state.project)return <main className="min-h-screen bg-[#f5f4ef] px-6 py-20 text-[#151515]"><div className="mx-auto max-w-5xl border-t border-black/10 pt-10"><p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Overflow Partner</p><h1 className="mt-4 text-4xl font-semibold">Partner workspace unavailable</h1><p className="mt-5 text-neutral-600">{partnerMessage(state.message)}</p></div></main>;

  const commenced=Boolean(state.commencement);const updates=state.progress_updates||[];const exceptions=state.exceptions||[];const submissions=state.delivery_submissions||[];const openExceptions=exceptions.filter(item=>['open','acknowledged'].includes(String(item.status)));const latest=updates[0];const deliverySubmitted=state.execution.execution_state==='delivery_submitted';const canReport=['in_progress','partner_correction'].includes(String(state.project.project_stage))&&!deliverySubmitted;const canRaisePreCommencement=state.project.project_stage==='ready_for_execution';
  const partnerView=partnerWorkPresentation({stage:state.project.project_stage,executionState:state.execution.execution_state,commenced,deliverySubmitted,openExceptions:openExceptions.length,partnerName:state.partner?.company_name});
  const correction=state.project.project_stage==='partner_correction';
  const journey=correction?['Changes requested','Working','Revised delivery submitted']:['Ready to start','Working','Delivery submitted'];
  const journeyIndex=!commenced?0:deliverySubmitted?2:1;
  const latestHealth=deliveryHealthLabel(latest?.progress_state);
  const latestPercent=latest?.percent_complete===null||latest?.percent_complete===undefined?null:Number(latest.percent_complete);
  const timeline=[
    ...updates.map(item=>({kind:'Progress update',at:item.submitted_at,title:deliveryHealthLabel(item.progress_state),detail:String(item.work_in_progress||'')})),
    ...exceptions.map(item=>({kind:'Exception',at:item.raised_at,title:String(item.title||''),detail:`${pretty(item.severity)} · ${String(item.description||'')}`})),
    ...submissions.map(item=>({kind:Number(item.execution_cycle||1)>1?'Revised engineering delivery':'Final engineering delivery',at:item.submitted_at,title:deliverySubmissionLabel(item.execution_cycle,item.revision),detail:String(item.delivery_summary||'')})),
  ].sort((a,b)=>new Date(String(b.at)).getTime()-new Date(String(a.at)).getTime());

  return <main className="min-h-screen bg-[#f5f4ef] text-[#171717]">
    <div className="mx-auto max-w-[1380px] px-5 py-7 md:px-8 lg:px-12 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-8 border-b border-black/10 pb-7">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Overflow Partner · Partner workspace</p><p className="mt-3 text-sm text-neutral-500">{state.project.project_number}</p><h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-[-0.035em] md:text-5xl">{state.project.title}</h1></div>
        <div className="min-w-[230px] border-l border-black/10 pl-6"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Execution Partner</p><p className="mt-2 text-lg font-semibold">{state.partner?.company_name||'Execution Partner'}</p><p className="mt-2 text-sm text-neutral-500">Due {date(state.execution.committed_due_date||state.project.due_date)}</p></div>
      </header>

      <section className="grid border-b border-black/10 md:grid-cols-3" aria-label="Partner work sequence">
        {journey.map((item,index)=>{const status=index<journeyIndex?'complete':index===journeyIndex?'current':'future';return <div key={item} className={`relative px-0 py-5 md:px-5 ${index>0?'border-t md:border-l md:border-t-0 border-black/10':''}`}><div className="flex items-center gap-3"><span className={`flex h-7 w-7 items-center justify-center border text-xs font-semibold ${status==='complete'?'border-black bg-black text-white':status==='current'?'border-black text-black':'border-black/15 text-neutral-400'}`}>{status==='complete'?'✓':index+1}</span><div><p className={`text-sm font-semibold ${status==='future'?'text-neutral-400':''}`}>{item}</p>{status==='current'?<p className="mt-1 text-xs text-neutral-500">Current</p>:null}</div></div></div>})}
      </section>

      {message?<div className="mt-6 border-l-2 border-black bg-white/60 px-5 py-4 text-sm" role="status">{message}</div>:null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.45fr_0.55fr]">
        <div className="grid content-start gap-7">
          <section className="border border-black/10 bg-white/45 p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Your work now</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">{partnerView.status}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{partnerView.summary}</p></div><div className="min-w-[190px]"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Current responsibility</p><p className="mt-2 text-sm font-semibold">{partnerView.owner}</p><p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Next</p><p className="mt-2 text-sm font-semibold">{partnerView.next}</p></div></div>
            <div className="mt-7 flex flex-wrap gap-3">
              {!commenced&&canRaisePreCommencement?<button className={primaryButton} onClick={()=>setMode('commencement')}>Confirm commencement</button>:null}
              {!commenced&&canRaisePreCommencement?<button className={quietButton} onClick={()=>setMode('exception')}>Raise blocker</button>:null}
              {commenced&&canReport?<button className={quietButton} onClick={()=>setMode('progress')}>Progress update</button>:null}
              {commenced&&canReport?<button className={quietButton} onClick={()=>setMode('exception')}>Raise exception</button>:null}
              {commenced&&canReport?<button className={primaryButton} onClick={()=>setMode('delivery')}>{correction?'Submit revised delivery':'Submit final delivery'}</button>:null}
            </div>
          </section>

          <section className="grid gap-px border border-black/10 bg-black/10 sm:grid-cols-4">
            <div className="bg-[#f5f4ef] p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Delivery health</p><p className="mt-2 text-lg font-semibold">{openExceptions.length?'Blocked':latestHealth}</p></div>
            <div className="bg-[#f5f4ef] p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Progress</p><p className="mt-2 text-lg font-semibold">{latestPercent===null?'Not stated':`${latestPercent}%`}</p></div>
            <div className="bg-[#f5f4ef] p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Open exceptions</p><p className="mt-2 text-lg font-semibold">{openExceptions.length}</p></div>
            <div className="bg-[#f5f4ef] p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Forecast</p><p className="mt-2 text-lg font-semibold">{date(latest?.forecast_delivery_date||state.commencement?.forecast_delivery_date||state.execution.committed_due_date)}</p></div>
          </section>

          <section className="grid gap-5 border-t border-black/10 pt-7"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Activity</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Partner-reported evidence</h2><p className="mt-2 text-sm text-neutral-500">A simple history of progress, exceptions and submitted deliveries.</p></div>
            {timeline.length?<div className="grid">{timeline.map((item,index)=><article key={`${item.kind}-${index}`} className="grid gap-2 border-t border-black/10 py-5 md:grid-cols-[180px_1fr_auto]"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">{item.kind}</p><div><strong className="text-sm">{item.title}</strong><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-600">{item.detail}</p></div><time className="text-xs text-neutral-500">{date(item.at)}</time></article>)}</div>:<div className="border-t border-black/10 py-6 text-sm text-neutral-500">No Partner updates have been recorded after commencement.</div>}
          </section>
        </div>

        <aside className="grid content-start gap-7 lg:sticky lg:top-8 lg:self-start">
          <section className="border-t-2 border-black pt-5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Controlled basis</p><h2 className="mt-2 text-xl font-semibold">Work only to this release.</h2>
            {state.controlled_scope?<><Fact label="Controlled scope" value={<><span>{state.controlled_scope.reference}</span><span className="mt-1 block font-normal text-neutral-500">{state.controlled_scope.title}{state.controlled_scope.revision_code?` · ${state.controlled_scope.revision_code}`:''}</span></>}/><Fact label="Scope status" value={pretty(state.controlled_scope.status)}/></>:<div className="mt-5 border-l-2 border-orange-500 pl-4 text-sm leading-6 text-neutral-600">No controlled execution scope is linked. Do not commence work.</div>}
            <Fact label="Reporting" value={deliverySubmitted?'No further update due':pretty(state.execution.reporting_cadence)}/>
            {state.execution.release_notes?<Fact label="Release instructions" value={<p className="whitespace-pre-wrap font-normal leading-6">{state.execution.release_notes}</p>}/>:null}
          </section>
          {deliverySubmitted?<section className="border-t border-black/10 pt-5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Work handed back</p><p className="mt-2 text-lg font-semibold">Overflow Partner is reviewing your delivery.</p><p className="mt-2 text-sm leading-6 text-neutral-600">No further Partner action is required unless changes are formally requested. If that happens, this workspace will reopen with the revised work required.</p></section>:null}
        </aside>
      </div>
    </div>

    {mode==='commencement'?<Drawer eyebrow="Partner work" title="Confirm commencement" onClose={()=>setMode(null)}><form className="grid gap-7" onSubmit={event=>submit(event,'commencement')}><p className="text-sm leading-6 text-neutral-600">Confirm that the controlled scope, inputs and capacity are ready. This is the point at which Partner work officially begins.</p><div className="grid gap-7 md:grid-cols-2"><label className={label}>Execution lead<input className={field} name="execution_lead_name" required/></label><label className={label}>Role<input className={field} name="execution_lead_role"/></label><label className={label}>Planned commencement<input className={field} name="planned_commencement_date" type="date" required defaultValue={state.execution.planned_start_date||state.project.start_date||''}/></label><label className={label}>Forecast delivery<input className={field} name="forecast_delivery_date" type="date" required defaultValue={state.execution.committed_due_date||state.project.due_date||''}/></label></div><div className="grid gap-3 text-sm leading-6">{[['scope_reviewed','I have reviewed the controlled execution scope and release instructions.'],['inputs_received','The technical inputs required to start work have been received.'],['capacity_confirmed','We have the capacity and capability to carry out the assigned work.'],['no_unresolved_blocker','There is no unresolved blocker preventing commencement.']].map(([name,text])=><label key={name} className="flex items-start gap-3"><input className="mt-1" type="checkbox" name={name} value="true" required/><span>{text}</span></label>)}</div><label className={label}>Assumptions / note<textarea className={`${field} min-h-24 resize-y normal-case tracking-normal`} name="assumptions"/></label><div className="grid gap-7 md:grid-cols-2"><label className={label}>Submitted by<input className={field} name="submitted_by_name" required/></label><label className={label}>Role<input className={field} name="submitted_by_role"/></label></div><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" name="declaration_checked" value="true" required/><span>We confirm that work is commencing against the controlled project scope and that the statements above are accurate.</span></label><button disabled={submitting||!state.controlled_scope} className={primaryButton}>{submitting?'Recording…':'Confirm commencement'}</button></form></Drawer>:null}

    {mode==='progress'?<Drawer eyebrow="Partner work" title="Progress update" onClose={()=>setMode(null)}><form onSubmit={event=>submit(event,'progress')} className="grid gap-7"><p className="text-sm leading-6 text-neutral-600">Report delivery health separately from percentage complete. Use an exception for anything that needs action from Overflow Partner or the client.</p><div className="grid gap-7 md:grid-cols-2"><label className={label}>Delivery health<select className={field} name="progress_state" required defaultValue="on_track"><option value="on_track">On track</option><option value="at_risk">At risk</option><option value="blocked">Blocked</option></select></label><label className={label}>Progress %<input className={field} name="percent_complete" type="number" min="0" max="100" step="1"/></label></div><label className={label}>Work completed since last update<textarea className={`${field} min-h-24 resize-y normal-case tracking-normal`} name="work_completed" required/></label><label className={label}>Work currently in progress<textarea className={`${field} min-h-24 resize-y normal-case tracking-normal`} name="work_in_progress" required/></label><div className="grid gap-7 md:grid-cols-2"><label className={label}>Forecast delivery<input className={field} name="forecast_delivery_date" type="date"/></label><label className={label}>Next update date<input className={field} name="next_update_date" type="date"/></label></div><label className={label}>Notes<textarea className={`${field} min-h-20 resize-y normal-case tracking-normal`} name="notes"/></label><div className="grid gap-7 md:grid-cols-2"><label className={label}>Submitted by<input className={field} name="submitted_by_name" required/></label><label className={label}>Role<input className={field} name="submitted_by_role"/></label></div><button disabled={submitting} className={primaryButton}>{submitting?'Recording…':'Submit update'}</button></form></Drawer>:null}

    {mode==='exception'?<Drawer eyebrow="Partner work" title={commenced?'Raise execution exception':'Raise commencement blocker'} onClose={()=>setMode(null)}><form onSubmit={event=>submit(event,'exception')} className="grid gap-7"><p className="text-sm leading-6 text-neutral-600">Use this when a risk, missing input or blocker needs an explicit response. Do not hide delivery-impacting issues inside a progress note.</p><div className="grid gap-7 md:grid-cols-2"><label className={label}>Severity<select className={field} name="severity" required defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className={label}>Action required from<select className={field} name="required_from" required defaultValue="overflow_partner"><option value="overflow_partner">Overflow Partner</option><option value="client">Client</option><option value="partner">Execution Partner</option><option value="unknown">To be determined</option></select></label></div><label className={label}>Exception title<input className={field} name="title" required/></label><label className={label}>Description<textarea className={`${field} min-h-28 resize-y normal-case tracking-normal`} name="description" required/></label><label className={label}>Delivery impact<textarea className={`${field} min-h-20 resize-y normal-case tracking-normal`} name="delivery_impact"/></label><div className="grid gap-7 md:grid-cols-2"><label className={label}>Raised by<input className={field} name="submitted_by_name" required/></label><label className={label}>Role<input className={field} name="submitted_by_role"/></label></div><button disabled={submitting} className={primaryButton}>{submitting?'Recording…':'Raise exception'}</button></form></Drawer>:null}

    {mode==='delivery'?<Drawer eyebrow="Partner delivery" title={correction?'Submit revised engineering delivery':'Submit final engineering delivery'} onClose={()=>setMode(null)}><form onSubmit={event=>submit(event,'delivery')} className="grid gap-7"><p className="text-sm leading-6 text-neutral-600">Submitting this package hands the work back to Overflow Partner for internal review. It does not issue anything to the client.</p><label className={label}>Revision / submission reference<input className={field} name="revision" placeholder="Rev A"/></label><label className={label}>Delivery summary<textarea className={`${field} min-h-28 resize-y normal-case tracking-normal`} name="delivery_summary" required/></label><label className={label}>Deliverables manifest<textarea className={`${field} min-h-32 resize-y normal-case tracking-normal`} name="deliverables_manifest" required placeholder="List drawings, models, CAM outputs and other deliverables included."/></label><PartnerDeliveryFiles token={token} onStateChange={setDeliveryFiles}/><div className="grid gap-7 md:grid-cols-2"><label className={label}>Submitted by<input className={field} name="submitted_by_name" required/></label><label className={label}>Role<input className={field} name="submitted_by_role"/></label></div><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" name="declaration_checked" value="true" required/><span>We confirm that the listed outputs and attached files are submitted against the controlled project scope and that our assigned work is complete pending Overflow Partner review.</span></label><button disabled={submitting||deliveryFiles.count<1||deliveryFiles.locked} className={primaryButton}>{submitting?'Submitting…':deliveryFiles.count<1?'Attach output files first':correction?'Submit revised delivery':'Submit final delivery'}</button></form></Drawer>:null}
  </main>;
}
