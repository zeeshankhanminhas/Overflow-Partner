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
    <div className="lifecycle-nav__overview">
      <p className="op-nav-label">Home</p>
      <Link className={pathname === n.missionControl.href ? 'active' : ''} href={n.missionControl.href}>{n.missionControl.label}</Link>
      <Link className={pathname.startsWith(n.approvals.href) ? 'active' : ''} href={n.approvals.href}>{n.approvals.label}</Link>
    </div>

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
          <Link className={pathname === '/workspace/documents' && searchParams.get('lead') === context.id ? 'active' : ''} href={`/workspace/documents?lead=${context.id}`}>Documents</Link>
        </> : null}
        {context.type === 'project' ? <>
          <Link className={pathname === `/workspace/projects/${context.id}/delivery` ? 'active' : ''} href={`/workspace/projects/${context.id}/delivery`}>Delivery</Link>
          <Link className={pathname === `/workspace/projects/${context.id}/execution` ? 'active' : ''} href={`/workspace/projects/${context.id}/execution`}>Partner execution</Link>
          <Link className={pathname === '/workspace/documents' && searchParams.get('project') === context.id ? 'active' : ''} href={`/workspace/documents?project=${context.id}`}>Documents</Link>
          <Link className={pathname === '/workspace/payments' && searchParams.get('project') === context.id ? 'active' : ''} href={`/workspace/payments?project=${context.id}`}>Payments</Link>
          <Link className={pathname.startsWith(`/workspace/communications/project/${context.id}`) ? 'active' : ''} href={`/workspace/communications/project/${context.id}`}>Messages</Link>
          <Link className={pathname.startsWith('/workspace/commercial-control') && searchParams.get('project') === context.id ? 'active' : ''} href={`/workspace/commercial-control?project=${context.id}`}>Commercial</Link>
        </> : null}
      </div>
    </section> : null}

    <Area title="Work" description="Enquiry to delivery" open={pathname.startsWith('/workspace/acquisition') || pathname.startsWith('/workspace/leads') || pathname.startsWith(n.assessments.href) || pathname.startsWith(n.projects.href)}>
      <Link className={pathname.startsWith('/workspace/acquisition') ? 'active' : ''} href={n.enquiries.href}>{n.enquiries.label}</Link>
      <Link className={pathname.startsWith(n.cases.href) ? 'active' : ''} href={n.cases.href}>{n.cases.label}</Link>
      <Link className={pathname.startsWith(n.assessments.href) ? 'active' : ''} href={n.assessments.href}>{n.assessments.label}</Link>
      <Link className={pathname.startsWith(n.projects.href) ? 'active' : ''} href={n.projects.href}>{n.projects.label}</Link>
    </Area>

    <Area title="Commercial" description="Quotes, cash & supply" open={pathname.startsWith(n.quotes.href) || pathname.startsWith(n.payments.href) || pathname.startsWith(n.commercialControl.href) || pathname.startsWith(n.partners.href)}>
      <Link className={pathname.startsWith(n.quotes.href) ? 'active' : ''} href={n.quotes.href}>{n.quotes.label}</Link>
      <Link className={pathname.startsWith(n.payments.href) ? 'active' : ''} href={n.payments.href}>{n.payments.label}</Link>
      <Link className={pathname.startsWith(n.commercialControl.href) ? 'active' : ''} href={n.commercialControl.href}>{n.commercialControl.label}</Link>
      <Link className={pathname.startsWith(n.partners.href) ? 'active' : ''} href={n.partners.href}>{n.partners.label}</Link>
    </Area>

    <Area title="Operations" description="Actions, evidence & issues" open={pathname.startsWith(n.issues.href) || pathname.startsWith(n.documents.href) || pathname.startsWith(n.actions.href) || pathname.startsWith(n.messages.href)}>
      <Link className={pathname.startsWith(n.issues.href) ? 'active' : ''} href={n.issues.href}>{n.issues.label}</Link>
      <Link className={pathname.startsWith(n.actions.href) ? 'active' : ''} href={n.actions.href}>{n.actions.label}</Link>
      <Link className={pathname.startsWith(n.documents.href) ? 'active' : ''} href={n.documents.href}>{n.documents.label}</Link>
      <Link className={pathname.startsWith(n.messages.href) ? 'active' : ''} href={n.messages.href}>{n.messages.label}</Link>
    </Area>

    <Area title="Intelligence" description="Performance & assurance" open={pathname.startsWith(n.executive.href) || pathname.startsWith(n.risk.href) || pathname.startsWith(n.knowledge.href)}>
      <Link className={pathname.startsWith(n.executive.href) ? 'active' : ''} href={n.executive.href}>{n.executive.label}</Link>
      <Link className={pathname.startsWith(n.risk.href) ? 'active' : ''} href={n.risk.href}>{n.risk.label}</Link>
      <Link className={pathname.startsWith(n.knowledge.href) ? 'active' : ''} href={n.knowledge.href}>{n.knowledge.label}</Link>
    </Area>

    <div className="lifecycle-nav__overview">
      <p className="op-nav-label">Admin</p>
      <Link className={isActive(pathname, n.search.href) ? 'active' : ''} href={n.search.href}>{n.search.label}</Link>
      <Link className={isActive(pathname, n.notifications.href) ? 'active' : ''} href={n.notifications.href}>{n.notifications.label}</Link>
      <Link className={isActive(pathname, n.settings.href) ? 'active' : ''} href={n.settings.href}>{n.settings.label}</Link>
    </div>
  </nav>;
}
