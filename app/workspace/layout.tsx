import './workspace-responsive.css';
import './mission-control.css';
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
  return <nav aria-label="Workspace" className="workspace-nav">
    <Link href="/workspace">Mission Control</Link>
    <Link href="/workspace/leads">Cases</Link>
    <Link href="/workspace/partners">Partners</Link>
    <Link href="/workspace/projects">Projects</Link>
    <Link href="/workspace/documents">Documents</Link>
    <Link href="/workspace/users">Settings</Link>
  </nav>;
}

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <div className="workspace">
    <aside className="sidebar workspace-desktop-nav">
      <Link href="/workspace" className="brand" aria-label="Overflow Partner Workspace home">Overflow<span>Partner</span></Link>
      <WorkspaceNavigation />
      <form action={signOut} className="workspace-signout"><button className="button secondary" type="submit">Sign out</button></form>
    </aside>

    <header className="workspace-mobile-header">
      <Link href="/workspace" className="brand" aria-label="Overflow Partner Workspace home">Overflow<span>Partner</span></Link>
      <details className="workspace-mobile-menu">
        <summary aria-label="Open workspace navigation"><span>Menu</span><span aria-hidden="true">☰</span></summary>
        <div className="workspace-mobile-menu-panel">
          <WorkspaceNavigation />
          <form action={signOut} className="workspace-signout"><button className="button secondary" type="submit">Sign out</button></form>
        </div>
      </details>
    </header>

    <main className="content workspace-content">{children}</main>
  </div>;
}
