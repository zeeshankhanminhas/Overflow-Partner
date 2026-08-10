import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

function formatDate(value:string|null){return value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Not recorded'}
function tone(status:string):ProductTone{if(status==='submitted')return 'complete';if(status==='expired')return 'attention';if(['invited','opened','in_progress'].includes(status))return 'waiting';return 'neutral'}

export default async function TechnicalIntakeRegisterPage(){
  const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('intake_sessions').select('id,status,sent_at,opened_at,submitted_at,expires_at,prospect_id,prospects(company_name,contact_name,email)').eq('organisation_id',organisationId).order('created_at',{ascending:false});
  if(error)throw new Error(`Technical intake register could not be loaded: ${error.message}`);
  const rows=(data||[]) as any[];const waiting=rows.filter(row=>['invited','opened','in_progress'].includes(row.status)).length;const submitted=rows.filter(row=>row.status==='submitted').length;const expired=rows.filter(row=>row.status==='expired').length;
  return <section className="vp-page">
    <ProductPageHeader eyebrow="Work · Acquisition" title="Technical intake register" description="Internal monitoring for secure customer intake sessions. Manage the intake from the Prospect record; this register is for workload and status visibility." actions={<Link className="button secondary" href="/workspace/acquisition">Acquisition overview</Link>} />
    <ProductMetrics label="Intake status summary"><ProductMetric label="Waiting" value={waiting} detail="Invited, opened or in progress" tone={waiting?'waiting':'neutral'}/><ProductMetric label="Submitted" value={submitted} detail="Ready for internal review" tone={submitted?'complete':'neutral'}/><ProductMetric label="Expired" value={expired} detail="Requires a new intake decision" tone={expired?'attention':'complete'}/><ProductMetric label="Sessions" value={rows.length} detail="Total intake records loaded"/></ProductMetrics>
    <section><ProductSectionHeader eyebrow="Internal register" title="Customer intake sessions" />{rows.length===0?<ProductEmptyState title="No intake sessions yet" description="Create the intake from the relevant Prospect when customer technical information is required."/>:<ProductRegister>{rows.map(row=>{const prospect=Array.isArray(row.prospects)?row.prospects[0]:row.prospects;return <ProductRegisterRow href={`/workspace/acquisition/${row.prospect_id}`} key={row.id}><div><strong>{prospect?.company_name||'Unknown prospect'}</strong><p>{prospect?.contact_name||prospect?.email||'Contact not recorded'} · sent {formatDate(row.sent_at)}</p></div><ProductStatus tone={tone(row.status)}>{String(row.status).replaceAll('_',' ')}</ProductStatus><div><small>{row.submitted_at?'Submitted':'Expires'}</small><strong style={{display:'block',marginTop:3}}>{formatDate(row.submitted_at||row.expires_at)}</strong></div><strong>Open Prospect →</strong></ProductRegisterRow>})}</ProductRegister>}</section>
  </section>;
}
