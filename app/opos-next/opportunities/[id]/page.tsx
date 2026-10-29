import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import css from '../../opos.module.css';

function humanStatus(status: string | null | undefined) {
  return (status || 'not recorded').replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());
}
function dateLabel(iso: string | null | undefined) {
  return iso ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(iso)) : 'Not recorded';
}

export default async function OpportunityPreview({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organisationId } = await requireUserContext();
  const [prospectResult, sessionResult] = await Promise.all([
    supabase.from('prospects')
      .select('id,company_name,source,status,next_action,created_at,converted_lead_id')
      .eq('organisation_id', organisationId).eq('id', id).maybeSingle(),
    supabase.from('intake_sessions')
      .select('id,status,created_at,expires_at,opened_at,submitted_at')
      .eq('organisation_id', organisationId).eq('prospect_id', id)
      .order('created_at',{ascending:false}).limit(1).maybeSingle(),
  ]);
  if (prospectResult.error || sessionResult.error) throw new Error('Opportunity state could not be loaded.');
  const prospect = prospectResult.data;
  if (!prospect) notFound();
  const session = sessionResult.data;
  const hasSubmitted = !!session && ['submitted','converted'].includes(session.status);
  const waiting = !!session && !hasSubmitted && ['invited','opened','in_progress'].includes(session.status);
  const converted = !!prospect.converted_lead_id;
  const headline = converted ? 'Commercial work is now in Case 360' :
    hasSubmitted ? 'Requirements received' :
    waiting ? 'Waiting for customer requirements' :
    !session ? 'Secure requirements invitation needed' :
    'Review the requirements invitation';
  const description = converted
    ? 'The accepted opportunity has moved to the governed commercial record.'
    : hasSubmitted
      ? 'The customer submitted their technical requirements. The next qualified review is managed by the operating workflow.'
      : waiting
        ? 'A secure requirements session exists. Customer submission is outstanding.'
        : !session
          ? 'No technical intake session is recorded for this opportunity.'
          : 'The current intake session is not active. The operator must review the governed record.';
  return <article aria-labelledby="opos-record-heading">
    <Link href="/opos-next/opportunities" className={css.backLink}>← All opportunities</Link>
    <header className={css.pageHeader}>
      <p className={css.eyebrow}>WORK / OPPORTUNITY</p>
      <h1 className={css.title} id="opos-record-heading">{prospect.company_name || 'Opportunity'}</h1>
      <div className={css.factRow}>
        <span>Source: <strong>{prospect.source === 'website' ? 'Website enquiry' : prospect.source === 'linkedin' ? 'LinkedIn' : (prospect.source || 'Other')}</strong></span>
        <span>Record: <strong>{humanStatus(prospect.status)}</strong></span>
      </div>
    </header>
    <section className={css.card} aria-label="Current operating state">
      <span className={css.overline}>{waiting ? 'Current position / Awaiting customer' : 'Current position'}</span>
      <h2 className={css.cardTitle}>{headline}</h2>
      <p className={css.cardDescription}>{description}</p>
      {session ? <p className={css.factRow}>
        <span>Requirements: <strong>{humanStatus(session.status)}</strong></span>
        <span>Session created: <strong>{dateLabel(session.created_at)}</strong></span>
        {waiting ? <span>Link expires: <strong>{dateLabel(session.expires_at)}</strong></span> : null}
      </p> : null}
      <p className={css.meta} style={{marginTop:20}}>
        Email delivery cannot be independently confirmed from the intake session alone. This preview does not claim a message was delivered.
      </p>
      {waiting ? <p className={css.meta} style={{ marginTop: 17 }}>No action is required from the operator while the customer completes the form.</p> : <Link href={'/workspace/acquisition/' + id} className={css.action}>Continue in operating workspace →</Link>}
    </section>
    <details className={css.details}>
      <summary>Stage and record context</summary>
      <div className={css.detailsContent}>
        <p>Opportunity opened: {dateLabel(prospect.created_at)}</p>
        <p>Technical intake: {session ? humanStatus(session.status) : 'Not yet requested'}</p>
        <p>Next action stored on record: {prospect.next_action || 'Not recorded'}</p>
        {waiting ? <p><Link href={'/workspace/acquisition/' + id} className={css.secondaryLink}>Open existing operational record ↗</Link></p> : null}
      </div>
    </details>
    <p className={css.meta} style={{marginTop:28}}>Read-only implementation preview. Financial, technical and contractual decisions remain governed by the existing application.</p>
  </article>;
}
