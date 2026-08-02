'use client';

import { useActionState } from 'react';
import { createTechnicalIntakeAction } from '@/app/workspace/leads/[leadId]/actions';
import type { ActionResult, TechnicalIntake } from '@/types/domain';

const initialState: ActionResult<TechnicalIntake> = { ok: false, error: '' };

export default function TechnicalIntakeForm({ leadId, projectType }: { leadId: string; projectType?: string | null }) {
  const [state, action, pending] = useActionState(createTechnicalIntakeAction, initialState);

  return (
    <form action={action} className="card stack" style={{ width: '100%', marginTop: 24 }}>
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <p className="eyebrow">Technical intake</p>
        <h3>Define the engineering requirement</h3>
      </div>
      <label className="field">Project type<input name="project_type" defaultValue={projectType ?? ''} /></label>
      <label className="field">Discipline<input name="discipline" placeholder="Mechanical design, CAD drafting, CAM, documentation..." /></label>
      <label className="field">Requirement description<textarea name="description" required rows={7} placeholder="Describe the part, assembly, drawing pack or engineering output required." /></label>
      <label className="field">Required deliverables<textarea name="deliverables" rows={4} placeholder="STEP files, native CAD, manufacturing drawings, BOM, CAM setup..." /></label>
      <label className="field">Required-by date<input name="deadline" type="date" /></label>
      <label className="field">Special requirements<textarea name="special_requirements" rows={4} placeholder="Standards, tolerances, materials, software version, confidentiality or review requirements." /></label>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button className="button secondary" name="status" value="draft" disabled={pending}>Save draft</button>
        <button className="button" name="status" value="submitted" disabled={pending}>Submit for review</button>
      </div>
      {!state.ok && state.error ? <p role="alert">{state.error}</p> : null}
      {state.ok ? <p role="status">Technical intake saved successfully.</p> : null}
    </form>
  );
}
