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
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import LifecycleSidebar from './LifecycleSidebar';
import CommandPalette from '@/components/workspace/CommandPalette';
import WorkspaceContinuity from '@/components/workspace/WorkspaceContinuity';
import MobileWorkspaceGuard from '@/components/workspace/MobileWorkspaceGuard';

export const metadata: Metadata = {
  title: 'Overflow Partner | Engineering Operations',
  description: 'Commercial engineering operations workspace for Overflow Partner.',
  robots: { index: false, follow: false },
};

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <div className="workspace op-shell">
    <Suspense fallback={null}><WorkspaceContinuity /></Suspense>
    <MobileWorkspaceGuard />
    <aside className="op-sidebar">
      <Link href="/workspace" className="op-brand" aria-label="Overflow Partner Mission Control"><span className="op-brand-mark" />Overflow Partner</Link>
      <LifecycleSidebar />
      <div className="op-sidebar-footer">
        <p>Engineering operations</p>
        <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>
      </div>
    </aside>

    <section className="op-main">
      <header className="op-topbar">
        <div><p>Overflow Partner</p><strong>Engineering operations</strong></div>
        <div className="op-topbar-tools"><CommandPalette/><Link href="/workspace/notifications">Attention Centre</Link></div>
      </header>
      <header className="op-mobile-header"><div><span>Engineering operations</span><strong>Overflow Partner</strong></div><div style={{display:'flex',gap:8,alignItems:'center'}}><CommandPalette/><form action={signOut}><button className="button secondary" type="submit">Sign out</button></form></div></header>
      <main className="op-content">{children}</main>
    </section>

    <nav className="op-mobile-nav" aria-label="Mobile workspace navigation">
      <Link href="/workspace">Home</Link>
      <Link href="/workspace/acquisition/prospects">Acquire</Link>
      <Link href="/workspace/leads">Cases</Link>
      <Link href="/workspace/projects">Projects</Link>
      <Link href="/workspace/payments">Finance</Link>
    </nav>
  </div>;
}
