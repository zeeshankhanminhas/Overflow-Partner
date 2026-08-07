'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { lifecycleStages, type LifecycleStageKey } from '@/lib/lifecycle/config';

const stageOrder: LifecycleStageKey[] = ['acquire','assess','commercial','deliver','close'];

const stagePurpose: Record<LifecycleStageKey,string> = {
  acquire: 'Capture and qualify engineering enquiries.',
  assess: 'Establish technical feasibility and evidence.',
  commercial: 'Convert approved scope into a controlled offer.',
  deliver: 'Mobilise, execute, review and issue deliverables.',
  close: 'Complete handover, evidence and formal closure.',
};

const navigation: Record<LifecycleStageKey, Array<{key:string;label:string;href:string}>> = {
  acquire: [
    { key: 'prospects', label: 'Prospects', href: '/workspace/acquisition/prospects' },
    { key: 'intake', label: 'Technical Intake', href: '/workspace/acquisition/intake' },
  ],
  assess: [
    { key: 'cases', label: 'Cases', href: '/workspace/leads?view=assessment' },
    { key: 'partner-review', label: 'Partner Review', href: '/workspace/leads?view=partner-review' },
  ],
  commercial: [
    { key: 'partner-pricing', label: 'Partner Pricing', href: '/workspace/leads?view=partner-pricing' },
    { key: 'commercial-review', label: 'Commercial Review', href: '/workspace/leads?view=commercial-review' },
    { key: 'client-quotes', label: 'Client Quotes', href: '/workspace/leads?view=client-quotes' },
  ],
  deliver: [
    { key: 'projects', label: 'Project 360', href: '/workspace/projects?view=delivery' },
  ],
  close: [
    { key: 'closeout', label: 'Closeout', href: '/workspace/projects?view=closeout' },
    { key: 'closed', label: 'Closed Projects', href: '/workspace/projects?view=closed' },
  ],
};

function stageForRegister(pathname: string, view: string | null): LifecycleStageKey | null {
  if (pathname.startsWith('/workspace/acquisition')) return 'acquire';
  if (pathname === '/workspace/leads') {
    if (['partner-pricing','commercial-review','client-quotes'].includes(String(view))) return 'commercial';
    return 'assess';
  }
  if (pathname === '/workspace/projects') {
    if (['closeout','closed'].includes(String(view))) return 'close';
    return 'deliver';
  }
  return null;
}

function recordContext(pathname: string) {
  const caseMatch = pathname.match(/^\/workspace\/leads\/([^/]+)/);
  if (caseMatch) return { type: 'case' as const, id: caseMatch[1] };
  const projectMatch = pathname.match(/^\/workspace\/projects\/([^/]+)/);
  if (projectMatch) return { type: 'project' as const, id: projectMatch[1] };
  return null;
}

function isLinkActive(pathname: string, search: string, href: string) {
  const [targetPath, targetQuery] = href.split('?');
  if (pathname !== targetPath) return false;
  if (!targetQuery) return true;
  const target = new URLSearchParams(targetQuery);
  const current = new URLSearchParams(search);
  return Array.from(target.entries()).every(([key,value]) => current.get(key) === value);
}

export default function LifecycleSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const context = useMemo(() => recordContext(pathname), [pathname]);
  const registerStage = stageForRegister(pathname, searchParams.get('view'));
  const [recordStage, setRecordStage] = useState<LifecycleStageKey | null>(null);
  const activeStage = recordStage || registerStage;
  const [expandedStage, setExpandedStage] = useState<LifecycleStageKey>(activeStage || 'acquire');

  useEffect(() => {
    setRecordStage(null);
    if (!context) return;
    const controller = new AbortController();
    fetch(`/api/workspace/lifecycle-context?type=${context.type}&id=${encodeURIComponent(context.id)}`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        const stage = payload?.stage as LifecycleStageKey | undefined;
        if (stage && stageOrder.includes(stage)) setRecordStage(stage);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [context]);

  useEffect(() => {
    if (activeStage) setExpandedStage(activeStage);
  }, [activeStage]);

  const search = searchParams.toString();

  return <nav aria-label="Business lifecycle" className="lifecycle-nav">
    <div className="lifecycle-nav__overview">
      <p className="midts-nav-label">Overview</p>
      <Link className={pathname === '/workspace' ? 'active' : ''} href="/workspace">Dashboard</Link>
      <Link className={pathname === '/workspace/notifications' ? 'active' : ''} href="/workspace/notifications">Notifications</Link>
    </div>

    {context ? <section className="lifecycle-context">
      <div className="lifecycle-context__heading">
        <div><p className="midts-nav-label">{context.type === 'case' ? 'Case 360' : 'Project 360'}</p><strong>{context.id.slice(0,8).toUpperCase()}</strong></div>
        <span>{recordStage ? `${lifecycleStages[recordStage].label} stage` : 'Resolving stage'}</span>
      </div>
      <div className="lifecycle-context__links">
        <Link className={pathname === (context.type === 'case' ? `/workspace/leads/${context.id}` : `/workspace/projects/${context.id}`) ? 'active' : ''} href={context.type === 'case' ? `/workspace/leads/${context.id}` : `/workspace/projects/${context.id}`}>Overview</Link>
        <Link href={`/workspace/communications/${context.type === 'case' ? 'lead' : 'project'}/${context.id}`}>Communications</Link>
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
          const items = navigation[stageKey];
          return <section key={stageKey} className={`lifecycle-stage ${current ? 'is-current' : ''} ${completed ? 'is-complete' : ''} ${expanded ? 'is-expanded' : ''}`}>
            <div className="lifecycle-stage__marker"><span>{completed ? '✓' : stage.number}</span><i /></div>
            <div className="lifecycle-stage__body">
              <button type="button" className="lifecycle-stage__toggle" aria-expanded={expanded} aria-controls={`lifecycle-stage-${stageKey}`} onClick={() => setExpandedStage(stageKey)}>
                <span className="lifecycle-stage__copy">
                  <span className="lifecycle-stage__heading"><strong>{stage.label}</strong>{current ? <em>Current</em> : null}</span>
                  <small>{stagePurpose[stageKey]}</small>
                </span>
                <span className="lifecycle-stage__chevron" aria-hidden="true">{expanded ? '⌄' : '›'}</span>
              </button>
              {expanded ? <div className="lifecycle-stage__panel" id={`lifecycle-stage-${stageKey}`}>
                <div className="lifecycle-stage__links">{items.map(item => <Link className={isLinkActive(pathname,search,item.href) ? 'active' : ''} key={item.key} href={item.href}><span>{item.label}</span></Link>)}</div>
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
        <Link className={pathname === '/workspace/communications' ? 'active' : ''} href="/workspace/communications">Communications</Link>
        <Link className={pathname.startsWith('/workspace/notifications') ? 'active' : ''} href="/workspace/notifications">Notification Centre</Link>
        <Link className={pathname.startsWith('/workspace/partners') ? 'active' : ''} href="/workspace/partners">Partners</Link>
      </div>
    </details>

    <details className="lifecycle-utility">
      <summary><span>System</span><small>Workspace configuration</small><b aria-hidden="true">›</b></summary>
      <div><Link className={pathname.startsWith('/workspace/settings') ? 'active' : ''} href="/workspace/settings">Settings</Link></div>
    </details>
  </nav>;
}
