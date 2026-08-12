import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import {
  ProductEmptyState,
  ProductMetric,
  ProductMetrics,
  ProductPageHeader,
  ProductRegister,
  ProductRegisterRow,
  ProductSectionHeader,
  ProductStatus,
  type ProductTone,
} from '@/components/workspace/ProductUI';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(value));
}

function label(value: string | null | undefined) {
  return String(value || '').replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tone(status: string): ProductTone {
  if (status === 'sent') return 'complete';
  if (status === 'failed') return 'blocked';
  if (['pending', 'processing'].includes(status)) return 'waiting';
  return 'neutral';
}

function recordHref(entityType: string, entityId: string) {
  if (entityType === 'lead') return `/workspace/leads/${entityId}`;
  if (entityType === 'project') return `/workspace/projects/${entityId}`;
  if (entityType === 'prospect') return `/workspace/acquisition/${entityId}`;
  if (entityType === 'quote') return '/workspace/quotes';
  if (entityType === 'document') return `/workspace/documents/${entityId}`;
  return '/workspace';
}

export default async function RecordMessagesPage({ params }: { params: Promise<{ entityType: string; entityId: string }> }) {
  const { entityType, entityId } = await params;
  if (!['lead', 'project', 'prospect', 'quote', 'document'].includes(entityType)) notFound();

  const { supabase, organisationId } = await requireUserContext();
  const { data, error } = await supabase.from('notification_outbox')
    .select('id,event_key,category,recipient_email,recipient_name,subject,status,scheduled_for,sent_at,created_at,last_error')
    .eq('organisation_id', organisationId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .in('category', ['transactional', 'reminder', 'nurture'])
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(`Messages could not be loaded: ${error.message}`);

  const messages = data || [];
  const sent = messages.filter((message) => message.status === 'sent').length;
  const scheduled = messages.filter((message) => ['pending', 'processing'].includes(message.status)).length;
  const failed = messages.filter((message) => message.status === 'failed').length;
  const backHref = recordHref(entityType, entityId);

  return <section className="vp-page">
    <ProductPageHeader
      eyebrow="Operations · Messages"
      title="Messages"
      description="Business correspondence linked to this record. Workflow events and governance trace stay in History & Audit rather than appearing as messages."
      backHref={backHref}
      backLabel="Back to record"
      actions={<Link className="button secondary" href="/workspace/communications">All messages</Link>}
    />

    <ProductMetrics label="Message summary">
      <ProductMetric label="Sent" value={sent} detail="Delivered business messages" tone={sent ? 'complete' : 'neutral'} />
      <ProductMetric label="Scheduled" value={scheduled} detail="Pending or processing" tone={scheduled ? 'waiting' : 'neutral'} />
      <ProductMetric label="Failed" value={failed} detail="Delivery needs attention" tone={failed ? 'blocked' : 'complete'} />
      <ProductMetric label="Record" value={label(entityType)} detail="Messages are scoped to this record only" />
    </ProductMetrics>

    <section>
      <ProductSectionHeader eyebrow="Correspondence" title="Message history" meta={`${messages.length} message${messages.length === 1 ? '' : 's'}`} />
      {messages.length === 0 ? <ProductEmptyState title="No messages yet" description="Business messages sent or scheduled for this record will appear here. Audit events remain in History & Audit." /> : <ProductRegister>
        {messages.map((message) => <ProductRegisterRow key={message.id}>
          <div>
            <strong>{message.subject}</strong>
            <p>Outbound · {message.recipient_name || message.recipient_email}</p>
            {message.last_error ? <small>{message.last_error}</small> : null}
          </div>
          <ProductStatus tone={tone(message.status)}>{label(message.status)}</ProductStatus>
          <div>
            <small>{message.sent_at ? 'Sent' : 'Scheduled'}</small>
            <strong style={{ display: 'block', marginTop: 3 }}>{formatDate(message.sent_at || message.scheduled_for || message.created_at)}</strong>
          </div>
          <div>
            <small>Purpose</small>
            <strong style={{ display: 'block', marginTop: 3 }}>{label(message.event_key)}</strong>
          </div>
        </ProductRegisterRow>)}
      </ProductRegister>}
    </section>
  </section>;
}
