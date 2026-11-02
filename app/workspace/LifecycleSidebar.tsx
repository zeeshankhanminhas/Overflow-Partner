'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { primaryNavigation as n } from '@/lib/presentation/navigationContract';

type RecordContext =
  | { type:'acquisition'; id:string }
  | { type:'case'; id:string }
  | { type:'project'; id:string };

function recordContext(pathname:string, searchParams:URLSearchParams):RecordContext|null {
  const enquiry=pathname.match(/^\/workspace\/acquisition\/([^/]+)$/);
  if(enquiry&&!['prospects','intake','funnel'].includes(enquiry[1]))return {type:'acquisition',id:enquiry[1]};
  const lead=pathname.match(/^\/workspace\/leads\/([^/]+)/);
  if(lead)return {type:'case',id:lead[1]};
  const project=pathname.match(/^\/workspace\/projects\/([^/]+)/);
  if(project)return {type:'project',id:project[1]};
  const messages=pathname.match(/^\/workspace\/communications\/(lead|project)\/([^/]+)/);
  if(messages)return {type:messages[1]==='lead'?'case':'project',id:messages[2]};
  if(pathname.startsWith('/workspace/documents')){
    const projectId=searchParams.get('project');if(projectId)return {type:'project',id:projectId};
    const leadId=searchParams.get('lead');if(leadId)return {type:'case',id:leadId};
  }
  if(pathname==='/workspace/payments'||pathname==='/workspace/commercial-control'){
    const projectId=searchParams.get('project');if(projectId)return {type:'project',id:projectId};
  }
  return null;
}

function NavSection({title,children}:{title:string;children:React.ReactNode}){
  return <section className="lifecycle-nav__overview">
    <p className="op-nav-label">{title}</p>{children}
  </section>;
}
function active(pathname:string,href:string){
  return href==='/workspace'?pathname===href:pathname===href||pathname.startsWith(href+'/');
}
export default function LifecycleSidebar(){
  const pathname=usePathname(),searchParams=useSearchParams();
  const context=useMemo(()=>recordContext(pathname,searchParams),[pathname,searchParams]);
  const backHref=context?.type==='project'?n.projects.href:n.opportunities.href;
  const recordHref=context?.type==='project'?'/workspace/projects/'+context.id
    :context?.type==='case'?'/workspace/leads/'+context.id
    :context?'/workspace/acquisition/'+context.id:'';
  const opportunitiesActive=pathname.startsWith('/workspace/acquisition')
    ||pathname.startsWith('/workspace/leads')
    ||pathname.startsWith('/workspace/quotes')
    ||pathname===n.opportunities.href;
  const workActive=pathname==='/workspace/approvals'||pathname==='/workspace/exceptions'
    ||pathname==='/workspace/tasks'||pathname==='/workspace/attention';
  const financeActive=active(pathname,n.finance.href)||active(pathname,n.commercialControl.href);
  const docsActive=active(pathname,n.documents.href);
  const moreActive=active(pathname,n.more.href);

  return <nav aria-label="Workspace navigation" className="lifecycle-nav lifecycle-nav--simplified">
    <NavSection title="Find your work">
      <Link href={n.linkedinFunnel.href} className={active(pathname,n.linkedinFunnel.href)?'active':''}>Outreach</Link>
      <Link href={n.missionControl.href} className={active(pathname,n.missionControl.href)?'active':''}>Home</Link>
      <Link href={n.opportunities.href} className={opportunitiesActive?'active':''}>Opportunities</Link>
      <Link href={n.projects.href} className={active(pathname,n.projects.href)?'active':''}>Projects</Link>
      <Link href={n.finance.href} className={financeActive?'active':''}>Finance</Link>
      <Link href={n.documents.href} className={docsActive?'active':''}>Documents</Link>
    </NavSection>
    {context?<NavSection title="Current record">
      <Link href={backHref}>← {context.type==='project'?'All projects':'All opportunities'}</Link>
      <Link href={recordHref} className={pathname===recordHref?'active':''}>Overview</Link>
      {context.type==='case'?<Link href={`/workspace/communications/lead/${context.id}`}>Messages</Link>:null}
    </NavSection>:null}
    <NavSection title="Supporting tools">
      <Link href={n.myWork.href} className={workActive?'active':''}>My Work</Link>
      <Link href={n.more.href} className={moreActive?'active':''}>More</Link>
    </NavSection>
  </nav>;
}
