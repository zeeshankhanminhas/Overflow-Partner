import type { ReactNode } from 'react';
import Link from 'next/link';

export default async function ProjectLayout({children,params}:{children:ReactNode;params:Promise<{id:string}>}){
  const {id}=await params;
  return <>
    <nav aria-label="Project 360 navigation" style={{display:'flex',gap:6,overflowX:'auto',padding:'0 0 12px',marginBottom:4,scrollbarWidth:'thin'}}>
      <Link className="button secondary" href={`/workspace/projects/${id}`}>Overview</Link>
      <Link className="button secondary" href={`/workspace/projects/${id}/delivery`}>Delivery</Link>
      <Link className="button secondary" href={`/workspace/projects/${id}/execution`}>Execution</Link>
      <Link className="button secondary" href={`/workspace/documents?project=${id}`}>Documents</Link>
      <Link className="button secondary" href={`/workspace/payments?project=${id}`}>Payments</Link>
      <Link className="button secondary" href={`/workspace/communications/project/${id}`}>Messages</Link>
    </nav>
    {children}
  </>;
}