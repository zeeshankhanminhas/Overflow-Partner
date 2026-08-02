import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const stages = [
  { key: "identified", label: "Identified" },
  { key: "contacted", label: "Contacted" },
  { key: "conversation", label: "Conversation" },
  { key: "qualified", label: "Qualified" },
  { key: "converted", label: "Converted" },
] as const;

export default async function AcquisitionPage() {
  const supabase = await createClient();
  const { data: prospects = [] } = await supabase
    .from("prospects")
    .select("id, company_name, contact_name, job_title, source, status, next_action, next_action_at")
    .order("created_at", { ascending: false });

  const counts = Object.fromEntries(
    stages.map((stage) => [stage.key, prospects.filter((prospect) => prospect.status === stage.key).length]),
  );

  const linkedInProspects = prospects.filter((prospect) => prospect.source === "linkedin");

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
        <div>
          <p className="eyebrow">Acquisition</p>
          <h1>Prospects before lead intake</h1>
          <p className="lede">
            Track LinkedIn and other business-development conversations here. Convert only qualified opportunities into the existing lead workflow.
          </p>
        </div>
        <Link className="button" href="/workspace/leads">View leads</Link>
      </div>

      <div className="metric-grid">
        <article className="metric"><span>LinkedIn prospects</span><strong>{linkedInProspects.length}</strong></article>
        <article className="metric"><span>Active conversations</span><strong>{counts.conversation ?? 0}</strong></article>
        <article className="metric"><span>Ready to convert</span><strong>{counts.qualified ?? 0}</strong></article>
      </div>

      <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
        {stages.map((stage) => (
          <article className="metric" key={stage.key}>
            <span>{stage.label}</span>
            <strong>{counts[stage.key] ?? 0}</strong>
          </article>
        ))}
      </div>

      <div style={{ marginTop: 36 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center" }}>
          <div>
            <p className="eyebrow">LinkedIn funnel</p>
            <h2>Current conversations</h2>
          </div>
          <button className="button secondary" type="button" disabled>Add prospect</button>
        </div>

        {linkedInProspects.length === 0 ? (
          <div className="card" style={{ marginTop: 18, width: "100%" }}>
            <h3>No LinkedIn prospects yet</h3>
            <p className="lede" style={{ fontSize: 16 }}>
              The acquisition schema is ready. Prospect creation and lead conversion actions will be wired in the next implementation slice.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {linkedInProspects.map((prospect) => (
              <article className="metric" key={prospect.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <strong style={{ fontSize: 22, marginTop: 0 }}>{prospect.company_name}</strong>
                    <p>{[prospect.contact_name, prospect.job_title].filter(Boolean).join(" · ") || "Contact not added"}</p>
                  </div>
                  <span>{String(prospect.status).replaceAll("_", " ")}</span>
                </div>
                {prospect.next_action ? <p>Next: {prospect.next_action}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
