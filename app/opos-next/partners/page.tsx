import {requireUserContext} from '@/lib/auth/context';
import {OperatorPageIntro,OperatorRegister,type OperatorRow} from '../OperatorViews';
export default async function PartnersPage(){
  const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('partners')
    .select('id,company_name,country,services,status,nda_signed')
    .eq('organisation_id',organisationId).order('company_name').limit(100);
  if(error)throw new Error('Execution partner register could not be loaded.');
  const rows:OperatorRow[]=(data||[]).map(p=>({
    id:p.id,title:p.company_name,subtitle:p.country||'Location not recorded',
    state:String(p.status||'Prospective').replaceAll('_',' '),
    next:p.nda_signed?'Review partner capability':'Check confidentiality readiness',
    href:'/opos-next/partners/'+p.id,
  }));
  return <section><OperatorPageIntro eyebrow="PARTNERS / NETWORK" title="Execution partners" subtitle="Capability and approval readiness of the delivery partner network." count={rows.length}/>
    <OperatorRegister rows={rows} heading="Execution partner register" empty="No execution partners have been registered."/>
  </section>;
}
