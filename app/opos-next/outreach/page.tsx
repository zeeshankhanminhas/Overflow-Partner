import {requireUserContext} from '@/lib/auth/context';
import {OperatorPageIntro,OperatorRegister,type OperatorRow} from '../OperatorViews';
export default async function OutreachPage(){
  const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('linkedin_outreach_threads')
    .select('id,company_name,contact_name,state,next_follow_up_at,created_at')
    .eq('organisation_id',organisationId).order('created_at',{ascending:false}).limit(100);
  if(error)throw new Error('LinkedIn conversations could not be loaded.');
  const rows:OperatorRow[]=(data||[]).map(item=>({id:item.id,title:item.company_name,
    subtitle:item.contact_name,state:String(item.state||'identified').replaceAll('_',' '),
    next:item.state==='interested'?'Ready for CRM handoff':item.state==='waiting'?'Awaiting reply':
      item.next_follow_up_at?'Follow up '+new Date(item.next_follow_up_at).toLocaleDateString('en-GB'):'Review conversation',
    href:'/opos-next/outreach/'+item.id}));
  return <section>
    <OperatorPageIntro eyebrow="BEFORE CRM / LINKEDIN" title="Outreach" subtitle="Personal conversations remain outside CRM until interest is confirmed. No unsolicited Step 2 emails." count={rows.length}/>
    <OperatorRegister rows={rows} heading="LinkedIn conversation register" empty="No LinkedIn conversations are recorded yet."/>
  </section>;
}
