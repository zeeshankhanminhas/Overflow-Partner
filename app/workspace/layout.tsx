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

const groupStyle = { display: 'grid', gap: 8, padding: '10px 0 0 12px' } as const;

function WorkspaceNavigation() {
  return <nav aria-label="Workspace" className="workspace-nav">
    <Link href="/workspace">Mission Control</Link>
    <details open><summary>My Work</summary><div style={groupStyle}><Link href="/workspace/tasks">My Actions</Link><Link href="/workspace/activity">Activity Timeline</Link></div></details>
    <details open><summary>Case Pipeline</summary><div style={groupStyle}>
      <Link href="/workspace/acquisition">Prospects</Link><Link href="/workspace/leads">Leads &amp; Cases</Link>
      <Link href="/workspace/orchestration">Pipeline Orchestration</Link><Link href="/workspace/partner-quotes">Partner Pricing</Link>
      <Link href="/workspace/commercial-reviews">Commercial Review</Link><Link href="/workspace/quotes">Client Quotes</Link><Link href="/workspace/projects">Projects</Link>
    </div></details>
    <details><summary>Customer Records</summary><div style={groupStyle}><Link href="/workspace/companies">Companies</Link><Link href="/workspace/contacts">Contacts</Link></div></details>
    <details open><summary>Resources</summary><div style={groupStyle}><Link href="/workspace/partners">Execution Partners</Link><Link href="/workspace/documents">Documents</Link></div></details>
    <details><summary>Administration</summary><div style={groupStyle}><Link href="/workspace/users">Users</Link><Link href="/workspace/opds">OPDS</Link></div></details>
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
