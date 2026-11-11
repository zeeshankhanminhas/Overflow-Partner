import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {getWorkspaceDocument,legacyDocumentAliases,type WorkspaceDocumentSlug} from '@/components/workspace/documents/documentRegistry';
import {OperatorRecord} from '../../OperatorViews';
import css from '../../opos.module.css';
export default async function DocumentPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const {supabase,organisationId}=await requireUserContext();
  const {data,error}=await supabase.from('documents')
    .select('id,title,reference,document_type,status,control_state,version,lead_id,project_id')
    .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(error)throw new Error('Document record could not be loaded.');if(!data)notFound();
  const type=String(data.document_type||'') as WorkspaceDocumentSlug;
  const canonical=legacyDocumentAliases[type]||type;
  const relatedHref=data.project_id?'/opos-next/projects/'+data.project_id:data.lead_id?'/opos-next/cases/'+data.lead_id:null;
  const docQuery=new URLSearchParams({document_record:id});
  if(data.project_id)docQuery.set('project',data.project_id);
  else if(data.lead_id)docQuery.set('case',data.lead_id);
  const historicOperationalRecord=Boolean(data.project_id && ['technical-review','document-register'].includes(canonical));
  const reviewHref=!historicOperationalRecord&&getWorkspaceDocument(canonical)?'/opos-next/documents/templates/'+canonical+'?'+docQuery.toString():null;
  return <><OperatorRecord eyebrow="DOCUMENTS / CONTROLLED RECORD" title={data.title||'Document'}
    position={String(data.control_state||data.status||'Recorded').replaceAll('_',' ')}
    description={historicOperationalRecord?'Historical internal document. Current engineering acceptance and manifest verification are recorded against the Partner submission in Project 360.':'Document issue, approval, signatures and revisions remain governed by the protected document engine.'}
    fields={[{label:'Reference',value:data.reference||id.slice(0,8)},{label:'Type',value:data.document_type||'Not recorded'},
      {label:'Version',value:String(data.version||1)},{label:'Status',value:String(data.status||'Not recorded')}]}
    previous="/opos-next/documents"
    governedHref={reviewHref||relatedHref||undefined}
    governedLabel={reviewHref?'Open controlled document review':historicOperationalRecord?'Open Project 360 engineering QA':'Open related controlled record'} />
    {reviewHref&&relatedHref?<p style={{marginTop:20}}><Link className={css.secondaryLink} href={relatedHref}>Open related {data.project_id?'Project 360':'Case 360'} ↗</Link></p>:null}
  </>;
}
