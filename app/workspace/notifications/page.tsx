import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ status?: string; category?: string }>;

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(new Date(value));
}

function humanise(value: string) { return value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, organisationId } = await requireUserContext();
  const status = params.status || 'all';
  const category = params.category || 'all';
  let query = supabase.from('notification_outbox').select('id,event_key,category,recipient_email,recipient_name,subject,template_key,entity_type,entity_id,status,scheduled_for,attempts,max_attempts,provider_message_id,last_error,sent_at,created_at').eq('organisation_id', organisationId).order('created_at', { ascending: false }).limit(150);
  if (status !== 'all') query = query.eq('status', status);
  if (category !== 'all') query = query.eq('category', category);
  const { data: notifications, error } = await query;
  if (error) throw new Error(`Notification Centre could not be loaded: ${error.message}`);
  const rows = notifications || [];
  const counts = rows.reduce<Record<string, number>>((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, {});

  return <section className="notification-centre">
    <header className="notification-centre__header">
      <div><p className="eyebrow">Messages</p><h1>Notification Centre</h1><p>See transactional emails, reminders, nurture messages and delivery failures in one place.</p></div>
      <div className="notification-centre__metrics" aria-label="Notification summary"><div><span>Pending</span><strong>{counts.pending || 0}</strong></div><div><span>Sent</span><strong>{counts.sent || 0}</strong></div><div><span>Failed</span><strong>{counts.failed || 0}</strong></div></div>
    </header>

    <nav className="notification-centre__filters" aria-label="Notification filters">{['all', 'pending', 'processing', 'sent', 'failed', 'cancelled'].map((value) => <Link key={value} className={status === value ? 'active' : ''} href={`/workspace/notifications?status=${value}&category=${category}`}>{humanise(value)}</Link>)}</nav>
    <div className="notification-centre__category-filters">{['all', 'transactional', 'reminder', 'nurture', 'system'].map((value) => <Link key={value} className={category === value ? 'active' : ''} href={`/workspace/notifications?status=${status}&category=${value}`}>{humanise(value)}</Link>)}</div>

    {rows.length === 0 ? <div className="notification-centre__empty"><h2>No messages found</h2><p>There are no notifications for the selected filters.</p></div> : <div className="notification-centre__list">{rows.map((row) => <article key={row.id} className={`notification-record notification-record--${row.status}`}>
      <div className="notification-record__main"><div className="notification-record__labels"><span>{humanise(row.category)}</span><span>{humanise(row.status)}</span></div><h2>{row.subject}</h2><p>{row.recipient_name || row.recipient_email} · {row.recipient_email}</p><dl><div><dt>Trigger</dt><dd>{humanise(row.event_key)}</dd></div><div><dt>Scheduled</dt><dd>{formatDate(row.scheduled_for)}</dd></div><div><dt>Sent</dt><dd>{formatDate(row.sent_at)}</dd></div><div><dt>Attempts</dt><dd>{row.attempts} / {row.max_attempts}</dd></div></dl>{row.last_error ? <p className="notification-record__error">{row.last_error}</p> : null}</div>
      <div className="notification-record__aside"><span>{row.template_key}</span>{row.provider_message_id ? <code>{row.provider_message_id}</code> : null}{row.entity_type && row.entity_id ? <Link href={row.entity_type === 'lead' ? `/workspace/leads/${row.entity_id}` : row.entity_type === 'project' ? `/workspace/projects/${row.entity_id}` : '/workspace'}>Open related record</Link> : null}</div>
    </article>)}</div>}
  </section>;
}
