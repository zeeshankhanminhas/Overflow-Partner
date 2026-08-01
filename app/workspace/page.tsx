import { createClient } from "@/lib/supabase/server";

export default async function WorkspacePage() {
  const supabase = await createClient();
  const { count: leadCount } = await supabase.from("leads").select("id", { count: "exact", head: true });
  const { count: documentCount } = await supabase.from("documents").select("id", { count: "exact", head: true });

  return (
    <section>
      <p className="eyebrow">Operations workspace</p>
      <h2>Engineering overflow control</h2>
      <p className="lede">The MIDTS workflow will be migrated into this Supabase-backed workspace module by module.</p>
      <div className="metric-grid">
        <article className="metric"><span>Active leads</span><strong>{leadCount ?? 0}</strong></article>
        <article className="metric"><span>Documents</span><strong>{documentCount ?? 0}</strong></article>
        <article className="metric"><span>Migration stage</span><strong>01</strong></article>
      </div>
    </section>
  );
}
