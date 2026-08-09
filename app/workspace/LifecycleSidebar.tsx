'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

type RecordContext =
  | { type: 'acquisition'; id: string }
  | { type: 'case'; id: string }
  | { type: 'project'; id: string };

function recordContext(pathname: string, searchParams: URLSearchParams): RecordContext | null {
  const acquisitionMatch = pathname.match(/^\/workspace\/acquisition\/([^/]+)$/);
  if (acquisitionMatch && !['prospects', 'intake'].includes(acquisitionMatch[1])) return { type: 'acquisition', id: acquisitionMatch[1] };

  const caseMatch = pathname.match(/^\/workspace\/leads\/([^/]+)/);
  if (caseMatch) return { type: 'case', id: caseMatch[1] };

  const projectMatch = pathname.match(/^\/workspace\/projects\/([^/]+)/);
  if (projectMatch) return { type: 'project', id: projectMatch[1] };

  const commsMatch = pathname.match(/^\/workspace\/communications\/(lead|project)\/([^/]+)/);
  if (commsMatch) return { type: commsMatch[1] === 'lead' ? 'case' : 'project', id: commsMatch[2] };

  if (pathname === '/workspace/documents') {
    const project = searchParams.get('project');
    if (project) return { type: 'project', id: project };
    const lead = searchParams.get('lead');
    if (lead) return { type: 'case', id: lead };
  }

  if (pathname === '/workspace/payments' || pathname === '/workspace/commercial-control') {
    const project = searchParams.get('project');
    if (project) return { type: 'project', id: project };
  }

  return null;
}

function isActive(pathname: string, href: string) {
  if (href === '/workspace') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Area({ title, description, open, children }: { title: string; description: string; open?: boolean; children: React.ReactNode }) {
  return <details className="lifecycle-utility" open={open}>
    <summary><span>{title}</span><small>{description}</small><b aria-hidden="true">›</b></summary>
    <div>{children}</div>
  </details>;
}

export default function LifecycleSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const context = useMemo(() => recordContext(pathname, searchParams), [pathname, searchParams]);

  const contextHome = context?.type === 'acquisition'
    ? `/workspace/acquisition/${context.id}`
    : context?.type === 'case'
      ? `/workspace/leads/${context.id}`
      : context?.type === 'project'
        ? `/workspace/projects/${context.id}`
        : '';

  const contextList = context?.type === 'acquisition'
    ? '/workspace/acquisition/prospects'
    : context?.type === 'case'
      ? '/workspace/leads'
      : context?.type === 'project'
        ? '/workspace/projects'
        : '';

  const contextLabel = context?.type === 'acquisition' ? 'Acquisition' : context?.type === 'case' ? 'Case 360' : 'Project 360';
  const contextListLabel = context?.type === 'acquisition' ? 'All acquisition' : context?.type === 'case' ? 'All cases' : 'All projects';

  return <nav aria-label="Workspace navigation" className="lifecycle-nav">
    <div className="lifecycle-nav__overview">
      <p className="midts-nav-label">Home</p>
      <Link className={pathname === '/workspace' ? 'active' : ''} href="/workspace">Home</Link>
    </div>

    {context ? <section className="lifecycle-context">
      <div className="lifecycle-context__heading">
        <div><p className="midts-nav-label">{contextLabel}</p><strong>{context.id.slice(0, 8).toUpperCase()}</strong></div>
        <span>Current record</span>
      </div>
      <div className="lifecycle-context__links">
        <Link href={contextList}>← {contextListLabel}</Link>
        <Link className={pathname === contextHome ? 'active' : ''} href={contextHome}>Overview</Link>
        {context.type === 'case' ? <Link className={pathname.startsWith(`/workspace/communications/lead/${context.id}`) ? 'active' : ''} href={`/workspace/communications/lead/${context.id}`}>Communications</Link> : null}
        {context.type === 'project' ? <>
          <Link className={pathname.startsWith(`/workspace/communications/project/${context.id}`) ? 'active' : ''} href={`/workspace/communications/project/${context.id}`}>Communications</Link>
          <Link className={pathname === '/workspace/documents' && searchParams.get('project') === context.id ? 'active' : ''} href={`/workspace/documents?project=${context.id}`}>Documents</Link>
          <Link className={pathname === '/workspace/payments' && searchParams.get('project') === context.id ? 'active' : ''} href={`/workspace/payments?project=${context.id}`}>Payments</Link>
          <Link className={pathname.startsWith('/workspace/commercial-control') && searchParams.get('project') === context.id ? 'active' : ''} href={`/workspace/commercial-control?project=${context.id}`}>Commercial</Link>
        </> : null}
        {context.type === 'case' ? <Link className={pathname === '/workspace/documents' && searchParams.get('lead') === context.id ? 'active' : ''} href={`/workspace/documents?lead=${context.id}`}>Documents</Link> : null}
      </div>
    </section> : null}

    <Area title="Work" description="Acquisition, cases & projects" open={pathname.startsWith('/workspace/acquisition') || pathname.startsWith('/workspace/leads') || pathname.startsWith('/workspace/projects')}>
      <Link className={pathname.startsWith('/workspace/acquisition') ? 'active' : ''} href="/workspace/acquisition/prospects">Acquisition</Link>
      <Link className={pathname.startsWith('/workspace/leads') ? 'active' : ''} href="/workspace/leads">Cases</Link>
      <Link className={pathname.startsWith('/workspace/projects') ? 'active' : ''} href="/workspace/projects">Projects</Link>
    </Area>

    <Area title="Commercial" description="Payments, control & partners" open={pathname.startsWith('/workspace/payments') || pathname.startsWith('/workspace/commercial-control') || pathname.startsWith('/workspace/partners')}>
      <Link className={pathname.startsWith('/workspace/payments') ? 'active' : ''} href="/workspace/payments">Payments</Link>
      <Link className={pathname.startsWith('/workspace/commercial-control') ? 'active' : ''} href="/workspace/commercial-control">Commercial</Link>
      <Link className={pathname.startsWith('/workspace/partners') ? 'active' : ''} href="/workspace/partners">Partners</Link>
    </Area>

    <Area title="Operations" description="Documents, tasks & communications" open={pathname.startsWith('/workspace/documents') || pathname.startsWith('/workspace/tasks') || pathname.startsWith('/workspace/communications')}>
      <Link className={pathname.startsWith('/workspace/documents') ? 'active' : ''} href="/workspace/documents">Documents</Link>
      <Link className={pathname.startsWith('/workspace/tasks') ? 'active' : ''} href="/workspace/tasks">Tasks</Link>
      <Link className={pathname.startsWith('/workspace/communications') ? 'active' : ''} href="/workspace/communications">Communications</Link>
    </Area>

    <Area title="Insights" description="Performance, risk & knowledge" open={pathname.startsWith('/workspace/intelligence') || pathname.startsWith('/workspace/risk') || pathname.startsWith('/workspace/knowledge')}>
      <Link className={pathname.startsWith('/workspace/intelligence') ? 'active' : ''} href="/workspace/intelligence">Executive</Link>
      <Link className={pathname.startsWith('/workspace/risk') ? 'active' : ''} href="/workspace/risk">Risk &amp; Compliance</Link>
      <Link className={pathname.startsWith('/workspace/knowledge') ? 'active' : ''} href="/workspace/knowledge">Knowledge</Link>
    </Area>

    <div className="lifecycle-nav__overview">
      <p className="midts-nav-label">System</p>
      <Link className={isActive(pathname, '/workspace/search') ? 'active' : ''} href="/workspace/search">Search</Link>
      <Link className={isActive(pathname, '/workspace/notifications') ? 'active' : ''} href="/workspace/notifications">Notifications</Link>
      <Link className={isActive(pathname, '/workspace/settings') ? 'active' : ''} href="/workspace/settings">Settings</Link>
    </div>
  </nav>;
}
