import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {OperatorRecord} from '../../OperatorViews';
export default async function DocumentPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('documents')
    .select('id,title,reference,document_type,status,control_state,version,lead_id,project_id')
    .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(error)throw new Error('Document record could not be loaded.');if(!data)notFound();
  return <OperatorRecord eyebrow="DOCUMENTS / CONTROLLED RECORD" title={data.title||'Document'}
    position={String(data.control_state||data.status||'Recorded').replaceAll('_',' ')}
    description="Document issue, approval, signatures and revisions remain governed by the protected document engine."
    fields={[{label:'Reference',value:data.reference||id.slice(0,8)},{label:'Type',value:data.document_type||'Not recorded'},
      {label:'Version',value:String(data.version||1)},{label:'Status',value:String(data.status||'Not recorded')}]}
    previous="/opos-next/documents"
    governedHref={'/workspace/documents'+(data.project_id?'?project='+data.project_id:data.lead_id?'?lead='+data.lead_id:'')}
    governedLabel="Open controlled document library" />;
}
