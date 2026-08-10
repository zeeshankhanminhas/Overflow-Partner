import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

export const dynamic='force-dynamic';
function formatDate(value:string|null){if(!value)return 'Not sent';return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(value));}
function words(value:string){return value.replace(/[._-]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase())}
function tone(status:string):ProductTone{if(status==='sent')return 'complete';if(status==='failed')return 'blocked';if(['pending','processing'].includes(status))return 'waiting';return 'neutral'}

export default async function CommunicationsPage(){
  const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('notification_outbox').select('id,event_key,category,recipient_email,recipient_name,subject,entity_type,entity_id,status,scheduled_for,sent_at,created_at').eq('organisation_id',organisationId).in('category',['transactional','reminder','nurture']).order('created_at',{ascending:false}).limit(150);
  if(error)throw new Error(`Communications register could not be loaded: ${error.message}`);
  const rows=data||[];const sent=rows.filter(row=>row.status==='sent').length;const scheduled=rows.filter(row=>['pending','processing'].includes(row.status)).length;const failed=rows.filter(row=>row.status==='failed').length;

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Operations · Communications" title="Communication register" description="A governed record of transactional messages, reminders and nurture activity, linked back to the Case or Project that caused them." actions={<Link className="button secondary" href="/workspace/notifications">Attention Centre</Link>} />
    <ProductMetrics label="Communication delivery summary">
      <ProductMetric label="Sent" value={sent} detail="Successfully delivered messages" tone={sent?'complete':'neutral'} />
      <ProductMetric label="Scheduled" value={scheduled} detail="Pending or processing" tone={scheduled?'waiting':'neutral'} />
      <ProductMetric label="Failed" value={failed} detail="Needs delivery intervention" tone={failed?'blocked':'complete'} />
      <ProductMetric label="Recent register" value={rows.length} detail="Latest governed messages loaded" />
    </ProductMetrics>
    <section>
      <ProductSectionHeader eyebrow="Governed record" title="Recent communications" />
      {rows.length===0?<ProductEmptyState title="No business communications yet" description="Messages created by workflow events will appear here automatically." />:<ProductRegister>
        {rows.map(row=>{const href=row.entity_type==='lead'&&row.entity_id?`/workspace/communications/lead/${row.entity_id}`:row.entity_type==='project'&&row.entity_id?`/workspace/communications/project/${row.entity_id}`:undefined;return <ProductRegisterRow href={href} key={row.id}>
          <div><strong>{row.subject}</strong><p>{row.recipient_name||row.recipient_email} · {words(row.category)}</p></div>
          <ProductStatus tone={tone(row.status)}>{words(row.status)}</ProductStatus>
          <div><small>{row.sent_at?'Sent':'Scheduled'}</small><strong style={{display:'block',marginTop:3}}>{formatDate(row.sent_at||row.scheduled_for)}</strong></div>
          <strong>{href?'Open record →':'System message'}</strong>
        </ProductRegisterRow>})}
      </ProductRegister>}
    </section>
  </section>;
}
