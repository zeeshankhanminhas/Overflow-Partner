/* Workspace CSS loading policy
   1) semantic/core styles
   2) active feature styles
   3) canonical surface + product presentation
   4) visual foundation LAST — the physical rendering authority on desktop and mobile. */
import './workspace-responsive.css';
import './workspace-shell.css';
import './visual-constitution.css';
import './stage-documents.css';
import './mobile-document-review.css';
import './notification-centre.css';
import './lifecycle-sidebar.css';
import './document-print.css';
import './record-workspace.css';
import './continuity.css';
import './product-registers.css';
import './product-states.css';
import './phase3-document-actions.css';
import './workspace-interaction-system.css';

/* Canonical presentation layer. */
import './product-surfaces.css';
import './mobile-reference-rebuild.css';
import './mobile-header-actions.css';
import './workspace-presentation-system.css';
import './workspace-visual-foundation.css';
import './ui-foundation.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import OverflowPartnerBrand from '@/components/brand/OverflowPartnerBrand';
import { signOut } from '@/app/login/actions';
import { getWorkspaceChromeData } from '@/lib/workspace/request-data';
import { primaryNavigation } from '@/lib/presentation/navigationContract';
import LifecycleSidebar from './LifecycleSidebar';
import CommandPalette from '@/components/workspace/CommandPalette';
import WorkspaceContinuity from '@/components/workspace/WorkspaceContinuity';
import WorkspaceFlashBridge from '@/components/workspace/WorkspaceFlashBridge';
import MobileWorkspaceNav from '@/components/workspace/MobileWorkspaceNav';
import DeveloperDeleteCurrentRecord from '@/components/workspace/DeveloperDeleteCurrentRecord';
import { WorkspaceActivityTracker } from '@/components/workspace/WorkspaceOperatorCentre';
import {
  WorkspaceInteractionProvider,
  WorkspaceShellActions,
  type WorkspaceAlert,
} from '@/components/workspace/WorkspaceInteractionProvider';

export const metadata: Metadata = {
  title: 'Overflow Partner | Operations Workspace',
  description: 'Engineering delivery workspace for Overflow Partner.',
  robots: { index: false, follow: false },
};

export const runtime = 'nodejs';

function ageLabel(minutes: number) {
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { context: { profile }, approvals: approvalQueue, exceptions: exceptionQueue } = await getWorkspaceChromeData();
  const n=primaryNavigation;

  const approvalAlerts: WorkspaceAlert[] = approvalQueue
    .filter((item) => item.status === 'ready')
    .slice(0, 5)
    .map((item) => ({
      id: `approval-${item.id}`,
      kind: 'approval',
      title: item.title,
      detail: item.reason,
      href: item.href,
      meta: `${item.type} · ready for approval`,
      tone: 'ready',
    }));

  const exceptionAlerts: WorkspaceAlert[] = exceptionQueue.slice(0, 7).map((item) => ({
    id: `exception-${item.id}`,
    kind: 'exception',
    title: item.title,
    detail: item.detail,
    href: item.href,
    meta: `${item.relatedLabel} · ${item.owner} · ${ageLabel(item.ageMinutes)}`,
    tone: item.severity,
  }));

  const alerts = [...approvalAlerts, ...exceptionAlerts].slice(0, 10);
  const developerDeleteEnabled = Boolean(profile.developer_delete_enabled);

  return <WorkspaceInteractionProvider>
    <Suspense fallback={null}><WorkspaceFlashBridge /></Suspense>
    <Suspense fallback={null}><WorkspaceActivityTracker /></Suspense>
    <div className="workspace midts-shell op-shell">
      <Suspense fallback={null}><WorkspaceContinuity /></Suspense>
      <aside className="midts-sidebar op-sidebar">
        <Link href={n.missionControl.href} className="midts-brand op-brand" aria-label="Overflow Partner Mission Control"><OverflowPartnerBrand /></Link>
        <LifecycleSidebar />
        <div className="midts-sidebar-footer op-sidebar-footer">
          <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>
        </div>
      </aside>

      <section className="midts-main op-main">
        <header className="midts-topbar op-topbar">
          <div className="op-topbar-spacer" aria-hidden="true" />
          <div className="midts-topbar-tools op-topbar-tools"><Suspense fallback={null}><DeveloperDeleteCurrentRecord enabled={developerDeleteEnabled}/></Suspense><WorkspaceShellActions alerts={alerts}/><CommandPalette/></div>
        </header>
        <header className="midts-mobile-header op-mobile-header">
          <Link href={n.missionControl.href} className="op-mobile-header__brand" aria-label="Overflow Partner home">
            <OverflowPartnerBrand />
          </Link>
          <div className="op-mobile-header__actions"><Suspense fallback={null}><DeveloperDeleteCurrentRecord enabled={developerDeleteEnabled}/></Suspense><WorkspaceShellActions alerts={alerts}/><CommandPalette/></div>
        </header>
        <main className="midts-content op-content">{children}</main>
      </section>

      <MobileWorkspaceNav
        home={n.missionControl.href}
        opportunities={n.enquiries.href}
        projects={n.projects.href}
        approvals={n.approvals.href}
        documents={n.documents.href}
      />
    </div>
  </WorkspaceInteractionProvider>;
}
