import Link from 'next/link';
import ProspectForm from '@/components/workspace/ProspectForm';
import TechnicalPartnerReviewPanel from '@/components/workspace/TechnicalPartnerReviewPanel';
import { convertProspectFormAction, createStep2InvitationFormAction } from './actions';
import { requireUserContext } from '@/lib/auth/context';
import { listProspects } from '@/lib/repositories/prospects';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';

type IntakeSubmission = {
  intake_session_id: string;
  description: string;
  deliverables: string;
  project_type: string;
  discipline: string | null;
  software: string | null;
  drawing_count: number | null;
  source_file_format: string | null;
  required_output_format: string | null;
  deadline: string | null;
  timeline: string | null;
  complexity: string | null;
  files_availability: string | null;
  standards: string | null;
  tolerances: string | null;
  revision_status: string | null;
  special_instructions: string | null;
  submitted_at: string;
};

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not yet';
}
function displayValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? 'Not specified' : String(value);
}
function deliverableItems(value: string | null | undefined) {
  return value ? value.split(/\r?\n|,\s*/).map((item) => item.trim()).filter(Boolean) : [];
}
function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="vp-fact"><small>{label}</small><strong>{displayValue(value)}</strong></div>;
}

function TechnicalBrief({ submission }: { submission: IntakeSubmission }) {
  const deliverables = deliverableItems(submission.deliverables);
  return <div style={{display:'grid',gap:18}}>
    <div className="vp-section-title"><div><p className="vp-label">Structured technical brief</p><h2>{submission.discipline || submission.project_type}</h2></div><span className="vp-row-status">Submitted {dateTime(submission.submitted_at)}</span></div>
    <div className="vp-facts" style={{marginTop:0}}>
      <Fact label="Discipline" value={submission.discipline}/><Fact label="Software" value={submission.software}/><Fact label="Complexity" value={submission.complexity}/><Fact label="Timeline" value={submission.timeline}/><Fact label="Deadline" value={submission.deadline}/><Fact label="Files available" value={submission.files_availability}/><Fact label="Source format" value={submission.source_file_format}/><Fact label="Primary output" value={submission.required_output_format}/><Fact label="Revision status" value={submission.revision_status}/><Fact label="Drawing count" value={submission.drawing_count}/>
    </div>
    <div><p className="vp-label">Deliverables</p><div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>{deliverables.length?deliverables.map(item=><span className="vp-row-status" key={item} style={{border:'1px solid var(--op-line)',borderRadius:6,padding:'7px 9px',background:'rgba(255,255,255,.025)'}}>{item}</span>):<span>Not specified</span>}</div></div>
    <div><p className="vp-label">Description</p><p style={{whiteSpace:'pre-wrap',lineHeight:1.7}}>{submission.description}</p></div>
    {(submission.standards || submission.tolerances) ? <div className="vp-facts" style={{marginTop:0}}><Fact label="Standards and specifications" value={submission.standards}/><Fact label="Critical tolerances" value={submission.tolerances}/></div> : null}
    {submission.special_instructions ? <div className="vp-callout"><strong>Engineering notes</strong><p style={{whiteSpace:'pre-wrap'}}>{submission.special_instructions}</p></div> : null}
  </div>;
}

export default async function AcquisitionPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const [prospects, companies, contacts, sessionsResult, submissionsResult] = await Promise.all([
    listProspects(supabase, organisationId), listCompanies(supabase, organisationId), listContacts(supabase, organisationId),
    supabase.from('intake_sessions').select('id,prospect_id,status,expires_at,sent_at,opened_at,submitted_at').eq('organisation_id', organisationId).order('created_at', { ascending: false }),
    supabase.from('intake_submissions').select('intake_session_id,description,deliverables,project_type,discipline,software,drawing_count,source_file_format,required_output_format,deadline,timeline,complexity,files_availability,standards,tolerances,revision_status,special_instructions,submitted_at').eq('organisation_id', organisationId).order('submitted_at', { ascending: false }),
  ]);
  const sessions = sessionsResult.data || [];
  const submissions = (submissionsResult.data || []) as IntakeSubmission[];
  const sessionByProspect = new Map(sessions.map((session) => [session.prospect_id, session]));
  const submissionBySession = new Map(submissions.map((submission) => [submission.intake_session_id, submission]));
  const waiting = sessions.filter((session) => ['invited','opened','in_progress'].includes(session.status)).length;
  const technicalPending = sessions.filter((session) => session.status === 'submitted').length;
  const qualified = prospects.filter((prospect) => prospect.status === 'qualified').length;

  return <section className="vp-page acquisition-workspace">
    <header className="vp-header">
      <div><p className="vp-kicker">Acquire · Operating workspace</p><h1>Governed pre-case pipeline.</h1><p className="vp-subtitle">Capture the opportunity, obtain structured technical evidence, complete partner review and qualify the requirement before Case 360 is created.</p></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="button secondary" href="/workspace/acquisition/prospects">Prospect register</Link><Link className="button secondary" href="/workspace/acquisition/intake">Technical intake</Link></div>
    </header>

    {params.created ? <div className="vp-callout"><strong>Prospect added</strong><p>The acquisition record is available below.</p></div> : null}
    {params.technical_review ? <div className="vp-callout"><strong>Technical review recorded</strong><p>{String(params.technical_review).replaceAll('_',' ')}.</p></div> : null}
    {params.qualified ? <div className="vp-callout"><strong>Commercial qualification approved</strong><p>The prospect can now be converted to Case 360.</p></div> : null}
    {params.error ? <div className="vp-callout"><strong>Action could not be completed</strong><p>{String(params.error)}</p></div> : null}

    <section className="vp-object vp-object--hero"><p className="vp-label">Acquisition position</p><div className="vp-compact-metrics"><div className="vp-metric"><span>Awaiting customer</span><strong>{waiting}</strong></div><div className="vp-metric"><span>Technical review pending</span><strong>{technicalPending}</strong></div><div className="vp-metric"><span>Qualified for conversion</span><strong>{qualified}</strong></div></div></section>

    <details className="vp-disclosure"><summary>Add a prospect manually</summary><div>{companies.length ? <ProspectForm companies={companies} contacts={contacts} /> : <div className="vp-empty">Create the first company before adding a manual prospect. <Link href="/workspace/companies">Add company →</Link></div>}</div></details>

    <section>
      <div className="vp-section-title"><div><p className="vp-label">Live acquisition queue</p><h2>Prospects requiring movement</h2></div><span>{prospects.length} records</span></div>
      <div className="vp-list">
        {prospects.length===0 ? <div className="vp-empty">No prospects have been captured yet.</div> : prospects.map((prospect) => {
          const session = sessionByProspect.get(prospect.id);
          const submission = session ? submissionBySession.get(session.id) : undefined;
          const requirementSummary = (prospect as typeof prospect & { requirement_summary?: string | null }).requirement_summary;
          return <article className="acquisition-record" key={prospect.id} style={{padding:'18px 20px',borderTop:'1px solid var(--op-line)'}}>
            <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:18,alignItems:'start'}}>
              <div><h3 style={{margin:0}}>{prospect.company_name}</h3><p style={{margin:'5px 0 0',color:'var(--op-muted)'}}>{[prospect.contact_name, prospect.job_title].filter(Boolean).join(' · ') || 'Contact not added'} · {prospect.source}</p></div>
              <span className="vp-row-status">{prospect.status.replaceAll('_',' ')}</span>
            </div>
            <div className="vp-facts" style={{marginTop:14}}><Fact label="Initial requirement" value={requirementSummary}/><Fact label="Next permitted movement" value={prospect.next_action}/>{session?<Fact label="Step 2 status" value={session.status.replaceAll('_',' ')}/>:<Fact label="Step 2 status" value="Not created"/>}</div>

            {session ? <div style={{marginTop:14,color:'var(--op-muted)',fontSize:12}}>Sent {dateTime(session.sent_at)} · Opened {dateTime(session.opened_at)} · Submitted {dateTime(session.submitted_at)} · Expires {dateTime(session.expires_at)}</div> : null}

            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16}}>
              {prospect.company_id ? <Link className="button secondary" href={`/workspace/companies/${prospect.company_id}`}>Open company</Link> : null}
              {!session && prospect.status !== 'converted' ? <form action={createStep2InvitationFormAction}><input type="hidden" name="prospect_id" value={prospect.id}/><button className="button secondary" type="submit">Create Step 2 intake</button></form> : null}
              {prospect.status === 'qualified' ? <form action={convertProspectFormAction}><input type="hidden" name="prospect_id" value={prospect.id}/><button className="button" type="submit">Create governed Case 360</button></form> : null}
            </div>

            {submission ? <details className="vp-disclosure" style={{marginTop:16}}><summary>Technical evidence and partner review</summary><div style={{display:'grid',gap:20}}><TechnicalBrief submission={submission}/><section style={{borderTop:'1px solid var(--op-line)',paddingTop:18}}><p className="vp-label">Engineering gate</p><TechnicalPartnerReviewPanel prospectId={prospect.id} intakeSessionId={session!.id} prospectStatus={prospect.status}/></section></div></details> : null}
          </article>;
        })}
      </div>
    </section>
  </section>;
}
