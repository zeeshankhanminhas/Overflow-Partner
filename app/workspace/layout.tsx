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
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import LifecycleSidebar from './LifecycleSidebar';

export const metadata: Metadata = {
  title: 'Workspace | Overflow Partner',
  description: 'Private engineering operations workspace for Overflow Partner.',
  robots: { index: false, follow: false },
};

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <div className="workspace midts-shell">
    <aside className="midts-sidebar">
      <Link href="/workspace" className="midts-brand" aria-label="Overflow Partner Workspace home"><span className="midts-brand-dot" />Overflow Partner</Link>
      <LifecycleSidebar />
      <div className="midts-sidebar-footer">
        <p>Authenticated workspace</p>
        <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>
      </div>
    </aside>

    <section className="midts-main">
      <header className="midts-topbar">
        <div><p>Private workspace</p><strong>Engineering operations</strong></div>
        <div className="midts-topbar-tools"><span>Search workspace</span><Link href="/workspace/notifications">Notifications</Link></div>
      </header>
      <header className="midts-mobile-header"><div><span>Private workspace</span><strong>Overflow Partner</strong></div><form action={signOut}><button className="button secondary" type="submit">Sign out</button></form></header>
      <main className="midts-content">{children}</main>
    </section>

    <nav className="midts-mobile-nav" aria-label="Mobile workspace navigation">
      <Link href="/workspace">Home</Link>
      <Link href="/workspace/acquisition">Acquire</Link>
      <Link href="/workspace/leads">Assess</Link>
      <Link href="/workspace/projects">Deliver</Link>
      <Link href="/workspace/documents">Docs</Link>
    </nav>
  </div>;
}
