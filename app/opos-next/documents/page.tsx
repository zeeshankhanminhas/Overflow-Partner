import {requireUserContext} from '@/lib/auth/context';
import {OperatorPageIntro,OperatorRegister,type OperatorRow} from '../OperatorViews';
export default async function DocumentsPage(){
  const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('documents')
    .select('id,title,reference,document_type,status,control_state,version,lead_id,project_id')
    .eq('organisation_id',organisationId).order('created_at',{ascending:false}).limit(100);
  if(error)throw new Error('Document register could not be loaded.');
  const rows:OperatorRow[]=(data||[]).map(item=>({
    id:item.id,title:item.title||item.reference||'Controlled document',
    subtitle:item.reference||item.document_type||'Document',
    state:String(item.control_state||item.status||'Recorded').replaceAll('_',' '),
    next:'Revision '+String(item.version||'1'),
    href:'/opos-next/documents/'+item.id,
  }));
  return <section><OperatorPageIntro eyebrow="DOCUMENTS / CONTROLLED LIBRARY" title="Documents"
    subtitle="Controlled documentary evidence with references and current issue states. No unauthorised editing or issue actions." count={rows.length}/>
    <OperatorRegister rows={rows} heading="Controlled document register" empty="No controlled documents have been recorded."/>
  </section>;
}
