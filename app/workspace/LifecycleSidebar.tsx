'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { lifecycleStages, type LifecycleStageKey } from '@/lib/lifecycle/config';

const stageOrder: LifecycleStageKey[] = ['acquire','assess','commercial','deliver','close'];

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

export default function LifecycleSidebar() {
  const pathname = usePathname();
  const activeStage = activeStageForPath(pathname);
  const context = recordContext(pathname);

  return <nav aria-label="Business lifecycle" className="lifecycle-nav">
    <div className="lifecycle-nav__overview">
      <p className="midts-nav-label">Overview</p>
      <Link className={pathname === '/workspace' ? 'active' : ''} href="/workspace">Dashboard</Link>
      <Link className={pathname === '/workspace/notifications' ? 'active' : ''} href="/workspace/notifications">Notifications</Link>
    </div>

    {context ? <section className="lifecycle-context">
      <p className="midts-nav-label">{context.type === 'case' ? 'Case 360' : 'Project 360'}</p>
      <strong>{context.id.slice(0,8).toUpperCase()}</strong>
      <div>
        <Link href={context.type === 'case' ? `/workspace/leads/${context.id}` : `/workspace/projects/${context.id}`}>Overview</Link>
        <Link href={`/workspace/communications/${context.type === 'case' ? 'lead' : 'project'}/${context.id}`}>Communications</Link>
        <Link href={context.type === 'case' ? `/workspace/documents?lead=${context.id}` : `/workspace/documents?project=${context.id}`}>Documents</Link>
      </div>
    </section> : null}

    <div className="lifecycle-nav__stages">
      <p className="midts-nav-label">Business lifecycle</p>
      {stageOrder.map((stageKey, index) => {
        const stage = lifecycleStages[stageKey];
        const current = activeStage === stageKey;
        const completed = activeStage ? stageOrder.indexOf(activeStage) > index : false;
        return <section key={stageKey} className={`lifecycle-stage ${current ? 'is-current' : ''} ${completed ? 'is-complete' : ''}`}>
          <div className="lifecycle-stage__marker"><span>{completed ? '✓' : stage.number}</span><i /></div>
          <div className="lifecycle-stage__body">
            <div className="lifecycle-stage__heading"><strong>{stage.label}</strong>{current ? <em>Current</em> : null}</div>
            <small>{stage.description}</small>
            {(current || !activeStage) ? <div className="lifecycle-stage__links">{stage.substages.map(item => <Link key={item.key} href={item.href}>{item.label}</Link>)}</div> : null}
          </div>
        </section>;
      })}
    </div>

    <div className="lifecycle-nav__control">
      <p className="midts-nav-label">Control</p>
      <Link href="/workspace/documents">Documents registry</Link>
      <Link href="/workspace/notifications">Communications</Link>
      <Link href="/workspace/partners">Partners</Link>
      <Link href="/workspace/settings">Settings</Link>
    </div>
  </nav>;
}
