import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { createDocumentRevisionAction, withdrawControlledDocumentAction } from '@/app/workspace/documents/control-actions';
import { developerDeleteRecordAction } from '@/app/workspace/developer-actions';
import { resolveDocumentPresentation } from '@/lib/presentation/operatingState';
import { commercialCopy } from '@/lib/presentation/commercialLanguage';
import { ContextActions, DecisionDialog, InteractionFact, InteractionFacts, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import FileTypeThumbnail from '@/components/workspace/FileTypeThumbnail';
import WorkspaceActionButton from '@/components/workspace/WorkspaceActionButton';
import WorkspaceConsequenceGuard from '@/components/workspace/WorkspaceConsequenceGuard';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

type RegistryDocument={id:string;document_type:string;reference:string;title:string;status:string;version:number;created_at:string;updated_at:string|null;lead_id:string|null;project_id:string|null;created_by?:string|null;prepared_by?:string|null;approved_by?:string|null;revision_code?:string|null;issue_purpose?:string|null;control_state?:string|null;is_current_revision?:boolean|null;supersedes_document_id?:string|null;superseded_by_document_id?:string|null;storage_path?:string|null};
type IssueRecord={id:string;document_id:string;revision_code:string;issue_sequence:number;purpose:string;recipient_name:string|null;recipient_email:string|null;issued_at:string};
type Props={leadId?:string|null;projectId?:string|null;query?:Record<string,string|string[]|undefined>};
type View='all'|'review'|'progress'|'sent'|'overdue'|'recent';
type Sort='title'|'type'|'status'|'revision'|'owner'|'updated'|'purpose';
type Direction='asc'|'desc';
type Context={label:string;href:string;client?:string};
const PAGE_SIZE=25;

function canonicalDocumentSlug(value:string){const aliases:Record<string,string>={client_quote:'client-quote',client_requirements:'client-requirements',scope_of_work:'scope-of-work',statement_of_work:'statement-of-work',commercial_approval:'commercial-approval',partner_technical_assessment_report:'partner-technical-assessment-report',vendor_safe_package:'vendor-safe-package',handover_pack:'handover-pack',completion_report:'completion-report',document_register:'document-register'};return aliases[value]||value.replaceAll('_','-')}
function openUrl(document:RegistryDocument){const context=document.project_id?`project=${document.project_id}`:`case=${document.lead_id}`;return `/workspace/documents/templates/${canonicalDocumentSlug(document.document_type)}?${context}&document_record=${document.id}`}
function revision(document:RegistryDocument){return document.revision_code||`P${String(Math.max(1,Number(document.version||1))).padStart(2,'0')}`}
function state(document:RegistryDocument){return document.control_state||document.status.replaceAll('_',' ')}
function formatDate(value:string){return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(value))}
function ageMinutes(value:string){return Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000))}
function ageLabel(value:string){const minutes=ageMinutes(value);if(minutes<60)return `${Math.max(1,minutes)}m`;const hours=Math.floor(minutes/60);if(hours<24)return `${hours}h`;const days=Math.floor(hours/24);return `${days}d`}
function displayType(value:string){return canonicalDocumentSlug(value).replaceAll('-',' ')}
function purpose(document:RegistryDocument){
  if(document.issue_purpose&&document.issue_purpose!=='internal')return document.issue_purpose.replaceAll('_',' ');
  const type=canonicalDocumentSlug(document.document_type);
  if(type.includes('client-quote'))return 'Client issue';
  if(type.includes('commercial-approval'))return 'Internal approval';
  if(type.includes('partner-technical'))return 'Partner review';
  if(type.includes('client-requirements'))return 'Client requirements';
  if(type.includes('technical-review'))return 'Technical review';
  if(type.includes('document-register'))return 'Controlled record';
  if(document.project_id)return 'Project evidence';
  return 'Internal working';
}
function usefulNextAction(document:RegistryDocument){const p=resolveDocumentPresentation(state(document),document.title);const label=commercialCopy(p.nextAction.label);return /no approval|no action|nothing required/i.test(label)?'—':label}
function scalar(value:string|string[]|undefined,fallback=''){return typeof value==='string'?value:fallback}
function safeView(value:string):View{return ['all','review','progress','sent','overdue','recent'].includes(value)?value as View:'all'}
function safeSort(value:string):Sort{return ['title','type','status','revision','owner','updated','purpose'].includes(value)?value as Sort:'updated'}
function hrefFor(base:Record<string,string>,overrides:Record<string,string|undefined>={}){const p=new URLSearchParams(base);for(const [key,value] of Object.entries(overrides)){if(!value||value==='all')p.delete(key);else p.set(key,value)}const q=p.toString();return `/workspace/documents${q?`?${q}`:''}`}

function DocumentIdentity({document}:{document:RegistryDocument}){return <div className="file-identity"><FileTypeThumbnail name={document.storage_path||document.title} documentType={document.document_type}/><div className="file-identity__copy"><strong>{document.title}</strong><small>{document.reference}</small>{document.storage_path?<span className="file-identity__filename">{document.storage_path.split('/').pop()}</span>:null}</div></div>}

function RecordContext({document,context}:{document:RegistryDocument;context?:Context}){
  const links=document.project_id?[{label:'Project 360',href:`/workspace/projects/${document.project_id}`},{label:'Delivery',href:`/workspace/projects/${document.project_id}/delivery`},{label:'Project finance',href:`/workspace/payments?project=${document.project_id}`},{label:'Approvals',href:'/workspace/approvals'}]:document.lead_id?[{label:'Case 360',href:`/workspace/leads/${document.lead_id}`},{label:'Client quotes',href:'/workspace/quotes'},{label:'Approvals',href:'/workspace/approvals'},{label:'Case documents',href:`/workspace/documents?lead=${document.lead_id}`}]:[{label:'All documents',href:'/workspace/documents'},{label:'Approvals',href:'/workspace/approvals'}];
  return <><InteractionFacts>{context?<InteractionFact label="Related to"><Link href={context.href}>{context.label}</Link>{context.client?` · ${context.client}`:''}</InteractionFact>:null}<InteractionFact label="Relationship">{document.supersedes_document_id?'Supersedes previous revision':document.superseded_by_document_id?'Superseded by newer revision':'Current relationship'}</InteractionFact></InteractionFacts><nav className="workspace-record-context" aria-label={`Related work for ${document.reference}`}><small>Related work</small><div className="workspace-record-context__links">{links.map(item=><Link key={item.href} href={item.href}>{item.label}<span>→</span></Link>)}</div></nav></>;
}

export default async function DocumentEngineIndex({leadId,projectId,query={}}:Props){
  const {supabase,organisationId,profile}=await requireUserContext();const contextType=projectId?'project':leadId?'opportunity':null;const contextId=projectId||leadId||null;
  let dbQuery=supabase.from('documents').select('id,document_type,reference,title,status,version,created_at,updated_at,lead_id,project_id,created_by,prepared_by,approved_by,revision_code,issue_purpose,control_state,is_current_revision,supersedes_document_id,superseded_by_document_id,storage_path').eq('organisation_id',organisationId).order('created_at',{ascending:false});
  if(projectId)dbQuery=dbQuery.eq('project_id',projectId);else if(leadId)dbQuery=dbQuery.eq('lead_id',leadId);
  const {data,error}=await dbQuery;const documents=(data||[]) as RegistryDocument[];const ids=documents.map(item=>item.id);let issues:IssueRecord[]=[];
  if(ids.length){const issueResult=await supabase.from('document_issue_records').select('id,document_id,revision_code,issue_sequence,purpose,recipient_name,recipient_email,issued_at').eq('organisation_id',organisationId).in('document_id',ids).order('issued_at',{ascending:false});if(!issueResult.error)issues=(issueResult.data||[]) as IssueRecord[];}

  const projectIds=[...new Set(documents.map(d=>d.project_id).filter(Boolean) as string[])];
  const directLeadIds=[...new Set(documents.map(d=>d.lead_id).filter(Boolean) as string[])];
  const projectResult=projectIds.length?await supabase.from('projects').select('id,project_number,title,lead_id').eq('organisation_id',organisationId).in('id',projectIds):{data:[] as any[]};
  const projectRows=(projectResult.data||[]) as any[];
  const allLeadIds=[...new Set([...directLeadIds,...projectRows.map(p=>p.lead_id).filter(Boolean)])];
  const userIds=[...new Set(documents.flatMap(d=>[d.prepared_by,d.created_by,d.approved_by]).filter(Boolean) as string[])];
  const [leadResult,profileResult]=await Promise.all([
    allLeadIds.length?supabase.from('leads').select('id,title,company_name,contact_name').eq('organisation_id',organisationId).in('id',allLeadIds):Promise.resolve({data:[] as any[]}),
    userIds.length?supabase.from('profiles').select('id,full_name,email').eq('organisation_id',organisationId).in('id',userIds):Promise.resolve({data:[] as any[]}),
  ]);
  const leadMap=new Map((leadResult.data||[]).map((l:any)=>[String(l.id),l]));
  const projectMap=new Map(projectRows.map((p:any)=>[String(p.id),p]));
  const profileMap=new Map((profileResult.data||[]).map((p:any)=>[String(p.id),p]));
  const contextMap=new Map<string,Context>();
  for(const document of documents){if(document.project_id){const p:any=projectMap.get(document.project_id);const l:any=p?.lead_id?leadMap.get(String(p.lead_id)):null;if(p)contextMap.set(document.id,{label:`${p.project_number||'Project'} · ${p.title||'Project'}`,href:`/workspace/projects/${p.id}`,client:l?.company_name});}else if(document.lead_id){const l:any=leadMap.get(document.lead_id);if(l)contextMap.set(document.id,{label:l.title||l.company_name||'Case',href:`/workspace/leads/${l.id}`,client:l.company_name});}}
  const latestIssue=new Map<string,IssueRecord>();for(const item of issues){if(!latestIssue.has(item.document_id))latestIssue.set(item.document_id,item)}
  const ownerId=(document:RegistryDocument)=>document.prepared_by||document.created_by||'';
  const ownerName=(document:RegistryDocument)=>{const p:any=profileMap.get(ownerId(document));return p?.full_name||p?.email||'Overflow Partner'};

  const current=documents.filter(d=>d.is_current_revision!==false&&state(d)!=='superseded'&&state(d)!=='withdrawn');const historical=documents.filter(d=>!current.includes(d));
  const approvalNeeded=current.filter(document=>resolveDocumentPresentation(state(document),document.title).approval?.required).length;const issued=current.filter(d=>['issued','published'].includes(d.status)||state(d)==='issued').length;const working=current.filter(document=>!resolveDocumentPresentation(state(document),document.title).approval?.required&&!['approved','issued','published','archived'].includes(document.status)).length;
  const backHref=contextType&&contextId?(contextType==='project'?`/workspace/projects/${contextId}`:`/workspace/leads/${contextId}`):undefined;
  const historicalDrawer=historical.length?<WorkspaceDrawer triggerLabel={`Revision history · ${historical.length}`} eyebrow="Document history" title="Previous revisions" description="Superseded and withdrawn revisions remain available for traceability but are not part of the current working set."><DocumentHistory documents={historical}/></WorkspaceDrawer>:null;
  const issueDrawer=issues.length?<WorkspaceDrawer triggerLabel={`Release history · ${issues.length}`} eyebrow="Document history" title="Release history" description="Previous releases, purposes and recipients. The current document state remains on the main register."><IssueHistory issues={issues} documents={documents}/></WorkspaceDrawer>:null;

  const q=scalar(query.q).trim();const view=safeView(scalar(query.view,'all'));const type=scalar(query.type);const owner=scalar(query.owner);const sort=safeSort(scalar(query.sort,'updated'));const dir=(scalar(query.dir,'desc')==='asc'?'asc':'desc') as Direction;const requestedPage=Math.max(1,Number.parseInt(scalar(query.page,'1'),10)||1);
  const base:Record<string,string>={};if(leadId)base.lead=leadId;if(projectId)base.project=projectId;if(q)base.q=q;if(type)base.type=type;if(owner)base.owner=owner;if(view!=='all')base.view=view;if(sort!=='updated')base.sort=sort;if(dir!=='desc')base.dir=dir;
  const searchable=(d:RegistryDocument)=>[d.title,d.reference,d.document_type,d.storage_path,purpose(d),contextMap.get(d.id)?.label,contextMap.get(d.id)?.client,ownerName(d),latestIssue.get(d.id)?.recipient_name,latestIssue.get(d.id)?.recipient_email].some(v=>String(v||'').toLowerCase().includes(q.toLowerCase()));
  const stale=(d:RegistryDocument)=>ageMinutes(d.updated_at||d.created_at)>=7*24*60&&!['issued','published','archived'].includes(d.status)&&state(d)!=='issued';
  const recent=(d:RegistryDocument)=>ageMinutes(d.updated_at||d.created_at)<=7*24*60;
  let filtered=current.filter(d=>!q||searchable(d)).filter(d=>!type||d.document_type===type).filter(d=>!owner||ownerId(d)===owner);
  if(view==='review')filtered=filtered.filter(d=>resolveDocumentPresentation(state(d),d.title).approval?.required);
  if(view==='progress')filtered=filtered.filter(d=>!resolveDocumentPresentation(state(d),d.title).approval?.required&&!['approved','issued','published','archived'].includes(d.status));
  if(view==='sent')filtered=filtered.filter(d=>['issued','published'].includes(d.status)||state(d)==='issued');
  if(view==='overdue')filtered=filtered.filter(stale);
  if(view==='recent')filtered=filtered.filter(recent);
  const value=(d:RegistryDocument)=>sort==='title'?d.title.toLowerCase():sort==='type'?displayType(d.document_type):sort==='status'?commercialCopy(resolveDocumentPresentation(state(d),d.title).state):sort==='revision'?revision(d):sort==='owner'?ownerName(d):sort==='purpose'?purpose(d):new Date(d.updated_at||d.created_at).getTime();
  filtered=[...filtered].sort((a,b)=>{const av=value(a),bv=value(b);const result=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv));return dir==='asc'?result:-result});
  const total=filtered.length;const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));const page=Math.min(requestedPage,totalPages);const pageRows=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const types=[...new Set(current.map(d=>d.document_type))].sort();const owners=[...new Set(current.map(ownerId).filter(Boolean))];
  const sortHref=(key:Sort)=>hrefFor(base,{sort:key,dir:sort===key&&dir==='asc'?'desc':'asc',page:undefined});
  const developerDeleteEnabled=Boolean((profile as any).developer_delete_enabled);

  return <section className="vp-page document-registry document-reference-workspace">
    <ProductPageHeader eyebrow="Documents" title={contextType?'Documents':'Document register'} description={contextType?'Current revisions, decisions and releases for this work.':'Controlled documents, revisions and release evidence.'} backHref={backHref} backLabel={contextType==='project'?'Back to project':'Back to case'} actions={<ContextActions label="Document register context">{historicalDrawer}{issueDrawer}{contextType?<Link className="button secondary" href="/workspace/documents">All documents</Link>:null}<Link className="button secondary" href={`/workspace/documents/export?${new URLSearchParams(base).toString()}`}>Export CSV</Link><Link className="button secondary" href="/workspace/approvals">Approvals</Link></ContextActions>}/>
    <div className="document-register__metric-links">
      <Link href={hrefFor(base,{view:undefined,page:undefined})}><ProductMetrics label="Current revisions"><ProductMetric label="Current revisions" value={current.length} detail="Active working set"/></ProductMetrics></Link>
      <Link href={hrefFor(base,{view:'review',page:undefined})}><ProductMetrics label="Needs review"><ProductMetric label="Needs review" value={approvalNeeded} detail="Decision required" tone={approvalNeeded?'waiting':'complete'}/></ProductMetrics></Link>
      <Link href={hrefFor(base,{view:'progress',page:undefined})}><ProductMetrics label="In progress"><ProductMetric label="In progress" value={working} detail="Preparation or changes" tone={working?'active':'neutral'}/></ProductMetrics></Link>
      <Link href={hrefFor(base,{view:'sent',page:undefined})}><ProductMetrics label="Sent"><ProductMetric label="Sent" value={issued} detail="Released externally" tone={issued?'complete':'neutral'}/></ProductMetrics></Link>
    </div>

    <section className="document-register__toolbar" aria-label="Document register filters">
      <form method="get" className="document-register__filter-form">
        {leadId?<input type="hidden" name="lead" value={leadId}/>:null}{projectId?<input type="hidden" name="project" value={projectId}/>:null}{view!=='all'?<input type="hidden" name="view" value={view}/>:null}
        <input type="search" name="q" defaultValue={q} placeholder="Search title, reference, project, client or file" aria-label="Search documents"/>
        <select name="type" defaultValue={type} aria-label="Document type"><option value="">All document types</option>{types.map(item=><option key={item} value={item}>{displayType(item)}</option>)}</select>
        <select name="owner" defaultValue={owner} aria-label="Document owner"><option value="">All owners</option>{owners.map(id=><option key={id} value={id}>{ownerName(current.find(d=>ownerId(d)===id)!)}</option>)}</select>
        <button className="button secondary" type="submit">Filter</button>
        {(q||type||owner||view!=='all')?<Link className="button secondary" href={hrefFor({...(leadId?{lead:leadId}:{}),...(projectId?{project:projectId}:{})})}>Clear</Link>:null}
      </form>
      <nav className="document-register__saved-views" aria-label="Document views"><Link className={view==='review'?'is-active':''} href={hrefFor(base,{view:'review',page:undefined})}>Needs review</Link><Link className={view==='overdue'?'is-active':''} href={hrefFor(base,{view:'overdue',page:undefined})}>Waiting 7d+</Link><Link className={view==='sent'?'is-active':''} href={hrefFor(base,{view:'sent',page:undefined})}>Client issue</Link><Link className={view==='recent'?'is-active':''} href={hrefFor(base,{view:'recent',page:undefined})}>Recently updated</Link></nav>
    </section>

    {error?<ProductNotice title="Documents unavailable" tone="blocked"><p>{error.message}</p></ProductNotice>:null}
    {!error&&documents.length===0?<ProductEmptyState title={contextType?`No documents for this ${contextType}`:'No documents yet'} description="Documents appear here when they are created from the operating workflow." action={backHref?<Link className="button" href={backHref}>Return to work</Link>:undefined}/>:null}
    {current.length?<Register title={view==='all'?'Current revisions':view==='review'?'Needs review':view==='progress'?'In progress':view==='sent'?'Client issue':view==='overdue'?'Waiting 7d+':'Recently updated'} documents={pageRows} total={total} page={page} totalPages={totalPages} base={base} sort={sort} sortHref={sortHref} ownerName={ownerName} contextMap={contextMap} latestIssue={latestIssue} developerDeleteEnabled={developerDeleteEnabled}/>:null}
    {(historical.length||issues.length)?<section className="product-panel"><ProductSectionHeader eyebrow="History" title="Previous revisions & releases" actions={<ContextActions>{historicalDrawer}{issueDrawer}</ContextActions>}/></section>:null}
  </section>;
}

function Register({title,documents,total,page,totalPages,base,sort,sortHref,ownerName,contextMap,latestIssue,developerDeleteEnabled}:{title:string;documents:RegistryDocument[];total:number;page:number;totalPages:number;base:Record<string,string>;sort:Sort;sortHref:(key:Sort)=>string;ownerName:(d:RegistryDocument)=>string;contextMap:Map<string,Context>;latestIssue:Map<string,IssueRecord>;developerDeleteEnabled:boolean}){
  const SortHead=({field,label}:{field:Sort;label:string})=><th><Link className={sort===field?'is-sorted':''} href={sortHref(field)}>{label}{sort===field?' ↕':''}</Link></th>;
  return <section className="product-panel document-registry__table-wrap"><ProductSectionHeader eyebrow="Working register" title={title} meta={`${total} document${total===1?'':'s'}`}/><div className="document-registry__table-scroll"><table><thead><tr><th>#</th><SortHead field="title" label="Document"/><th>Related to</th><SortHead field="type" label="Document type"/><SortHead field="status" label="Status"/><SortHead field="revision" label="Rev"/><SortHead field="owner" label="Owner / waiting"/><SortHead field="purpose" label="Purpose"/><th>Release</th><th>Age / updated</th><th>Next action</th><th aria-label="More actions">More</th></tr></thead><tbody>{documents.map((document,index)=>{const presentation=resolveDocumentPresentation(state(document),document.title);const context=contextMap.get(document.id);const issue=latestIssue.get(document.id);const next=usefulNextAction(document);const waiting=presentation.approval?.required?'Approval':ownerName(document);return <tr id={`document-${document.id}`} key={document.id}>
    <td className="document-registry__serial">{(page-1)*PAGE_SIZE+index+1}</td>
    <td><Link className="document-registry__identity-link" href={openUrl(document)} aria-label={`${presentation.approval?.required?'Review':'Open'} ${document.title}`}><DocumentIdentity document={document}/></Link></td>
    <td>{context?<Link className="document-registry__context-link" href={context.href}><strong>{context.label}</strong>{context.client?<small>{context.client}</small>:null}</Link>:<span className="document-registry__muted">Workspace</span>}</td>
    <td>{displayType(document.document_type)}</td><td><ProductStatus tone={presentation.tone}>{commercialCopy(presentation.state)}</ProductStatus></td><td><strong>{revision(document)}</strong></td><td><strong>{waiting}</strong>{presentation.approval?.required?<small>Review decision due</small>:null}</td><td>{purpose(document)}</td>
    <td>{issue?<><strong>{issue.recipient_name||issue.recipient_email||'External release'}</strong><small>{issue.recipient_email&&issue.recipient_name?issue.recipient_email:''} · {formatDate(issue.issued_at)}</small></>:<span className="document-registry__muted">—</span>}</td>
    <td><strong>{ageLabel(document.updated_at||document.created_at)}</strong><small>{formatDate(document.updated_at||document.created_at)}</small></td><td>{next==='—'?<span className="document-registry__muted">—</span>:<Link className="document-registry__next-action" href={openUrl(document)}>{next}</Link>}</td>
    <td><details className="document-row-more"><summary aria-label={`More actions for ${document.reference}`}>···</summary><div className="document-row-more__menu"><WorkspaceDrawer triggerLabel="Inspect" eyebrow="Document" title={document.title} description={commercialCopy(presentation.summary)} footer={<Link className="button" href={openUrl(document)}>{presentation.approval?.required?'Open review':'Open document'}</Link>}><div style={{marginBottom:12}}><DocumentIdentity document={document}/></div><InteractionFacts><InteractionFact label="Reference">{document.reference}</InteractionFact><InteractionFact label="Revision">{revision(document)}</InteractionFact><InteractionFact label="Status">{commercialCopy(presentation.state)}</InteractionFact><InteractionFact label="Document type">{displayType(document.document_type)}</InteractionFact><InteractionFact label="Purpose">{purpose(document)}</InteractionFact><InteractionFact label="Owner / waiting">{waiting}</InteractionFact><InteractionFact label="Updated">{formatDate(document.updated_at||document.created_at)}</InteractionFact><InteractionFact label="File">{document.storage_path?.split('/').pop()||'Generated controlled document'}</InteractionFact><InteractionFact label="Next action">{next}</InteractionFact>{issue?<InteractionFact label="Last release">{issue.recipient_name||issue.recipient_email||'External release'} · {formatDate(issue.issued_at)}</InteractionFact>:null}</InteractionFacts><RecordContext document={document} context={context}/></WorkspaceDrawer><Link className="button secondary" href={openUrl(document)}>Open</Link>{['signed','approved','issued','published'].includes(document.status)?<DecisionDialog triggerLabel="New revision" eyebrow="Document control" title={`Create new revision · ${document.reference}`} description="This preserves the current revision and creates the next working revision."><form action={createDocumentRevisionAction} className="stack"><input type="hidden" name="document_id" value={document.id}/><WorkspaceActionButton pendingLabel="Creating revision…">Create new revision</WorkspaceActionButton></form></DecisionDialog>:null}{['approved','issued','published'].includes(document.status)?<DecisionDialog triggerLabel="Withdraw" triggerClassName="button secondary product-action product-action--destructive" eyebrow="Document control" title={`Withdraw ${document.reference}`} description="Withdrawal preserves the history and removes this revision from the current valid working set."><form action={withdrawControlledDocumentAction} className="stack"><input type="hidden" name="document_id" value={document.id}/><label>Reason<textarea name="reason" rows={3} required/></label><WorkspaceConsequenceGuard actionLabel="Confirm withdrawal" pendingLabel="Withdrawing document…" confirmationLabel={`I understand ${document.reference} will no longer be a current valid revision.`} consequence="This revision will be removed from current use." recovery="Create a new revision if the document is needed again." className="button product-action product-action--destructive"/></form></DecisionDialog>:null}{developerDeleteEnabled?<DecisionDialog triggerLabel="Delete test record" triggerClassName="button secondary product-action product-action--destructive" eyebrow="Developer test control" title={`Delete ${document.title}?`} description="Permanent test-data cleanup. The current document is selected automatically."><form action={developerDeleteRecordAction} className="stack"><input type="hidden" name="entity_type" value="document"/><input type="hidden" name="entity_id" value={document.id}/><input type="hidden" name="return_to" value="/workspace/documents"/><div className="product-notice product-notice--critical"><strong>Permanent delete</strong><div>{document.reference} will be removed from the test dataset.</div></div><button className="button product-action product-action--destructive" type="submit">Delete permanently</button></form></DecisionDialog>:null}</div></details></td>
  </tr>})}</tbody></table>{documents.length===0?<div className="vp-empty">No documents match this view.</div>:null}</div>{totalPages>1?<nav className="vp-pagination document-register__pagination" aria-label="Document pages"><Link className={`button secondary ${page<=1?'is-disabled':''}`} aria-disabled={page<=1} href={page>1?hrefFor(base,{page:String(page-1)}):hrefFor(base,{page:'1'})}>← Previous</Link><span>Page {page} of {totalPages} · {total} records</span><Link className={`button secondary ${page>=totalPages?'is-disabled':''}`} aria-disabled={page>=totalPages} href={page<totalPages?hrefFor(base,{page:String(page+1)}):hrefFor(base,{page:String(totalPages)})}>Next →</Link></nav>:<div className="document-register__record-scale">{total} record{total===1?'':'s'} · up to {PAGE_SIZE} per page</div>}</section>;
}

function DocumentHistory({documents}:{documents:RegistryDocument[]}){return <div className="product-register">{documents.map(document=><div className="product-register-row" key={document.id}><DocumentIdentity document={document}/><ProductStatus tone="neutral">{commercialCopy(state(document))}</ProductStatus><div><small>Updated</small><strong style={{display:'block',marginTop:3}}>{formatDate(document.updated_at||document.created_at)}</strong></div><Link className="button secondary" href={openUrl(document)}>Open</Link></div>)}</div>}
function IssueHistory({issues,documents}:{issues:IssueRecord[];documents:RegistryDocument[]}){return <div className="document-registry__table-scroll"><table><thead><tr><th>Document</th><th>Revision</th><th>Release</th><th>Purpose</th><th>Recipient</th><th>Sent</th></tr></thead><tbody>{issues.map(issue=>{const doc=documents.find(d=>d.id===issue.document_id);return <tr key={issue.id}><td>{doc?<DocumentIdentity document={doc}/>:<strong>Document</strong>}</td><td>{issue.revision_code}</td><td>#{issue.issue_sequence}</td><td>{issue.purpose.replaceAll('_',' ')}</td><td>{issue.recipient_name||issue.recipient_email||'Controlled release'}</td><td>{formatDate(issue.issued_at)}</td></tr>})}</tbody></table></div>}
