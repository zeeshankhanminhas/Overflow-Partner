import { createTechnicalIntakeFormAction } from '@/app/workspace/leads/[leadId]/actions';

const inputClass = 'field_input border border-black/15 bg-white px-3 py-2 text-black';
const labelClass = 'field_group grid gap-2 text-xs font-medium uppercase text-black';

export default function TechnicalIntakeForm({ leadId, projectType }: { leadId: string; projectType?: string | null }) {
  return (
    <form action={createTechnicalIntakeFormAction} className="card stack" style={{ width: '100%', marginTop: 24 }}>
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <p className="eyebrow">Technical intake</p>
        <h3>Define the engineering requirement</h3>
      </div>
      <label className={labelClass}>Project type<input className={inputClass} name="project_type" defaultValue={projectType ?? ''} /></label>
      <label className={labelClass}>Discipline<input className={inputClass} name="discipline" placeholder="Mechanical design, CAD drafting, CAM, documentation..." /></label>
      <label className={labelClass}>Requirement description<textarea className={inputClass} name="description" required rows={7} placeholder="Describe the part, assembly, drawing pack or engineering output required." /></label>
      <label className={labelClass}>Required deliverables<textarea className={inputClass} name="deliverables" rows={4} placeholder="STEP files, native CAD, manufacturing drawings, BOM, CAM setup..." /></label>
      <label className={labelClass}>Required-by date<input className={inputClass} name="deadline" type="date" /></label>
      <label className={labelClass}>Special requirements<textarea className={inputClass} name="special_requirements" rows={4} placeholder="Standards, tolerances, materials, software version, confidentiality or review requirements." /></label>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button className="button secondary" name="status" value="draft">Save draft</button>
        <button className="button" name="status" value="submitted">Submit for review</button>
      </div>
    </form>
  );
}
