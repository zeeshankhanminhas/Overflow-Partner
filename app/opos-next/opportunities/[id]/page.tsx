import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import css from '../opportunity.module.css';

const date = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'}).format(new Date(value))
  : 'Not recorded';

export default async function OpportunityPreview({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const {supabase,organisationId}=await requireUserContext();
  const [prospectResult,sessionResult]=await Promise.all([
    supabase.from('prospects').select('id,company_name,source,status,next_action,created_at,converted_lead_id')
      .eq('organisation_id',organisationId).eq('id',id).maybeSingle(),
    supabase.from('intake_sessions').select('id,status,created_at,expires_at,opened_at,submitted_at')
      .eq('organisation_id',organisationId).eq('prospect_id',id)
      .order('created_at',{ascending:false}).limit(1).maybeSingle(),
  ]);
  if(prospectResult.error||sessionResult.error)throw new Error('Could not load this Opportunity securely.');
  const prospect=prospectResult.data;
  if(!prospect)notFound();
  const session=sessionResult.data;
  const submitted=Boolean(session&&['submitted','converted'].includes(session.status));
  const converted=Boolean(prospect.converted_lead_id);
  const waiting=Boolean(session&&!submitted&&['invited','opened','in_progress'].includes(session.status));
  const active=Boolean(session&&!submitted);
  const stageIndex=converted||submitted?2:session?1:0;
  const source=prospect.source==='website'?'Website enquiry':prospect.source==='linkedin'?'LinkedIn qualification':prospect.source||'Other enquiry';
  const headline=converted?'Opportunity handed over to Case 360':
    submitted?'Requirements received':
    waiting?'Await customer requirements':
    !session?'Requirements invitation not yet recorded':
    'Requirements session requires review';
  const description=converted?'Commercial preparation is now governed by Case 360.':
    submitted?'The customer has submitted the technical brief. Feasibility and next decisions are governed by the acquisition workflow.':
    waiting?'A secure requirements session exists and the customer submission remains outstanding. The session alone does not confirm email delivery. No operator decision is required until new evidence or an exception arises.':
    !session?'There is no Step 2 technical intake session on this record. Use the authorised Acquisition workflow to initiate the invitation.':
    'The technical intake session is not currently awaiting submission. Review the governed record before taking action.';

  return <article aria-labelledby="opos-opportunity-name">
    <div className={css.frame}>
      <div className={css.header}>
        <div><p className={css.headerTitle}>OP / OPOS</p><p className={css.headerDescription}>Opportunity / {source}</p></div>
        <span className={css.pill}>{converted?'Case created':submitted?'Intake submitted':waiting?'Intake pending':'Needs review'}</span>
      </div>
      <div className={css.rule}/>
      <h1 id="opos-opportunity-name" className={css.title}>{prospect.company_name||'Opportunity'}</h1>
      <p className={css.subtitle}>OP-{prospect.id.slice(0,8).toUpperCase()} · {source}</p>

      <section className={css.section} aria-label="Current operating position">
        <p className={css.overline}>CURRENT POSITION</p>
        <h2 className={css.position}>{headline}</h2>
        <p className={css.description}>{description}</p>
        <div className={css.badges}>
          <span className={css.pill + ' ' + (submitted||converted?css.pillOk:'')}>
            <span className={css.dot}/>
            {submitted||converted?'Customer requirements received':session?'Secure intake session recorded':'Invitation not recorded'}
          </span>
          {waiting?<span className={css.pill}><span className={css.dot}/> Awaiting submission</span>:null}
        </div>
        <p className={css.note}>Email delivery cannot be independently confirmed from the intake session alone. This preview does not claim a message was delivered.</p>
      </section>

      <section className={css.section} aria-labelledby="op-journey">
        <h2 className={css.sectionHeading} id="op-journey">Journey progress</h2>
        <div className={css.journey}>
          {['Enquiry','Requirements','Feasibility'].map((label,index)=>{
            const done=index<stageIndex;
            const current=index===stageIndex;
            return <div className={css.stage} key={label}>
              <div className={css.stageTop}>
                <span className={css.stageNumber}>{String(index+1).padStart(2,'0')}</span>
                <span className={css.stageSign + (done?' '+css.stageComplete:'')} aria-label={done?'Completed':current?'Current':'Upcoming'}>{done?'✓':current?'◉':'○'}</span>
              </div>
              <strong className={css.stageName}>{label}</strong>
            </div>;
          })}
        </div>
      </section>

      <section className={css.section} aria-labelledby="op-evidence">
        <div className={css.headingRow}><h2 className={css.sectionHeading} id="op-evidence">Activity and evidence</h2>
          <a href="#op-full-history" className={css.secondary}>View history ↗</a>
        </div>
        <div className={css.evidenceList}>
          {session?<div className={css.evidence}><span className={css.evidenceIcon} aria-hidden="true">✉</span><div>
            <p className={css.evidenceTitle}>{submitted?'Customer technical requirements received':'Secure requirements session created'}</p>
            <p className={css.evidenceSub}>{date(submitted?session.submitted_at:session.created_at)} · {submitted?'Awaiting feasibility review':'Customer submission pending'}</p>
          </div></div>:null}
          <div className={css.evidence}><span className={css.evidenceIcon} aria-hidden="true">▣</span><div>
            <p className={css.evidenceTitle}>{prospect.source==='website'?'Website enquiry received':'Opportunity recorded'}</p>
            <p className={css.evidenceSub}>{date(prospect.created_at)} · Initial enquiry captured</p>
          </div></div>
        </div>
        <details className={css.history} id="op-full-history">
          <summary>Record context and authorised tools</summary>
          <div className={css.historyBody}>
            <p>Opportunity status: {String(prospect.status||'Not recorded').replaceAll('_',' ')}</p>
            {session?<p>Requirements session: {String(session.status).replaceAll('_',' ')} · Expiry {date(session.expires_at)}</p>:null}
            <p>Next step recorded: {prospect.next_action||'Not recorded'}</p>
            <p><Link className={css.secondary} href={'/workspace/acquisition/'+id}>Open governed operational record ↗</Link></p>
          </div>
        </details>
      </section>
    </div>
    <p className={css.footer}>Real OPOS record · Read-only redesign preview. Business actions remain governed by the existing workflow.</p>
  </article>;
}
