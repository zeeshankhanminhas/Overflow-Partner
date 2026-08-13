import './workspace-responsive.css';
import './mission-control.css';
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
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import { primaryNavigation } from '@/lib/presentation/navigationContract';
import LifecycleSidebar from './LifecycleSidebar';
import CommandPalette from '@/components/workspace/CommandPalette';
import WorkspaceContinuity from '@/components/workspace/WorkspaceContinuity';

export const metadata: Metadata = {
  title: 'Overflow Partner | Operations Workspace',
  description: 'Governed engineering delivery workspace for Overflow Partner.',
  robots: { index: false, follow: false },
};

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const n=primaryNavigation;

  return <div className="workspace midts-shell op-shell">
    <Suspense fallback={null}><WorkspaceContinuity /></Suspense>
    <aside className="midts-sidebar op-sidebar">
      <Link href={n.missionControl.href} className="midts-brand op-brand" aria-label="Overflow Partner Mission Control"><span className="midts-brand-dot op-brand-mark" />Overflow Partner</Link>
      <LifecycleSidebar />
      <div className="midts-sidebar-footer op-sidebar-footer">
        <p>Governed delivery</p>
        <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>
      </div>
    </aside>

    <section className="midts-main op-main">
      <header className="midts-topbar op-topbar">
        <div><p>Overflow Partner</p><strong>Operations workspace</strong></div>
        <div className="midts-topbar-tools op-topbar-tools"><CommandPalette/><Link href={n.notifications.href}>{n.notifications.label}</Link></div>
      </header>
      <header className="midts-mobile-header op-mobile-header"><div><span>Operations workspace</span><strong>Overflow Partner</strong></div><div style={{display:'flex',gap:8,alignItems:'center'}}><CommandPalette/><form action={signOut}><button className="button secondary" type="submit">Sign out</button></form></div></header>
      <main className="midts-content op-content">{children}</main>
    </section>

    <nav className="midts-mobile-nav op-mobile-nav" aria-label="Mobile workspace navigation">
      <Link href={n.missionControl.href}>Home</Link>
      <Link href={n.enquiries.href}>{n.enquiries.label}</Link>
      <Link href={n.cases.href}>{n.cases.label}</Link>
      <Link href={n.projects.href}>{n.projects.label}</Link>
      <Link href={n.payments.href}>Finance</Link>
    </nav>
  </div>;
}