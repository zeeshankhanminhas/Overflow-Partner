import type { ReactNode } from 'react';
import Link from 'next/link';
import ProjectRealtimeRefresh from '@/components/workspace/ProjectRealtimeRefresh';

/** Tools remain reachable; overview is the only always-visible destination. */
export default async function ProjectLayout({children,params}:{children:ReactNode;params:Promise<{id:string}>}){
  const {id}=await params;
  return <>
    <ProjectRealtimeRefresh projectId={id}/>
    <nav className="op-focus-project-nav" aria-label="Project 360 navigation">
      <Link className="op-focus-project-nav__overview" href={`/workspace/projects/${id}`}>Project overview</Link>
      <details className="op-focus-project-nav__tools">
        <summary>Project tools</summary>
        <div>
          <Link href={`/workspace/projects/${id}/delivery`}>Delivery</Link>
          <Link href={`/workspace/projects/${id}/execution`}>Execution</Link>
          <Link href={`/workspace/documents?project=${id}`}>Documents</Link>
          <Link href={`/workspace/payments?project=${id}`}>Payments</Link>
          <Link href={`/workspace/communications/project/${id}`}>Messages</Link>
        </div>
      </details>
    </nav>
    {children}
  </>;
}
