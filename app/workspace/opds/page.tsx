import { OpdsBadge, OpdsPanel, OpdsReference, WorkflowStatus } from '@/components/opds';
import { opds } from '@/lib/opds/tokens';

export default function OpdsPage() {
  const swatches = [
    ['Ink', opds.colour.ink], ['Paper', opds.colour.paper], ['Technical', opds.colour.technical],
    ['Extension', opds.colour.extension], ['Success', opds.colour.success], ['Warning', opds.colour.warning],
  ];

  return <section>
    <p className="opds-eyebrow">Overflow Partner Engineering Design System</p>
    <h1>OPDS</h1>
    <p className="lede">The governed visual and document language for the website, Workspace, engineering records and client-facing output.</p>

    <div className="opds-specimen-grid">
      <OpdsPanel eyebrow="Identity" title="Capacity extension mark">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}><span className="opds-mark" aria-hidden="true"><i /><b /></span><div><strong style={{ fontSize: 24 }}>Overflow Partner</strong><p style={{ marginBottom: 0 }}>Black structure. Red capacity extension. Never decorative.</p></div></div>
      </OpdsPanel>
      <OpdsPanel eyebrow="References" title="Controlled identifiers">
        <div style={{ display: 'grid', gap: 12 }}><OpdsReference>OP-LEAD-2026-0001</OpdsReference><OpdsReference>OP-Q-2026-0001-R00</OpdsReference><OpdsReference>OP-PRJ-2026-0001</OpdsReference><OpdsReference>OP-DOC-2026-0001</OpdsReference></div>
      </OpdsPanel>
    </div>

    <OpdsPanel eyebrow="Colour" title="Core palette">
      <div className="opds-specimen-grid">{swatches.map(([name, value]) => <div className="opds-swatch" key={name} style={{ background: value, color: name === 'Ink' ? 'white' : undefined }}><strong>{name}</strong><code>{value}</code></div>)}</div>
    </OpdsPanel>

    <div className="opds-specimen-grid">
      <OpdsPanel eyebrow="Status" title="Workflow language"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}><WorkflowStatus status="draft"/><WorkflowStatus status="under_review"/><WorkflowStatus status="approved"/><WorkflowStatus status="accepted"/><WorkflowStatus status="rejected"/></div></OpdsPanel>
      <OpdsPanel eyebrow="Communication" title="Tone"><p><strong>Use:</strong> “Engineering capacity when your internal team reaches its limit.”</p><p><strong>Avoid:</strong> vague claims such as “innovative world-class solutions”.</p></OpdsPanel>
    </div>

    <OpdsPanel eyebrow="Rules" title="Non-negotiables">
      <div style={{ display: 'grid', gap: 10 }}><p>One red accent only: the capacity extension.</p><p>No gradients, glass effects, decorative shadows or people-led stock imagery.</p><p>References, revisions, dates and approvals use controlled engineering language.</p><p>Every value is inherited, calculated or generated unless human judgement is required.</p></div>
    </OpdsPanel>
  </section>;
}
