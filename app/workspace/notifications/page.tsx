import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { ProductDisclosure } from '@/components/workspace/InteractionPrimitives';
import {
  ProductEmptyState,
  ProductFilterBar,
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
type SearchParams = Promise<{ status?: string; category?: string }>;
function formatDate(value: string | null) {if (!value) return 'Not recorded';return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(new Date(value));}
function humanise(value: string) { return value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function tone(status:string):ProductTone{if(status==='sent')return 'complete';if(status==='failed')return 'blocked';if(['pending','processing'].includes(status))return 'waiting';return 'neutral';}
function relatedHref(entityType:string|null,entityId:string|null){if(!entityId)return undefined;if(entityType==='lead')return `/workspace/leads/${entityId}`;if(entityType==='project')return `/workspace/projects/${entityId}`;if(entityType==='prospect')return `/workspace/acquisition/${entityId}`;if(entityType==='document')return `/workspace/documents/${entityId}`;if(entityType==='quote')return '/workspace/quotes';return undefined;}

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, organisationId } = await requireUserContext();
  const status = params.status || 'all';
  const category = params.category || 'all';
  let query = supabase.from('notification_outbox').select('id,event_key,category,recipient_email,recipient_name,subject,entity_type,entity_id,status,scheduled_for,attempts,max_attempts,last_error,sent_at,created_at').eq('organisation_id', organisationId).order('created_at', { ascending: false }).limit(150);
  if (status !== 'all') query = query.eq('status', status);
  if (category !== 'all') query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw new Error(`Notification delivery could not be loaded: ${error.message}`);
  const rows=data||[];const sent=rows.filter(row=>row.status==='sent').length;const pending=rows.filter(row=>['pending','processing'].includes(row.status)).length;const failed=rows.filter(row=>row.status==='failed').length;const cancelled=rows.filter(row=>row.status==='cancelled').length;

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Admin · Notifications" title="Notification delivery" description="Monitor automated delivery health. Business correspondence belongs in Messages; operational exceptions belong in Issues." actions={<><Link className="button secondary" href="/workspace/communications">Messages</Link><Link className="button secondary" href="/workspace/exceptions">Issues</Link></>} />
    <ProductMetrics label="Delivery health"><ProductMetric label="Sent" value={sent} detail="Delivered in this view" tone={sent?'complete':'neutral'} /><ProductMetric label="Queued" value={pending} detail="Pending or processing" tone={pending?'waiting':'neutral'} /><ProductMetric label="Failed" value={failed} detail="Needs delivery intervention" tone={failed?'blocked':'complete'} /><ProductMetric label="Cancelled" value={cancelled} detail="Stopped before delivery" /></ProductMetrics>
    <ProductFilterBar>{['all','pending','processing','sent','failed','cancelled'].map(value=><Link key={value} className={`button ${status===value?'':'secondary'}`} href={`/workspace/notifications?status=${value}&category=${category}`}>{humanise(value)}</Link>)}<form method="get" className="product-toolbar__group" style={{marginLeft:'auto'}}>{status!=='all'?<input type="hidden" name="status" value={status}/>:null}<select name="category" defaultValue={category}><option value="all">All categories</option><option value="transactional">Transactional</option><option value="reminder">Reminder</option><option value="nurture">Nurture</option><option value="system">System</option></select><button className="button secondary">Filter</button></form></ProductFilterBar>
    <section>
      <ProductSectionHeader eyebrow="Delivery monitor" title={`${rows.length} notification${rows.length===1?'':'s'}`} meta="Delivery state only — not an operational issue queue." />
      {rows.length===0?<ProductEmptyState title="No notifications match this view" description="Change the delivery status or category filter to broaden the register." />:<ProductRegister>{rows.map(row=>{const href=relatedHref(row.entity_type,row.entity_id);const failedRow=row.status==='failed';return <ProductRegisterRow key={row.id} href={href}><div><strong>{row.subject}</strong><p>{row.recipient_name||row.recipient_email} · {humanise(row.category)}</p>{failedRow?<ProductDisclosure summary="Failure diagnostics"><p>{row.last_error||'No delivery error text was recorded.'}</p><small>Attempts: {row.attempts} / {row.max_attempts}</small></ProductDisclosure>:null}</div><ProductStatus tone={tone(row.status)}>{humanise(row.status)}</ProductStatus><div><small>{row.sent_at?'Sent':'Scheduled'}</small><strong style={{display:'block',marginTop:3}}>{formatDate(row.sent_at||row.scheduled_for||row.created_at)}</strong></div><strong>{href?'Open related record →':failedRow?'Review failure':'Delivery record'}</strong></ProductRegisterRow>})}</ProductRegister>}
    </section>
  </section>;
}
