import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(value));
}

function label(value: string) {
  return value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function CommunicationTimelinePage({ params }: { params: Promise<{ entityType: string; entityId: string }> }) {
  const { entityType, entityId } = await params;
  if (!['lead', 'project', 'prospect', 'quote', 'document'].includes(entityType)) notFound();

  const { supabase, organisationId } = await requireUserContext();
  const [eventsResult, notificationsResult] = await Promise.all([
    supabase.from('activity_events')
      .select('id,event_type,event_data,created_at,user_id')
      .eq('organisation_id', organisationId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('notification_outbox')
      .select('id,event_key,category,recipient_email,recipient_name,subject,status,scheduled_for,sent_at,created_at,last_error,provider_message_id')
      .eq('organisation_id', organisationId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  if (eventsResult.error) throw new Error(`Audit history could not be loaded: ${eventsResult.error.message}`);
  if (notificationsResult.error) throw new Error(`Communication history could not be loaded: ${notificationsResult.error.message}`);

  const timeline = [
    ...(eventsResult.data || []).map((event) => ({
      id: `event-${event.id}`,
      kind: 'audit' as const,
      title: label(event.event_type),
      summary: 'Governed workflow event',
      status: 'recorded',
      at: event.created_at,
      detail: event.event_data,
      recipient: null,
      error: null,
    })),
    ...(notificationsResult.data || []).map((notification) => ({
      id: `notification-${notification.id}`,
      kind: 'email' as const,
      title: notification.subject,
      summary: label(notification.event_key),
      status: notification.status,
      at: notification.sent_at || notification.scheduled_for || notification.created_at,
      detail: { category: notification.category, providerMessageId: notification.provider_message_id },
      recipient: notification.recipient_name || notification.recipient_email,
      error: notification.last_error,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const backHref = entityType === 'lead' ? `/workspace/leads/${entityId}` : entityType === 'project' ? `/workspace/projects/${entityId}` : '/workspace/notifications';

  return <section className="notification-centre communication-timeline">
    <header className="notification-centre__header">
      <div>
        <p className="eyebrow">Audit and communication evidence</p>
        <h1>Communication Timeline</h1>
        <p>{label(entityType)} · {entityId}</p>
      </div>
      <Link className="button secondary" href={backHref}>Back to record</Link>
    </header>

    {timeline.length === 0 ? <div className="notification-centre__empty"><h2>No communication evidence yet</h2><p>Workflow actions and outbound messages will appear here.</p></div> : <div className="communication-timeline__list">
      {timeline.map((item) => <article key={item.id} className={`communication-event communication-event--${item.kind}`}>
        <div className="communication-event__marker" aria-hidden="true" />
        <div className="communication-event__content">
          <div className="communication-event__meta"><span>{item.kind === 'email' ? 'Outbound email' : 'Audit event'}</span><span>{formatDate(item.at)}</span></div>
          <h2>{item.title}</h2>
          <p>{item.summary}{item.recipient ? ` · ${item.recipient}` : ''}</p>
          <div className="communication-event__status">{label(item.status)}</div>
          {item.error ? <p className="notification-record__error">{item.error}</p> : null}
          <details><summary>Evidence</summary><pre>{JSON.stringify(item.detail || {}, null, 2)}</pre></details>
        </div>
      </article>)}
    </div>}
  </section>;
}
