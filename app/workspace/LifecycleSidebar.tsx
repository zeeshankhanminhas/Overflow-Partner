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

function recordContext(pathname: string, searchParams: URLSearchParams) {
  const caseMatch = pathname.match(/^\/workspace\/leads\/([^/]+)/);
  if (caseMatch) return { type: 'case' as const, id: caseMatch[1] };
  const projectMatch = pathname.match(/^\/workspace\/projects\/([^/]+)/);
  if (projectMatch) return { type: 'project' as const, id: projectMatch[1] };
  const commsMatch = pathname.match(/^\/workspace\/communications\/(lead|project)\/([^/]+)/);
  if (commsMatch) return { type: commsMatch[1] === 'lead' ? 'case' as const : 'project' as const, id: commsMatch[2] };
  if (pathname === '/workspace/documents') {
    const project = searchParams.get('project');
    if (project) return { type: 'project' as const, id: project };
    const lead = searchParams.get('lead');
    if (lead) return { type: 'case' as const, id: lead };
  }
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
  const context = useMemo(() => recordContext(pathname, searchParams), [pathname, searchParams]);

  const viewingStage = context ? null : stageForRegister(pathname, searchParams.get('view'));
  const [recordStage, setRecordStage] = useState<LifecycleStageKey | null>(null);
  const [expandedStage, setExpandedStage] = useState<LifecycleStageKey>(viewingStage || 'acquire');

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
    if (context && recordStage) setExpandedStage(recordStage);
    else if (!context && viewingStage) setExpandedStage(viewingStage);
  }, [context, recordStage, viewingStage]);

  const search = searchParams.toString();
  const overviewHref=context?.type==='case'?`/workspace/leads/${context.id}`:context?.type==='project'?`/workspace/projects/${context.id}`:'';
  const communicationsHref=context?`/workspace/communications/${context.type==='case'?'lead':'project'}/${context.id}`:'';
  const evidenceHref=context?(context.type==='case'?`/workspace/documents?lead=${context.id}`:`/workspace/documents?project=${context.id}`):'';
  const lifecycleActive = Boolean(context || viewingStage);

  return <nav aria-label="Business lifecycle" className="lifecycle-nav">
    <div className="lifecycle-nav__overview">
      <p className="midts-nav-label">Overview</p>
      <Link className={pathname === '/workspace' ? 'active' : ''} href="/workspace">Dashboard</Link>
      <Link className={pathname === '/workspace/notifications' ? 'active' : ''} href="/workspace/notifications">Notifications</Link>
    </div>

    {context ? <section className="lifecycle-context">
      <div className="lifecycle-context__heading">
        <div><p className="midts-nav-label">{context.type === 'case' ? 'Case 360' : 'Project 360'}</p><strong>{context.id.slice(0,8).toUpperCase()}</strong></div>
        <span>{recordStage ? `${lifecycleStages[recordStage].label} · Current stage` : 'Resolving governed stage'}</span>
      </div>
      <div className="lifecycle-context__links">
        <Link className={pathname===overviewHref?'active':''} href={overviewHref}>Overview</Link>
        <Link className={pathname===communicationsHref?'active':''} href={communicationsHref}>Communications</Link>
        <Link className={isLinkActive(pathname,search,evidenceHref)?'active':''} href={evidenceHref}>Evidence</Link>
        {context.type==='project'?<Link className={pathname.startsWith('/workspace/commercial-control')&&searchParams.get('project')===context.id?'active':''} href={`/workspace/commercial-control?project=${context.id}`}>Commercial Control</Link>:null}
      </div>
    </section> : null}

    <details className="lifecycle-utility lifecycle-business" open={lifecycleActive}>
      <summary><span>Business lifecycle</span><small>Acquire → Assess → Commercial → Deliver → Close</small><b aria-hidden="true">›</b></summary>
      <div className="lifecycle-utility__lifecycle">
        <div className="lifecycle-rail">
          {stageOrder.map((stageKey, index) => {
            const stage = lifecycleStages[stageKey];
            const current = Boolean(context && recordStage === stageKey);
            const completed = Boolean(context && recordStage && stageOrder.indexOf(recordStage) > index);
            const viewing = Boolean(!context && viewingStage === stageKey);
            const expanded = expandedStage === stageKey;
            const items = navigation[stageKey];

            return <section key={stageKey} className={`lifecycle-stage ${current ? 'is-current' : ''} ${completed ? 'is-complete' : ''} ${viewing ? 'is-viewing' : ''} ${expanded ? 'is-expanded' : ''}`}>
              <div className="lifecycle-stage__marker"><span>{completed ? '✓' : stage.number}</span><i /></div>
              <div className="lifecycle-stage__body">
                <button type="button" className="lifecycle-stage__toggle" aria-expanded={expanded} aria-controls={`lifecycle-stage-${stageKey}`} onClick={() => setExpandedStage(stageKey)}>
                  <span className="lifecycle-stage__copy"><span className="lifecycle-stage__heading"><strong>{stage.label}</strong>{current ? <em>Current stage</em> : viewing ? <em>Viewing</em> : null}</span><small>{stagePurpose[stageKey]}</small></span>
                  <span className="lifecycle-stage__chevron" aria-hidden="true">{expanded ? '⌄' : '›'}</span>
                </button>
                {expanded ? <div className="lifecycle-stage__panel" id={`lifecycle-stage-${stageKey}`}><div className="lifecycle-stage__links">{items.map(item => <Link className={isLinkActive(pathname,search,item.href) ? 'active' : ''} key={item.key} href={item.href}><span>{item.label}</span></Link>)}</div></div> : null}
              </div>
            </section>;
          })}
        </div>
      </div>
    </details>

    <details className="lifecycle-utility" open={pathname.startsWith('/workspace/commercial-control')||pathname.startsWith('/workspace/intelligence')||pathname.startsWith('/workspace/risk')}>
      <summary><span>Business control</span><small>Cash, intelligence & risk</small><b aria-hidden="true">›</b></summary>
      <div>
        <Link className={pathname.startsWith('/workspace/commercial-control') ? 'active' : ''} href="/workspace/commercial-control">Commercial Control</Link>
        <Link className={pathname.startsWith('/workspace/intelligence') ? 'active' : ''} href="/workspace/intelligence">Executive Intelligence</Link>
        <Link className={pathname.startsWith('/workspace/risk') ? 'active' : ''} href="/workspace/risk">Risk & Compliance</Link>
      </div>
    </details>

    <details className="lifecycle-utility" open={pathname.startsWith('/workspace/search')||pathname.startsWith('/workspace/knowledge')}>
      <summary><span>Knowledge</span><small>Search & operating memory</small><b aria-hidden="true">›</b></summary>
      <div><Link className={pathname.startsWith('/workspace/search') ? 'active' : ''} href="/workspace/search">Enterprise Search</Link><Link className={pathname.startsWith('/workspace/knowledge') ? 'active' : ''} href="/workspace/knowledge">Knowledge Library</Link></div>
    </details>

    <details className="lifecycle-utility">
      <summary><span>Control</span><small>Evidence & operations</small><b aria-hidden="true">›</b></summary>
      <div><Link className={pathname.startsWith('/workspace/documents') ? 'active' : ''} href="/workspace/documents">Evidence registry</Link><Link className={pathname === '/workspace/communications' ? 'active' : ''} href="/workspace/communications">Communications</Link><Link className={pathname.startsWith('/workspace/notifications') ? 'active' : ''} href="/workspace/notifications">Notification Centre</Link><Link className={pathname.startsWith('/workspace/partners') ? 'active' : ''} href="/workspace/partners">Partners</Link></div>
    </details>

    <details className="lifecycle-utility">
      <summary><span>System</span><small>Workspace configuration</small><b aria-hidden="true">›</b></summary>
      <div><Link className={pathname.startsWith('/workspace/settings') ? 'active' : ''} href="/workspace/settings">Settings</Link></div>
    </details>
  </nav>;
}
