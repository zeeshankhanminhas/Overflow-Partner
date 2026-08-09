import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { createDocumentRevisionAction, withdrawControlledDocumentAction } from '@/app/workspace/documents/control-actions';

type RegistryDocument = {
  id: string; document_type: string; reference: string; title: string; status: string; version: number;
  created_at: string; updated_at: string | null; lead_id: string | null; project_id: string | null;
  revision_code?: string | null; issue_purpose?: string | null; control_state?: string | null;
  is_current_revision?: boolean | null; supersedes_document_id?: string | null; superseded_by_document_id?: string | null;
};
type IssueRecord={id:string;document_id:string;revision_code:string;issue_sequence:number;purpose:string;recipient_name:string|null;recipient_email:string|null;issued_at:string};
type Props = { leadId?: string | null; projectId?: string | null };

function canonicalDocumentSlug(value: string) {
  const aliases: Record<string, string> = {client_quote:'client-quote',client_requirements:'client-requirements',scope_of_work:'scope-of-work',statement_of_work:'statement-of-work',commercial_approval:'commercial-approval',partner_technical_assessment_report:'partner-technical-assessment-report',vendor_safe_package:'vendor-safe-package',handover_pack:'handover-pack',completion_report:'completion-report',document_register:'document-register'};
  return aliases[value] || value.replaceAll('_', '-');
}
function openUrl(document: RegistryDocument) {const context=document.project_id?`project=${document.project_id}`:`case=${document.lead_id}`;return `/workspace/documents/templates/${canonicalDocumentSlug(document.document_type)}?${context}&document_record=${document.id}`;}
function revision(document:RegistryDocument){return document.revision_code||`P${String(Math.max(1,Number(document.version||1))).padStart(2,'0')}`}
function state(document:RegistryDocument){return document.control_state||document.status.replaceAll('_',' ')}
function formatDate(value:string){return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(value))}

export default async function DocumentEngineIndex({ leadId, projectId }: Props) {
  const { supabase, organisationId } = await requireUserContext();
  const contextType = projectId ? 'project' : leadId ? 'case' : null;const contextId=projectId||leadId||null;
  let query=supabase.from('documents').select('id,document_type,reference,title,status,version,created_at,updated_at,lead_id,project_id,revision_code,issue_purpose,control_state,is_current_revision,supersedes_document_id,superseded_by_document_id').eq('organisation_id',organisationId).order('created_at',{ascending:false});
  if(projectId)query=query.eq('project_id',projectId);else if(leadId)query=query.eq('lead_id',leadId);
  const {data,error}=await query;const documents=(data||[]) as RegistryDocument[];
  const ids=documents.map(item=>item.id);let issues:IssueRecord[]=[];
  if(ids.length){const issueResult=await supabase.from('document_issue_records').select('id,document_id,revision_code,issue_sequence,purpose,recipient_name,recipient_email,issued_at').eq('organisation_id',organisationId).in('document_id',ids).order('issued_at',{ascending:false});if(!issueResult.error)issues=(issueResult.data||[]) as IssueRecord[];}
  const current=documents.filter(d=>d.is_current_revision!==false&&state(d)!=='superseded'&&state(d)!=='withdrawn');const historical=documents.filter(d=>!current.includes(d));
  const review=current.filter(d=>['draft','in_review','changes_requested','signed','working','review'].includes(String(d.status))||['working','review'].includes(state(d))).length;
  const issued=current.filter(d=>['issued','published'].includes(d.status)||state(d)==='issued').length;
  const contextLabel=contextType==='project'?'Project 360 documents':contextType==='case'?'Case 360 documents':'Document control';

  return <div className="document-registry">
    <section className="document-suite-hero"><p>{contextLabel}</p><h1>{contextType?'Controlled documents for this record.':'Document register and revision control.'}</h1><p>{contextType?'Current revisions, approvals, issues and historical revisions stay attached to this operating record.':'See the current revision of every document, its review state, issue history and superseded revisions in one register.'}</p>{contextType&&contextId?<div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:18}}><Link className="button secondary" href={contextType==='project'?`/workspace/projects/${contextId}`:`/workspace/leads/${contextId}`}>Back to {contextType==='project'?'Project 360':'Case 360'}</Link><Link className="button secondary" href="/workspace/documents">View global register</Link></div>:null}</section>

    <section className="document-registry__metrics" aria-label="Document control summary"><article><span>Current revisions</span><strong>{current.length}</strong></article><article><span>Needs review</span><strong>{review}</strong></article><article><span>Issued</span><strong>{issued}</strong></article><article><span>Historical</span><strong>{historical.length}</strong></article></section>

    {error?<section className="card"><h2>Document control unavailable</h2><p>{error.message}</p><p>Apply the Phase 2C document-control migration if the new revision fields are not available yet.</p></section>:null}
    {!error&&documents.length===0?<section className="document-registry__empty"><p className="vp-label">No controlled documents yet</p><h2>{contextType?`No documents have been generated for this ${contextType} yet.`:'Generate the first document from its case or project stage.'}</h2><p>Documents enter this register automatically when created from the operating workflow.</p><div>{contextType&&contextId?<Link className="button" href={contextType==='project'?`/workspace/projects/${contextId}`:`/workspace/leads/${contextId}`}>Return to operating record</Link>:<><Link className="button" href="/workspace/leads">Open cases</Link><Link className="button secondary" href="/workspace/projects">Open projects</Link></>}</div></section>:null}

    {current.length?<Register title="Current document register" description="Only the revision currently valid for work, review or issue." documents={current} current/>:null}
    {historical.length?<details className="vp-disclosure" style={{marginTop:18}}><summary>Historical / superseded revisions · {historical.length}</summary><div style={{paddingTop:16}}><Register title="Revision history" description="Superseded or withdrawn revisions remain visible for audit and traceability." documents={historical}/></div></details>:null}

    {issues.length?<section className="card" style={{marginTop:18}}><div className="document-registry__heading"><div><p className="vp-label">Issue history</p><h2>Controlled releases</h2></div><span>{issues.length} issue records</span></div><div className="document-registry__table-scroll"><table><thead><tr><th>Document</th><th>Revision</th><th>Issue</th><th>Purpose</th><th>Recipient</th><th>Issued</th></tr></thead><tbody>{issues.map(issue=>{const doc=documents.find(d=>d.id===issue.document_id);return <tr key={issue.id}><td><strong>{doc?.reference||'Document'}</strong><small>{doc?.title}</small></td><td>{issue.revision_code}</td><td>#{issue.issue_sequence}</td><td>{issue.purpose.replaceAll('_',' ')}</td><td>{issue.recipient_name||issue.recipient_email||'Controlled release'}</td><td>{formatDate(issue.issued_at)}</td></tr>})}</tbody></table></div></section>:null}
  </div>;
}

function Register({title,description,documents,current=false}:{title:string;description:string;documents:RegistryDocument[];current?:boolean}){
  return <section className="document-registry__table-wrap"><div className="document-registry__heading"><div><p className="vp-label">Document register</p><h2>{title}</h2><p style={{margin:'6px 0 0',color:'var(--op-muted)'}}>{description}</p></div><span>{documents.length} documents</span></div><div className="document-registry__table-scroll"><table><thead><tr><th>Document number</th><th>Document</th><th>Revision</th><th>Control state</th><th>Purpose</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{documents.map(document=><tr id={`document-${document.id}`} key={document.id}><td><strong>{document.reference}</strong></td><td><span>{document.title}</span><small>{canonicalDocumentSlug(document.document_type).replaceAll('-',' ')}</small></td><td><strong>{revision(document)}</strong><small>v{document.version}</small></td><td><span className={`document-status document-status--${document.status}`}>{state(document).replaceAll('_',' ')}</span></td><td>{(document.issue_purpose||'internal').replaceAll('_',' ')}</td><td>{formatDate(document.updated_at||document.created_at)}</td><td><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="button secondary" href={openUrl(document)}>Open</Link>{current&&['signed','approved','issued','published'].includes(document.status)?<form action={createDocumentRevisionAction}><input type="hidden" name="document_id" value={document.id}/><button className="button secondary" type="submit">New revision</button></form>:null}{current&&['approved','issued','published'].includes(document.status)?<details className="vp-disclosure" style={{minWidth:180}}><summary>Withdraw</summary><form action={withdrawControlledDocumentAction} className="stack" style={{paddingTop:10}}><input type="hidden" name="document_id" value={document.id}/><label>Reason<textarea name="reason" rows={2} required/></label><button className="button secondary" type="submit">Withdraw revision</button></form></details>:null}</div></td></tr>)}</tbody></table></div></section>
}
