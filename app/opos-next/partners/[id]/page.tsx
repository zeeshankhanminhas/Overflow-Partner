import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {OperatorRecord} from '../../OperatorViews';
export default async function PartnerDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('partners').select('id,company_name,status,nda_signed,country,services')
    .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(error)throw new Error('Partner record could not be loaded.');if(!data)notFound();
  return <OperatorRecord eyebrow="PARTNERS / EXECUTION PARTNER" title={data.company_name}
    position={data.status==='approved'?'Approved partner':'Partner requires readiness review'}
    description={data.nda_signed?'Confidentiality agreement is recorded. Assignment eligibility remains governed by the full partner controls.':'Confidentiality completion must be confirmed before governed assignment.'}
    fields={[{label:'Status',value:data.status||'Unrecorded'},{label:'Country',value:data.country||'Not recorded'},
      {label:'Confidentiality',value:data.nda_signed?'NDA recorded':'NDA not recorded'},
      {label:'Capabilities',value:String(data.services||'Not recorded')}]}
    previous="/opos-next/partners" governedHref="/workspace/partners" />;
}
