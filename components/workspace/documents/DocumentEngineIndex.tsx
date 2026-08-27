import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { createDocumentRevisionAction, withdrawControlledDocumentAction } from '@/app/workspace/documents/control-actions';
import { resolveDocumentPresentation } from '@/lib/presentation/operatingState';
import { ContextActions, DecisionDialog, InteractionFact, InteractionFacts, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import WorkspaceActionButton from '@/components/workspace/WorkspaceActionButton';
import WorkspaceConsequenceGuard from '@/components/workspace/WorkspaceConsequenceGuard';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

type RegistryDocument={id:string;document_type:string;reference:string;title:string;status:string;version:number;created_at:string;updated_at:string|null;lead_id:string|null;project_id:string|null;revision_code?:string|null;issue_purpose?:string|null;control_state?:string|null;is_current_revision?:boolean|null;supersedes_document_id?:string|null;superseded_by_document_id?:string|null};
type IssueRecord={id:string;document_id:string;revision_code:string;issue_sequence:number;purpose:string;recipient_name:string|null;recipient_email:string|null;issued_at:string};
type Props={leadId?:string|null;projectId?:string|null};
function canonicalDocumentSlug(value:string){const aliases:Record<string,string>={client_quote:'client-quote',client_requirements:'client-requirements',scope_of_work:'scope-of-work',statement_of_work:'statement-of-work',commercial_approval:'commercial-approval',partner_technical_assessment_report:'partner-technical-assessment-report',vendor_safe_package:'vendor-safe-package',handover_pack:'handover-pack',completion_report:'completion-report',document_register:'document-register'};return aliases[value]||value.replaceAll('_','-')}
function openUrl(document:RegistryDocument){const context=document.project_id?`project=${document.project_id}`:`case=${document.lead_id}`;return `/workspace/documents/templates/${canonicalDocumentSlug(document.document_type)}?${context}&document_record=${document.id}`}
function revision(document:RegistryDocument){return document.revision_code||`P${String(Math.max(1,Number(document.version||1))).padStart(2,'0')}`}
function state(document:RegistryDocument){return document.control_state||document.status.replaceAll('_',' ')}
function formatDate(value:string){return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(value))}

function RecordContext({document}:{document:RegistryDocument}){
  const links=document.project_id?[
    {label:'Project 360',href:`/workspace/projects/${document.project_id}`},
    {label:'Delivery control',href:`/workspace/projects/${document.project_id}/delivery`},
    {label:'Project finance',href:`/workspace/payments?project=${document.project_id}`},
    {label:'Approvals',href:'/workspace/approvals'},
  ]:document.lead_id?[
    {label:'Case 360',href:`/workspace/leads/${document.lead_id}`},
    {label:'Client quotes',href:'/workspace/quotes'},
    {label:'Approvals',href:'/workspace/approvals'},
    {label:'All Case documents',href:`/workspace/documents?lead=${document.lead_id}`},
  ]:[
    {label:'Global register',href:'/workspace/documents'},
    {label:'Approvals',href:'/workspace/approvals'},
  ];
  return <nav className="workspace-record-context" aria-label={`Related work for ${document.reference}`}><small>Owning workflow</small><div className="workspace-record-context__links">{links.map(item=><Link key={item.href} href={item.href}>{item.label}<span>→</span></Link>)}</div></nav>;
}

export default async function DocumentEngineIndex({leadId,projectId}:Props){
  const {supabase,organisationId}=await requireUserContext();
  const contextType=projectId?'project':leadId?'case':null;const contextId=projectId||leadId||null;
  let query=supabase.from('documents').select('id,document_type,reference,title,status,version,created_at,updated_at,lead_id,project_id,revision_code,issue_purpose,control_state,is_current_revision,supersedes_document_id,superseded_by_document_id').eq('organisation_id',organisationId).order('created_at',{ascending:false});
  if(projectId)query=query.eq('project_id',projectId);else if(leadId)query=query.eq('lead_id',leadId);
  const {data,error}=await query;const documents=(data||[]) as RegistryDocument[];const ids=documents.map(item=>item.id);let issues:IssueRecord[]=[];
  if(ids.length){const issueResult=await supabase.from('document_issue_records').select('id,document_id,revision_code,issue_sequence,purpose,recipient_name,recipient_email,issued_at').eq('organisation_id',organisationId).in('document_id',ids).order('issued_at',{ascending:false});if(!issueResult.error)issues=(issueResult.data||[]) as IssueRecord[];}
  const current=documents.filter(d=>d.is_current_revision!==false&&state(d)!=='superseded'&&state(d)!=='withdrawn');const historical=documents.filter(d=>!current.includes(d));
  const approvalNeeded=current.filter(document=>resolveDocumentPresentation(state(document),document.title).approval?.required).length;
  const issued=current.filter(d=>['issued','published'].includes(d.status)||state(d)==='issued').length;
  const working=current.filter(document=>!resolveDocumentPresentation(state(document),document.title).approval?.required&&!['approved','issued','published','archived'].includes(document.status)).length;
  const backHref=contextType&&contextId?(contextType==='project'?`/workspace/projects/${contextId}`:`/workspace/leads/${contextId}`):undefined;

  const historicalDrawer=historical.length?<WorkspaceDrawer triggerLabel={`Historical revisions · ${historical.length}`} eyebrow="Document context" title="Historical revisions" description="Superseded and withdrawn evidence is retained for traceability but stays outside the current working set.">
    <DocumentHistory documents={historical}/>
  </WorkspaceDrawer>:null;
  const issueDrawer=issues.length?<WorkspaceDrawer triggerLabel={`Issue history · ${issues.length}`} eyebrow="Document context" title="Controlled release history" description="Previous controlled releases and recipients. Current document state remains on the main register.">
    <IssueHistory issues={issues} documents={documents}/>
  </WorkspaceDrawer>:null;

  return <section className="vp-page document-registry">
    <ProductPageHeader eyebrow="Operations · Document control" title={contextType?'Controlled documents':'Document register'} description={contextType?'Current revisions and current document decisions attached to this operating record. Historical revisions and release history open as context drawers.':'The current revision of every controlled document stays on the register. Inspect metadata/history in drawers and open the document workspace only when real document work is required.'} backHref={backHref} backLabel={contextType==='project'?'Back to Project':'Back to Case'} actions={<ContextActions label="Document register context">{historicalDrawer}{issueDrawer}{contextType?<Link className="button secondary" href="/workspace/documents">Global register</Link>:null}<Link className="button secondary" href="/workspace/approvals">Approvals</Link></ContextActions>}/>
    <ProductMetrics label="Document control summary">
      <ProductMetric label="Current revisions" value={current.length} detail="Valid working set" />
      <ProductMetric label="Approval needed" value={approvalNeeded} detail="Authorised decision required" tone={approvalNeeded?'waiting':'complete'} />
      <ProductMetric label="Working" value={working} detail="Preparation or requested changes" tone={working?'active':'neutral'} />
      <ProductMetric label="Issued" value={issued} detail="Controlled releases" tone={issued?'complete':'neutral'} />
    </ProductMetrics>

    {error?<ProductNotice title="Document control unavailable" tone="blocked"><p>{error.message}</p><p>Confirm the document-control migration is active before continuing.</p></ProductNotice>:null}
    {!error&&documents.length===0?<ProductEmptyState title={contextType?`No controlled documents for this ${contextType}`:'No controlled documents yet'} description="Documents enter this register automatically when they are created from the operating workflow." action={backHref?<Link className="button" href={backHref}>Return to operating record</Link>:<><Link className="button" href="/workspace/leads">Open Cases</Link> <Link className="button secondary" href="/workspace/projects">Open Projects</Link></>}/>:null}

    {current.length?<Register title="Current revisions" description="The revision currently valid for work, approval or issue." documents={current} current/>:null}

    {(historical.length||issues.length)?<section className="product-panel">
      <ProductSectionHeader eyebrow="Context" title="Revision & issue history" actions={<ContextActions>{historicalDrawer}{issueDrawer}</ContextActions>} />
      <p style={{margin:0,color:'var(--saas-muted)',fontSize:12,lineHeight:1.6}}>Historical evidence remains available without turning the current document register into a long audit page.</p>
    </section>:null}
  </section>;
}

function Register({title,description,documents,current=false}:{title:string;description:string;documents:RegistryDocument[];current?:boolean}){
  return <section className="product-panel document-registry__table-wrap"><ProductSectionHeader eyebrow="Document register" title={title} meta={`${documents.length} document${documents.length===1?'':'s'}`}/><p style={{margin:'-4px 0 12px',color:'var(--saas-muted)',fontSize:11}}>{description}</p><div className="document-registry__table-scroll"><table><thead><tr><th>Document number</th><th>Document</th><th>Revision</th><th>Operating state</th><th>Purpose</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{documents.map(document=>{const presentation=resolveDocumentPresentation(state(document),document.title);return <tr id={`document-${document.id}`} key={document.id}>
    <td><strong>{document.reference}</strong></td>
    <td><span>{document.title}</span><small>{canonicalDocumentSlug(document.document_type).replaceAll('-',' ')}</small></td>
    <td><strong>{revision(document)}</strong><small>v{document.version}</small></td>
    <td><ProductStatus tone={presentation.tone}>{presentation.state}</ProductStatus><small>{presentation.nextAction.label}</small></td>
    <td>{(document.issue_purpose||'internal').replaceAll('_',' ')}</td>
    <td>{formatDate(document.updated_at||document.created_at)}</td>
    <td><ContextActions label={`Actions for ${document.reference}`}>
      <WorkspaceDrawer triggerLabel="Inspect" eyebrow="Controlled document" title={document.title} description={presentation.summary} footer={<Link className="button" href={openUrl(document)}>{presentation.approval?.required?'Open review workspace':'Open document'}</Link>}>
        <InteractionFacts>
          <InteractionFact label="Reference">{document.reference}</InteractionFact>
          <InteractionFact label="Revision">{revision(document)}</InteractionFact>
          <InteractionFact label="Operating state">{presentation.state}</InteractionFact>
          <InteractionFact label="Purpose">{(document.issue_purpose||'internal').replaceAll('_',' ')}</InteractionFact>
          <InteractionFact label="Version">v{document.version}</InteractionFact>
          <InteractionFact label="Updated">{formatDate(document.updated_at||document.created_at)}</InteractionFact>
          <InteractionFact label="Next action">{presentation.nextAction.label}</InteractionFact>
          <InteractionFact label="Current revision">{document.is_current_revision===false?'No':'Yes'}</InteractionFact>
        </InteractionFacts>
        <p className="interaction-summary__lead">{presentation.summary}</p>
        <RecordContext document={document}/>
      </WorkspaceDrawer>
      <Link className="button secondary" href={openUrl(document)}>{presentation.approval?.required?'Review':'Open'}</Link>
      {current&&['signed','approved','issued','published'].includes(document.status)?<DecisionDialog triggerLabel="New revision" eyebrow="Document control" title={`Create new revision · ${document.reference}`} description="This preserves the current revision and creates the next controlled working revision.">
        <form action={createDocumentRevisionAction} className="stack"><input type="hidden" name="document_id" value={document.id}/><div className="product-notice"><strong>Create next controlled revision?</strong><div>{document.title} · {revision(document)} will become historical and the next revision will become the current working copy.</div></div><WorkspaceActionButton pendingLabel="Creating revision…">Create new revision</WorkspaceActionButton></form>
      </DecisionDialog>:null}
      {current&&['approved','issued','published'].includes(document.status)?<DecisionDialog triggerLabel="Withdraw" eyebrow="Document control" title={`Withdraw ${document.reference}`} description="Withdrawal preserves the evidence trail and removes this revision from the current valid working set.">
        <form action={withdrawControlledDocumentAction} className="stack"><input type="hidden" name="document_id" value={document.id}/><label>Reason<textarea name="reason" rows={3} required/></label><WorkspaceConsequenceGuard actionLabel="Confirm withdrawal" pendingLabel="Withdrawing document…" confirmationLabel={`I understand ${document.reference} will no longer be a current valid revision.`} consequence="This revision will be removed from current controlled use. Existing history and issue evidence remain retained." recovery="If the document is needed again, create a new controlled revision rather than restoring this withdrawn revision." className="button secondary"/></form>
      </DecisionDialog>:null}
    </ContextActions></td>
  </tr>})}</tbody></table></div></section>;
}

function DocumentHistory({documents}:{documents:RegistryDocument[]}){
  return <div className="interaction-summary"><p className="interaction-summary__lead">Historical revisions are read-only context. Open a document only if you need its retained evidence.</p><div className="product-register">{documents.map(document=><div className="product-register-row" key={document.id}><div><strong>{document.reference} · {revision(document)}</strong><p>{document.title}</p></div><ProductStatus tone="neutral">{state(document)}</ProductStatus><div><small>Updated</small><strong style={{display:'block',marginTop:3}}>{formatDate(document.updated_at||document.created_at)}</strong></div><Link className="button secondary" href={openUrl(document)}>Open</Link></div>)}</div></div>;
}

function IssueHistory({issues,documents}:{issues:IssueRecord[];documents:RegistryDocument[]}){
  return <div className="document-registry__table-scroll"><table><thead><tr><th>Document</th><th>Revision</th><th>Issue</th><th>Purpose</th><th>Recipient</th><th>Issued</th></tr></thead><tbody>{issues.map(issue=>{const doc=documents.find(d=>d.id===issue.document_id);return <tr key={issue.id}><td><strong>{doc?.reference||'Document'}</strong><small>{doc?.title}</small></td><td>{issue.revision_code}</td><td>#{issue.issue_sequence}</td><td>{issue.purpose.replaceAll('_',' ')}</td><td>{issue.recipient_name||issue.recipient_email||'Controlled release'}</td><td>{formatDate(issue.issued_at)}</td></tr>})}</tbody></table></div>;
}
