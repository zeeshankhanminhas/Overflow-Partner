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
import './document-print.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';

export const metadata: Metadata = {
  title: 'Workspace | Overflow Partner',
  description: 'Private engineering operations workspace for Overflow Partner.',
  robots: { index: false, follow: false },
};

function WorkspaceNavigation() {
  return <nav aria-label="Workspace" className="midts-nav">
    <div className="midts-nav-group">
      <p className="midts-nav-label">Command</p>
      <Link href="/workspace">Dashboard</Link>
      <Link href="/workspace/notifications">Notifications</Link>
    </div>
    <div className="midts-nav-group">
      <p className="midts-nav-label">Operate</p>
      <Link href="/workspace/leads">Cases</Link>
      <Link href="/workspace/partners">Partners</Link>
      <Link href="/workspace/projects">Projects</Link>
      <Link href="/workspace/documents">Documents</Link>
    </div>
    <div className="midts-nav-group">
      <p className="midts-nav-label">System</p>
      <Link href="/workspace/settings">Settings</Link>
    </div>
  </nav>;
}

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <div className="workspace midts-shell">
    <aside className="midts-sidebar">
      <Link href="/workspace" className="midts-brand" aria-label="Overflow Partner Workspace home"><span className="midts-brand-dot" />Overflow Partner</Link>
      <WorkspaceNavigation />
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
      <Link href="/workspace/leads">Cases</Link>
      <Link href="/workspace/notifications">Alerts</Link>
      <Link href="/workspace/projects">Projects</Link>
      <Link href="/workspace/documents">Docs</Link>
    </nav>
  </div>;
}
