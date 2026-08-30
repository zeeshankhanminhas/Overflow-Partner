import './workspace-responsive.css';
import './workspace-shell.css';
import './visual-constitution.css';
import './ui-polish.css';
import './workspace-unified-polish.css';
import './stage-documents.css';
import './mobile-document-review.css';
import './acquisition-layout.css';
import './notification-centre.css';
import './lifecycle-sidebar.css';
import './document-print.css';
import './sprint-zero.css';
import './record-workspace.css';
import './continuity.css';
import './phase-1c-consistency.css';
import './phase-1f-mobile-polish.css';
import './commercial-saas-ui.css';
import './product-registers.css';
import './product-states.css';
import './product-mobile-overrides.css';
import './workspace-mobile-canonical.css';
import './phase3-document-actions.css';
import './ux-ui-parity.css';
import './ux-ui-parity-mobile.css';
import './global-presentation.css';
import './interaction-surfaces.css';
import './workspace-interaction-system.css';
import './workspace-wave3.css';
import './workspace-wave4.css';
import './workspace-wave5.css';
import './workspace-wave6.css';
import './workspace-wave7.css';
import './workspace-wave8.css';
import './reference-surface.css';
import './reference-behaviour-refactor.css';
import './mission-control-v2.css';
import './mobile-ux-cleanup-wave.css';
import './attention-priority.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { signOut } from '@/app/login/actions';
import { requireUserContext } from '@/lib/auth/context';
import { getApprovalQueue } from '@/lib/presentation/approvals';
import { getOperationalExceptions } from '@/lib/operations/exceptions';
import { primaryNavigation } from '@/lib/presentation/navigationContract';
import LifecycleSidebar from './LifecycleSidebar';
import CommandPalette from '@/components/workspace/CommandPalette';
import WorkspaceContinuity from '@/components/workspace/WorkspaceContinuity';
import WorkspaceFlashBridge from '@/components/workspace/WorkspaceFlashBridge';
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

function ageLabel(minutes: number) {
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { supabase, organisationId } = await requireUserContext();
  const n=primaryNavigation;

  const [approvalQueue, exceptionQueue] = await Promise.all([
    getApprovalQueue(supabase, organisationId),
    getOperationalExceptions(supabase, organisationId),
  ]);

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

  return <WorkspaceInteractionProvider>
    <Suspense fallback={null}><WorkspaceFlashBridge /></Suspense>
    <Suspense fallback={null}><WorkspaceActivityTracker /></Suspense>
    <div className="workspace midts-shell op-shell">
      <Suspense fallback={null}><WorkspaceContinuity /></Suspense>
      <aside className="midts-sidebar op-sidebar">
        <Link href={n.missionControl.href} className="midts-brand op-brand" aria-label="Overflow Partner Mission Control"><span className="midts-brand-dot op-brand-mark" />Overflow Partner</Link>
        <LifecycleSidebar />
        <div className="midts-sidebar-footer op-sidebar-footer">
          <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>
        </div>
      </aside>

      <section className="midts-main op-main">
        <header className="midts-topbar op-topbar">
          <div className="op-topbar-spacer" aria-hidden="true" />
          <div className="midts-topbar-tools op-topbar-tools"><WorkspaceShellActions alerts={alerts}/><CommandPalette/></div>
        </header>
        <header className="midts-mobile-header op-mobile-header"><div><strong>Overflow Partner</strong></div><div style={{display:'flex',gap:8,alignItems:'center'}}><WorkspaceShellActions alerts={alerts}/><CommandPalette/></div></header>
        <main className="midts-content op-content">{children}</main>
      </section>

      <nav className="midts-mobile-nav op-mobile-nav" aria-label="Mobile workspace navigation">
        <Link href={n.missionControl.href}>Home</Link>
        <Link href={n.enquiries.href}>Opportunities</Link>
        <Link href={n.projects.href}>Projects</Link>
        <Link href={n.approvals.href}>Approvals</Link>
        <Link href={n.documents.href}>Documents</Link>
      </nav>
    </div>
  </WorkspaceInteractionProvider>;
}