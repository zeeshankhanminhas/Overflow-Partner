import Link from 'next/link';
import {requireUserContext} from '@/lib/auth/context';
import {workspaceDocuments} from '@/components/workspace/documents/documentRegistry';
import css from './document-library.module.css';

export const dynamic='force-dynamic';
const PAGE_SIZE=25;
type Project={id:string;project_number:string;title:string;project_stage:string};
type Doc={id:string;title:string|null;reference:string|null;document_type:string|null;status:string|null;control_state:string|null;version:number|null;project_id:string|null;lead_id:string|null;created_at:string};
type Params={scope?:string;project?:string;type?:string;status?:string;search?:string;page?:string;project_page?:string};
const validId=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const readable=(value:string|null|undefined)=>String(value||'Unclassified').replaceAll('_',' ').replaceAll('-',' ');
function href(p:Params){const q=new URLSearchParams();for(const [key,v] of Object.entries(p))if(v)q.set(key,v);return '/opos-next/documents'+(q.size?'?'+q:'');}
function docTypeLabel(type:string){return workspaceDocuments.find(d=>d.slug===type)?.title||readable(type);}
export default async function DocumentsPage({searchParams}:{searchParams?:Promise<Params>}){
 const raw=searchParams?await searchParams:{};
 const scope=['all','unassigned'].includes(String(raw.scope))?String(raw.scope):'project';
 const requestedProject=String(raw.project||'').slice(0,80);
 const projectId=validId(requestedProject)?requestedProject:'';
 const type=String(raw.type||'').slice(0,80);
 const status=String(raw.status||'').slice(0,40);
 const search=String(raw.search||'').trim().slice(0,80);
 const requestedPage=Number.parseInt(String(raw.page||'1'),10);
 const page=Number.isFinite(requestedPage)?Math.max(1,Math.min(10000,requestedPage)):1;
 const requestedProjectPage=Number.parseInt(String(raw.project_page||'1'),10);
 const projectPage=Number.isFinite(requestedProjectPage)?Math.max(1,Math.min(10000,requestedProjectPage)):1;
 const {supabase,organisationId}=await requireUserContext();
 // Project navigation is paginated independently of the document register.
 const projectOffset=(projectPage-1)*PAGE_SIZE;
 const projectsResult=await supabase.rpc('op_project_queue',{
  p_organisation_id:organisationId,p_view:'all',p_limit:PAGE_SIZE+1,p_offset:projectOffset,
 });
 if(projectsResult.error)throw new Error('Project directory could not be loaded.');
 const projectBatch=(projectsResult.data||[]) as Project[];
 const projects=projectBatch.slice(0,PAGE_SIZE);
 const hasMoreProjects=projectBatch.length>PAGE_SIZE;
 // Exact selected-project membership is verified against the same
 // organisation-scoped project queue, not inferred from an arbitrary URL ID.
 // A project can be selected only when present on the current directory page.
 const selected=projects.find(p=>p.id===projectId)||null;
 const showRegister=scope!=='project'||Boolean(selected);
 let documents:Doc[]=[];let total=0;
 if(showRegister){
  let query=supabase.from('documents').select(
   'id,title,reference,document_type,status,control_state,version,project_id,lead_id,created_at',
   {count:'exact'}).eq('organisation_id',organisationId);
  if(scope==='project'&&selected)query=query.eq('project_id',selected.id);
  if(scope==='unassigned')query=query.is('project_id',null);
  if(type)query=query.eq('document_type',type);
  if(['draft','approved','issued','published','superseded'].includes(status))query=query.eq('status',status);
  if(search)query=query.ilike('title','%'+search.replace(/[%,_]/g,'')+'%');
  const result=await query.order('created_at',{ascending:false}).range(
   (page-1)*PAGE_SIZE,page*PAGE_SIZE-1);
  if(result.error)throw new Error('Document register could not be loaded.');
  documents=(result.data||[]) as Doc[];total=result.count||0;
 }
 const base:Params={scope,project:selected?.id,type,status,search,project_page:String(projectPage)};
 const typeOptions=[...new Set(workspaceDocuments.map(d=>d.slug))].sort();
 const pageCount=Math.ceil(total/PAGE_SIZE);
 return <section className={css.library}>
  <header className={css.header}>
   <div><p className={css.eyebrow}>DOCUMENT CONTROL / WORKSPACE 2.0</p>
    <h1>Documents</h1>
    <p>Organised by project and document type. Every revision stays in the governed register.</p></div>
   <Link className={css.secondary} href="/opos-next/projects">Projects</Link>
  </header>
  <nav className={css.scopes} aria-label="Document register views">
   <Link href={href({})} aria-current={scope==='project'?'page':undefined} className={scope==='project'?css.active:css.scope}>By project</Link>
   <Link href={href({scope:'all'})} aria-current={scope==='all'?'page':undefined} className={scope==='all'?css.active:css.scope}>All documents</Link>
   <Link href={href({scope:'unassigned'})} aria-current={scope==='unassigned'?'page':undefined} className={scope==='unassigned'?css.active:css.scope}>Case / unassigned</Link>
  </nav>
  {scope==='project'?<section className={css.panel} aria-label="Project document libraries">
   <div className={css.panelHeading}><h2>Select project</h2><span>Showing up to {PAGE_SIZE} projects per page</span></div>
   <div className={css.projectGrid}>{projects.map(p=><Link key={p.id}
     href={href({scope:'project',project:p.id,project_page:String(projectPage)})}
     className={selected?.id===p.id?css.selectedProject:css.project}>
     <small>{p.project_number}</small><strong>{p.title||p.project_number}</strong>
     <span>{readable(p.project_stage)} · Documents</span>
    </Link>)}</div>
   {!projects.length?<p className={css.empty}>No projects in this view.</p>:null}
   <div className={css.paging}>
    {projectPage>1?<Link href={href({project_page:String(projectPage-1)})}>Previous projects</Link>:null}
    <span>Projects page {projectPage}</span>
    {hasMoreProjects?<Link href={href({project_page:String(projectPage+1)})}>Next projects</Link>:null}
   </div>
  </section>:null}
  {showRegister?<section className={css.panel} aria-label="Controlled document register">
   <div className={css.panelHeading}><div>
    <h2>{selected?.project_number|| (scope==='unassigned'?'Case and unassigned documents':'All organisation documents')}</h2>
    <p>{total} matching records, including historic revisions</p></div>
    {selected?<Link className={css.secondary} href={'/opos-next/projects/'+selected.id}>Open Project 360</Link>:null}
   </div>
   <form method="get" action="/opos-next/documents" className={css.filters} role="search">
    <input type="hidden" name="scope" value={scope}/>
    {selected?<input type="hidden" name="project" value={selected.id}/>:null}
    <input type="hidden" name="project_page" value={projectPage}/>
    <label>Document title<input name="search" type="search" maxLength={80} defaultValue={search} placeholder="Search title…"/></label>
    <label>Document type<select name="type" defaultValue={type}>
     <option value="">All document types</option>
     {typeOptions.map(t=><option key={t} value={t}>{docTypeLabel(t)}</option>)}
     {type&&!typeOptions.some(option=>option===type)?<option value={type}>{docTypeLabel(type)}</option>:null}
    </select></label>
    <label>Status<select name="status" defaultValue={status}>
     <option value="">All statuses</option>
     {['draft','approved','issued','published','superseded'].map(s=><option value={s} key={s}>{readable(s)}</option>)}
    </select></label>
    <button type="submit">Filter documents</button>
    {(type||status||search)?<Link className={css.secondary} href={href({scope,project:selected?.id,project_page:String(projectPage)})}>Clear filters</Link>:null}
   </form>
   <div className={css.rows}>{documents.map(d=><Link className={css.row} key={d.id} href={'/opos-next/documents/'+d.id}>
    <div><small>{docTypeLabel(d.document_type||'')}</small><strong>{d.title||d.reference||'Controlled document'}</strong>
     <span>{d.reference||'No reference'} · Revision {d.version??1}</span></div>
    <div className={css.rowMeta}><span>{readable(d.control_state||d.status)}</span><small>{new Date(d.created_at).toLocaleDateString('en-GB')}</small></div>
   </Link>)}</div>
   {!documents.length?<p className={css.empty}>No documents match this selection.</p>:null}
   <div className={css.paging}>
    {page>1?<Link href={href({...base,page:String(page-1)})}>Previous documents</Link>:null}
    <span>Page {page}{pageCount?' of '+pageCount:''}</span>
    {page<pageCount?<Link href={href({...base,page:String(page+1)})}>Next documents</Link>:null}
   </div>
  </section>:<section className={css.empty} aria-label="Choose a document library">Choose a project above to browse its document types and revisions, or open All documents for a cross-project audit.</section>}
 </section>;
}
