'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { lifecycleStages, type LifecycleStageKey } from '@/lib/lifecycle/config';

const stageOrder: LifecycleStageKey[] = ['acquire','assess','commercial','deliver','close'];

const stagePurpose: Record<LifecycleStageKey,string> = {
  acquire: 'Capture and qualify engineering enquiries.',
  assess: 'Establish technical feasibility and evidence.',
  commercial: 'Convert approved scope into a controlled offer.',
  deliver: 'Mobilise, execute, review and issue deliverables.',
  close: 'Complete handover, evidence and formal closure.',
};

function activeStageForPath(pathname: string): LifecycleStageKey | null {
  if (pathname.startsWith('/workspace/acquisition')) return 'acquire';
  if (pathname.startsWith('/workspace/leads')) return 'assess';
  if (pathname.startsWith('/workspace/projects')) return 'deliver';
  return null;
}

function recordContext(pathname: string) {
  const caseMatch = pathname.match(/^\/workspace\/leads\/([^/]+)/);
  if (caseMatch) return { type: 'case' as const, id: caseMatch[1] };
  const projectMatch = pathname.match(/^\/workspace\/projects\/([^/]+)/);
  if (projectMatch) return { type: 'project' as const, id: projectMatch[1] };
  return null;
}

function isLinkActive(pathname: string, href: string) {
  if (href === '/workspace') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function LifecycleSidebar() {
  const pathname = usePathname();
  const activeStage = activeStageForPath(pathname);
  const context = recordContext(pathname);
  const [expandedStage, setExpandedStage] = useState<LifecycleStageKey>(activeStage || 'acquire');

  useEffect(() => {
    if (activeStage) setExpandedStage(activeStage);
  }, [activeStage]);

  return <nav aria-label="Business lifecycle" className="lifecycle-nav">
    <div className="lifecycle-nav__overview">
      <p className="midts-nav-label">Overview</p>
      <Link className={pathname === '/workspace' ? 'active' : ''} href="/workspace">Dashboard</Link>
      <Link className={pathname === '/workspace/notifications' ? 'active' : ''} href="/workspace/notifications">Notifications</Link>
    </div>

    {context ? <section className="lifecycle-context">
      <div className="lifecycle-context__heading">
        <div><p className="midts-nav-label">{context.type === 'case' ? 'Case 360' : 'Project 360'}</p><strong>{context.id.slice(0,8).toUpperCase()}</strong></div>
        <span>Active record</span>
      </div>
      <div className="lifecycle-context__links">
        <Link className={pathname === (context.type === 'case' ? `/workspace/leads/${context.id}` : `/workspace/projects/${context.id}`) ? 'active' : ''} href={context.type === 'case' ? `/workspace/leads/${context.id}` : `/workspace/projects/${context.id}`}>Overview</Link>
        <Link className={pathname.startsWith('/workspace/communications/') ? 'active' : ''} href={`/workspace/communications/${context.type === 'case' ? 'lead' : 'project'}/${context.id}`}>Communications</Link>
        <Link href={context.type === 'case' ? `/workspace/documents?lead=${context.id}` : `/workspace/documents?project=${context.id}`}>Evidence</Link>
      </div>
    </section> : null}

    <section className="lifecycle-nav__stages" aria-labelledby="business-lifecycle-label">
      <p className="midts-nav-label" id="business-lifecycle-label">Business lifecycle</p>
      <div className="lifecycle-rail">
        {stageOrder.map((stageKey, index) => {
          const stage = lifecycleStages[stageKey];
          const current = activeStage === stageKey;
          const completed = activeStage ? stageOrder.indexOf(activeStage) > index : false;
          const expanded = expandedStage === stageKey;
          return <section key={stageKey} className={`lifecycle-stage ${current ? 'is-current' : ''} ${completed ? 'is-complete' : ''} ${expanded ? 'is-expanded' : ''}`}>
            <div className="lifecycle-stage__marker"><span>{completed ? '✓' : stage.number}</span><i /></div>
            <div className="lifecycle-stage__body">
              <button
                type="button"
                className="lifecycle-stage__toggle"
                aria-expanded={expanded}
                aria-controls={`lifecycle-stage-${stageKey}`}
                onClick={() => setExpandedStage(stageKey)}
              >
                <span className="lifecycle-stage__copy">
                  <span className="lifecycle-stage__heading"><strong>{stage.label}</strong>{current ? <em>Current</em> : null}</span>
                  <small>{stagePurpose[stageKey]}</small>
                </span>
                <span className="lifecycle-stage__chevron" aria-hidden="true">{expanded ? '⌄' : '›'}</span>
              </button>
              {expanded ? <div className="lifecycle-stage__panel" id={`lifecycle-stage-${stageKey}`}>
                <div className="lifecycle-stage__links">{stage.substages.map(item => <Link className={isLinkActive(pathname,item.href) ? 'active' : ''} key={item.key} href={item.href}><span>{item.label}</span></Link>)}</div>
              </div> : null}
            </div>
          </section>;
        })}
      </div>
    </section>

    <details className="lifecycle-utility">
      <summary><span>Control</span><small>Evidence & operations</small><b aria-hidden="true">›</b></summary>
      <div>
        <Link className={pathname.startsWith('/workspace/documents') ? 'active' : ''} href="/workspace/documents">Evidence registry</Link>
        <Link className={pathname.startsWith('/workspace/communications') ? 'active' : ''} href="/workspace/notifications">Communications</Link>
        <Link className={pathname.startsWith('/workspace/partners') ? 'active' : ''} href="/workspace/partners">Partners</Link>
      </div>
    </details>

    <details className="lifecycle-utility">
      <summary><span>System</span><small>Workspace configuration</small><b aria-hidden="true">›</b></summary>
      <div><Link className={pathname.startsWith('/workspace/settings') ? 'active' : ''} href="/workspace/settings">Settings</Link></div>
    </details>
  </nav>;
}
