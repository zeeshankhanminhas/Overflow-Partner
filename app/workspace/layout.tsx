import './workspace-responsive.css';
import './mission-control.css';
import './workspace-midts-reset.css';
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
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import LifecycleSidebar from './LifecycleSidebar';
import CommandPalette from '@/components/workspace/CommandPalette';
import WorkspaceContinuity from '@/components/workspace/WorkspaceContinuity';

export const metadata: Metadata = {
  title: 'Workspace | Overflow Partner',
  description: 'Engineering operations workspace for Overflow Partner.',
  robots: { index: false, follow: false },
};

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <div className="workspace midts-shell">
    <Suspense fallback={null}><WorkspaceContinuity /></Suspense>
    <aside className="midts-sidebar">
      <Link href="/workspace" className="midts-brand" aria-label="Overflow Partner Workspace home"><span className="midts-brand-dot" />Overflow Partner</Link>
      <LifecycleSidebar />
      <div className="midts-sidebar-footer">
        <p>Workspace</p>
        <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>
      </div>
    </aside>

    <section className="midts-main">
      <header className="midts-topbar">
        <div><p>Workspace</p><strong>Engineering operations</strong></div>
        <div className="midts-topbar-tools"><CommandPalette/><Link href="/workspace/notifications">Notifications</Link></div>
      </header>
      <header className="midts-mobile-header"><div><span>Workspace</span><strong>Overflow Partner</strong></div><div style={{display:'flex',gap:8,alignItems:'center'}}><CommandPalette/><form action={signOut}><button className="button secondary" type="submit">Sign out</button></form></div></header>
      <main className="midts-content">{children}</main>
    </section>

    <nav className="midts-mobile-nav" aria-label="Mobile workspace navigation">
      <Link href="/workspace">Home</Link>
      <Link href="/workspace/acquisition/prospects">Acquire</Link>
      <Link href="/workspace/leads">Cases</Link>
      <Link href="/workspace/projects">Projects</Link>
      <Link href="/workspace/payments">Finance</Link>
    </nav>
  </div>;
}
