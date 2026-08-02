import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';

const plannedStyle = { opacity: 0.45, cursor: 'not-allowed' } as const;

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link href="/workspace" className="brand" aria-label="Overflow Partner Workspace home">Overflow<span>Partner</span></Link>
        <nav aria-label="Workspace" style={{ display: 'grid', gap: 18, marginTop: 30 }}>
          <Link href="/workspace">Dashboard</Link>
          <details open><summary>Acquisition</summary><div style={{ display: 'grid', gap: 8, padding: '10px 0 0 12px' }}><Link href="/workspace/acquisition">Prospects</Link></div></details>
          <details open><summary>CRM</summary><div style={{ display: 'grid', gap: 8, padding: '10px 0 0 12px' }}><Link href="/workspace/companies">Companies</Link><Link href="/workspace/contacts">Contacts</Link><Link href="/workspace/leads">Leads</Link></div></details>
          <details open><summary>Engineering</summary><div style={{ display: 'grid', gap: 8, padding: '10px 0 0 12px' }}><span style={plannedStyle}>Technical Intake · via Leads</span><span style={plannedStyle}>Partner RFQs · planned</span><span style={plannedStyle}>Partner Quotes · planned</span></div></details>
          <details open><summary>Commercial</summary><div style={{ display: 'grid', gap: 8, padding: '10px 0 0 12px' }}><span style={plannedStyle}>Commercial Review · planned</span><span style={plannedStyle}>Client Quotes · planned</span></div></details>
          <details open><summary>Delivery</summary><div style={{ display: 'grid', gap: 8, padding: '10px 0 0 12px' }}><span style={plannedStyle}>Projects · planned</span><Link href="/workspace/documents">Documents</Link></div></details>
          <details><summary>Administration</summary><div style={{ display: 'grid', gap: 8, padding: '10px 0 0 12px' }}><span style={plannedStyle}>Tasks · planned</span><span style={plannedStyle}>Activity · dashboard</span><span style={plannedStyle}>Users · planned</span></div></details>
        </nav>
        <form action={signOut} style={{ marginTop: 36 }}><button className="button secondary" type="submit">Sign out</button></form>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
