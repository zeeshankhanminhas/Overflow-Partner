import { createClient } from "@/lib/supabase/server";

export default async function WorkspacePage() {
  const supabase = await createClient();
  const [{ count: prospectCount }, { count: leadCount }, { count: documentCount }] = await Promise.all([
    supabase.from("prospects").select("id", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }),
  ]);

  return (
    <section>
      <p className="eyebrow">Operations workspace</p>
      <h2>Engineering overflow control</h2>
      <p className="lede">Acquisition sits above lead intake. LinkedIn and other prospecting channels qualify opportunities before they enter the engineering workflow.</p>
      <div className="metric-grid">
        <article className="metric"><span>Acquisition prospects</span><strong>{prospectCount ?? 0}</strong></article>
        <article className="metric"><span>Active leads</span><strong>{leadCount ?? 0}</strong></article>
        <article className="metric"><span>Documents</span><strong>{documentCount ?? 0}</strong></article>
      </div>
    </section>
  );
}
