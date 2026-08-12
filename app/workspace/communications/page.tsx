import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

export const dynamic='force-dynamic';
function formatDate(value:string|null){if(!value)return 'Not scheduled';return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(value));}
function words(value:string){return value.replace(/[._-]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase())}
function tone(status:string):ProductTone{if(status==='sent')return 'complete';if(status==='failed')return 'blocked';if(['pending','processing'].includes(status))return 'waiting';return 'neutral'}
function messageHref(entityType:string|null,entityId:string|null){if(!entityId)return undefined;if(entityType==='lead')return `/workspace/communications/lead/${entityId}`;if(entityType==='project')return `/workspace/communications/project/${entityId}`;if(entityType==='prospect')return `/workspace/communications/prospect/${entityId}`;if(entityType==='quote')return `/workspace/communications/quote/${entityId}`;if(entityType==='document')return `/workspace/communications/document/${entityId}`;return undefined;}

export default async function CommunicationsPage(){
  const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('notification_outbox').select('id,event_key,category,recipient_email,recipient_name,subject,entity_type,entity_id,status,scheduled_for,sent_at,created_at').eq('organisation_id',organisationId).in('category',['transactional','reminder','nurture']).order('created_at',{ascending:false}).limit(150);
  if(error)throw new Error(`Messages could not be loaded: ${error.message}`);
  const rows=data||[];const sent=rows.filter(row=>row.status==='sent').length;const scheduled=rows.filter(row=>['pending','processing'].includes(row.status)).length;const failed=rows.filter(row=>row.status==='failed').length;

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Operations · Messages" title="Messages" description="Business correspondence sent or scheduled by governed workflows. Audit events stay in History & Audit; delivery diagnostics stay in Notifications." actions={<Link className="button secondary" href="/workspace/notifications">Notification delivery</Link>} />
    <ProductMetrics label="Message summary">
      <ProductMetric label="Sent" value={sent} detail="Delivered business messages" tone={sent?'complete':'neutral'} />
      <ProductMetric label="Scheduled" value={scheduled} detail="Pending or processing" tone={scheduled?'waiting':'neutral'} />
      <ProductMetric label="Failed" value={failed} detail="Delivery needs attention" tone={failed?'blocked':'complete'} />
      <ProductMetric label="Recent messages" value={rows.length} detail="Latest business correspondence" />
    </ProductMetrics>
    <section>
      <ProductSectionHeader eyebrow="Correspondence" title="Recent messages" />
      {rows.length===0?<ProductEmptyState title="No messages yet" description="Business correspondence created by governed workflows will appear here." />:<ProductRegister>
        {rows.map(row=>{const href=messageHref(row.entity_type,row.entity_id);return <ProductRegisterRow href={href} key={row.id}>
          <div><strong>{row.subject}</strong><p>Outbound · {row.recipient_name||row.recipient_email}</p></div>
          <ProductStatus tone={tone(row.status)}>{words(row.status)}</ProductStatus>
          <div><small>{row.sent_at?'Sent':'Scheduled'}</small><strong style={{display:'block',marginTop:3}}>{formatDate(row.sent_at||row.scheduled_for||row.created_at)}</strong></div>
          <strong>{href?'Open message history →':'Business message'}</strong>
        </ProductRegisterRow>})}
      </ProductRegister>}
    </section>
  </section>;
}
