'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { primaryNavigation } from '@/lib/presentation/navigationContract';

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

  if (pathname.startsWith('/workspace/documents')) {
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

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="lifecycle-nav__overview">
    <p className="op-nav-label">{title}</p>
    {children}
  </section>;
}

export default function LifecycleSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const context = useMemo(() => recordContext(pathname, searchParams), [pathname, searchParams]);
  const n = primaryNavigation;

  const contextHome = context?.type === 'acquisition'
    ? `/workspace/acquisition/${context.id}`
    : context?.type === 'case'
      ? `/workspace/leads/${context.id}`
      : context?.type === 'project'
        ? `/workspace/projects/${context.id}`
        : '';

  const contextList = context?.type === 'acquisition'
    ? n.enquiries.href
    : context?.type === 'case'
      ? n.cases.href
      : context?.type === 'project'
        ? n.projects.href
        : '';

  const contextLabel = context?.type === 'acquisition' ? 'Enquiry' : context?.type === 'case' ? 'Case' : 'Project';
  const contextListLabel = context?.type === 'acquisition' ? 'All enquiries' : context?.type === 'case' ? 'All cases' : 'All projects';

  return <nav aria-label="Workspace navigation" className="lifecycle-nav">
    <NavSection title="Home">
      <Link className={pathname === n.missionControl.href ? 'active' : ''} href={n.missionControl.href}>{n.missionControl.label}</Link>
      <Link className={isActive(pathname, n.approvals.href) ? 'active' : ''} href={n.approvals.href}>{n.approvals.label}</Link>
    </NavSection>

    {context ? <section className="lifecycle-context">
      <div className="lifecycle-context__heading">
        <div><p className="op-nav-label">Current record</p><strong>{contextLabel}</strong></div>
        <span>Working context</span>
      </div>
      <div className="lifecycle-context__links">
        <Link href={contextList}>← {contextListLabel}</Link>
        <Link className={pathname === contextHome ? 'active' : ''} href={contextHome}>Overview</Link>
        {context.type === 'case' ? <>
          <Link className={pathname.startsWith(`/workspace/communications/lead/${context.id}`) ? 'active' : ''} href={`/workspace/communications/lead/${context.id}`}>Messages</Link>
          <Link className={pathname.startsWith('/workspace/documents') && searchParams.get('lead') === context.id ? 'active' : ''} href={`/workspace/documents?lead=${context.id}`}>Documents</Link>
        </> : null}
        {context.type === 'project' ? <>
          <Link className={pathname === `/workspace/projects/${context.id}/delivery` ? 'active' : ''} href={`/workspace/projects/${context.id}/delivery`}>Delivery</Link>
          <Link className={pathname === `/workspace/projects/${context.id}/execution` ? 'active' : ''} href={`/workspace/projects/${context.id}/execution`}>Execution</Link>
          <Link className={pathname.startsWith('/workspace/documents') && searchParams.get('project') === context.id ? 'active' : ''} href={`/workspace/documents?project=${context.id}`}>Documents</Link>
          <Link className={pathname === '/workspace/payments' && searchParams.get('project') === context.id ? 'active' : ''} href={`/workspace/payments?project=${context.id}`}>Payments</Link>
          <Link className={pathname.startsWith(`/workspace/communications/project/${context.id}`) ? 'active' : ''} href={`/workspace/communications/project/${context.id}`}>Messages</Link>
          <Link className={pathname.startsWith('/workspace/commercial-control') && searchParams.get('project') === context.id ? 'active' : ''} href={`/workspace/commercial-control?project=${context.id}`}>Commercial</Link>
        </> : null}
      </div>
    </section> : null}

    <NavSection title="Operate">
      <Link className={pathname.startsWith('/workspace/acquisition') || pathname.startsWith(n.assessments.href) ? 'active' : ''} href={n.enquiries.href}>{n.enquiries.label}</Link>
      <Link className={pathname.startsWith(n.cases.href) ? 'active' : ''} href={n.cases.href}>{n.cases.label}</Link>
      <Link className={pathname.startsWith(n.projects.href) ? 'active' : ''} href={n.projects.href}>{n.projects.label}</Link>
    </NavSection>

    <NavSection title="Control">
      <Link className={isActive(pathname, n.quotes.href) ? 'active' : ''} href={n.quotes.href}>{n.quotes.label}</Link>
      <Link className={isActive(pathname, n.payments.href) ? 'active' : ''} href={n.payments.href}>{n.payments.label}</Link>
      <Link className={isActive(pathname, n.commercialControl.href) ? 'active' : ''} href={n.commercialControl.href}>{n.commercialControl.label}</Link>
      <Link className={isActive(pathname, n.issues.href) ? 'active' : ''} href={n.issues.href}>{n.issues.label}</Link>
      <Link className={isActive(pathname, n.actions.href) ? 'active' : ''} href={n.actions.href}>{n.actions.label}</Link>
    </NavSection>

    <NavSection title="Reference">
      <Link className={isActive(pathname, n.documents.href) ? 'active' : ''} href={n.documents.href}>{n.documents.label}</Link>
      <Link className={isActive(pathname, n.partners.href) ? 'active' : ''} href={n.partners.href}>{n.partners.label}</Link>
      <Link className={isActive(pathname, n.executive.href) ? 'active' : ''} href={n.executive.href}>{n.executive.label}</Link>
      <Link className={isActive(pathname, n.risk.href) ? 'active' : ''} href={n.risk.href}>{n.risk.label}</Link>
      <Link className={isActive(pathname, n.knowledge.href) ? 'active' : ''} href={n.knowledge.href}>{n.knowledge.label}</Link>
    </NavSection>

    <NavSection title="System">
      <Link className={isActive(pathname, n.settings.href) ? 'active' : ''} href={n.settings.href}>{n.settings.label}</Link>
    </NavSection>
  </nav>;
}