import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="brand">Overflow<span>Partner</span></div>
        <nav aria-label="Workspace">
          <Link href="/workspace">Dashboard</Link>
          <Link href="/workspace/acquisition">Acquisition</Link>
          <Link href="/workspace/leads">Leads</Link>
          <Link href="/workspace/documents">Documents</Link>
        </nav>
        <form action={signOut} style={{ marginTop: 36 }}>
          <button className="button secondary" type="submit">Sign out</button>
        </form>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
