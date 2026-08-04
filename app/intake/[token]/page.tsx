'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type IntakeState = {
  session?: {
    status: string;
    expires_at: string;
    prospect: {
      company_name: string;
      contact_name: string | null;
      project_type: string | null;
      requirement_summary: string | null;
    };
  };
  submission?: Record<string, unknown> | null;
  message?: string;
};

const fieldClass = 'field_input w-full border-0 border-b border-black/20 bg-transparent px-0 py-3 text-[var(--ink)] outline-none transition placeholder:text-neutral-400 focus:border-black';
const labelClass = 'grid gap-2 text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]';
const sectionClass = 'grid gap-7 border-t border-black/10 pt-8';

const projectTypes = ['CAD detailing', 'Manufacturing drawings', '3D modelling', 'Design revision', 'Drawing conversion', 'CAM support', 'BOM / documentation', 'Engineering overflow support', 'Other / unsure'];
const disciplines = ['Mechanical', 'Fabrication', 'Sheet metal', 'Machining', 'Electrical', 'Civil / structural', 'Product design', 'Multi-discipline', 'Other / unsure'];
const softwareOptions = ['SolidWorks', 'Autodesk Inventor', 'AutoCAD', 'Fusion 360', 'Siemens NX', 'CATIA', 'Creo', 'Solid Edge', 'Other', 'No preference / unsure'];
const sourceFormats = ['STEP / STP', 'IGES / IGS', 'Parasolid', 'SLDPRT / SLDASM', 'IPT / IAM', 'DWG', 'DXF', 'PDF', 'Image / scan', 'No source files', 'Multiple formats', 'Other / unsure'];
const outputFormats = ['PDF drawing pack', 'DWG', 'DXF', 'STEP / STP', 'Native CAD files', 'CAM files', 'BOM / spreadsheet', 'Multiple formats', 'Other / unsure'];
const revisionStatuses = ['New design', 'Existing design amendment', 'Redline revision', 'Legacy drawing conversion', 'As-built update', 'Drawing standardisation', 'Reverse engineering', 'Unsure'];
const timelines = ['Urgent: 24–72 hours', 'Within 1 week', 'Within 2 weeks', 'Within 1 month', 'Date-specific', 'Flexible', 'Unsure'];
const complexities = ['Simple', 'Moderate', 'Complex', 'Multi-part assembly', 'Mixed scope', 'Unsure'];
const filesAvailability = ['Complete source pack available', 'Partial files available', 'Client drawings only', 'Physical sample only', 'Files not yet available', 'No source files', 'Unsure'];
const deliverableOptions = ['3D CAD models', 'Manufacturing drawings', 'PDF drawing pack', 'DWG files', 'DXF files', 'STEP / neutral files', 'Native CAD files', 'BOM', 'CAM files', 'Revision / redline updates'];

function SelectField({ label, name, options, defaultValue, required, disabled }: { label: string; name: string; options: string[]; defaultValue?: string; required?: boolean; disabled?: boolean }) {
  return (
    <label className={labelClass}>
      {label}
      <select className={`${fieldClass} normal-case tracking-normal`} name={name} defaultValue={defaultValue || ''} required={required} disabled={disabled}>
        <option value="">Select an option</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default function TechnicalIntakePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [state, setState] = useState<IntakeState>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    fetch(`/api/intake/${token}`).then(async (response) => {
      const data = await response.json();
      setState(data);
      setLoading(false);
    }).catch(() => {
      setState({ message: 'Unable to load this technical intake.' });
      setLoading(false);
    });
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult('');
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>;
    const selectedDeliverables = formData.getAll('deliverable_items').map(String);
    payload.deliverables = selectedDeliverables.join(', ');
    delete payload.deliverable_items;

    const response = await fetch(`/api/intake/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setResult(body.message || 'Unable to submit the technical intake.');
      return;
    }
    setResult('Technical intake submitted successfully. Overflow Partner will now review the engineering requirement.');
    setState((current) => ({ ...current, session: current.session ? { ...current.session, status: 'submitted' } : undefined }));
  }

  if (loading) return <main className="padding_global min-h-screen bg-[var(--paper)] py-20"><div className="container_large border-t border-black/10 pt-10"><p className="text-sm text-[var(--subtle)]">Loading technical intake…</p></div></main>;
  if (!state.session) return <main className="padding_global min-h-screen bg-[var(--paper)] py-20"><div className="container_large grid gap-5 border-t border-black/10 pt-10"><p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">Overflow Partner</p><h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-[var(--ink)] md:text-6xl">Technical intake unavailable</h1><p className="max-w-xl text-base leading-7 text-[var(--muted)]">{state.message}</p></div></main>;

  const prospect = state.session.prospect;
  const completed = ['submitted', 'converted'].includes(state.session.status);
  const expiresAt = new Date(state.session.expires_at);
  const previousDeliverables = String(state.submission?.deliverables || '').split(',').map((value) => value.trim()).filter(Boolean);

  return (
    <main className="padding_global min-h-screen bg-[var(--paper)] py-16 md:py-24">
      <div className="container_large grid gap-12 border-t border-black/10 pt-10 lg:grid-cols-[0.9fr_1.4fr] lg:gap-16">
        <aside className="grid content-start gap-8 lg:sticky lg:top-10 lg:self-start">
          <div className="grid gap-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">Overflow Partner · Step 2</p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.035em] text-[var(--ink)] md:text-6xl">Technical intake</h1>
            <p className="max-w-xl text-base leading-7 text-[var(--muted)]">Provide the engineering detail needed to assess scope, capability, timing and commercial fit.</p>
          </div>
          <div className="grid gap-6 border-t border-black/10 pt-7">
            <div className="grid gap-2"><p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">Company</p><p className="text-xl font-medium text-[var(--ink)]">{prospect.company_name}</p></div>
            <div className="grid gap-2"><p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">Initial requirement</p><p className="text-base leading-7 text-[var(--muted)]">{prospect.requirement_summary || 'No initial requirement summary was supplied.'}</p></div>
            <div className="grid grid-cols-2 gap-6 border-t border-black/10 pt-6">
              <div className="grid gap-2"><p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">Project type</p><p className="text-sm leading-6 text-[var(--ink)]">{prospect.project_type || 'Engineering support'}</p></div>
              <div className="grid gap-2"><p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">Link expiry</p><p className="text-sm leading-6 text-[var(--ink)]">{expiresAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
            </div>
          </div>
          <div className="border-l-2 border-[var(--accent)] pl-5"><p className="text-sm leading-6 text-[var(--muted)]">Controlled selections improve technical routing and partner matching. Choose “Other / unsure” where the exact answer is not yet known.</p></div>
        </aside>

        {completed ? (
          <section className="grid content-start gap-6 border-t border-black/10 pt-10"><p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">Submission received</p><h2 className="text-3xl font-semibold tracking-[-0.025em] text-[var(--ink)]">Technical requirement submitted.</h2><p className="max-w-2xl text-base leading-7 text-[var(--muted)]">Your information is now awaiting internal engineering review. Overflow Partner will contact you if clarification is required.</p></section>
        ) : (
          <form className="grid gap-10" onSubmit={submit}>
            <section className={sectionClass}>
              <div className="grid gap-2"><p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">01 · Scope</p><h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">What work needs to be completed?</h2></div>
              <label className={labelClass}>Detailed description<textarea className={`${fieldClass} min-h-36 resize-y normal-case tracking-normal`} name="description" required minLength={20} defaultValue={String(state.submission?.description || prospect.requirement_summary || '')} placeholder="Describe the component, assembly, drawing pack or engineering task." disabled={submitting} /></label>
              <div className="grid gap-4">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">Required deliverables</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {deliverableOptions.map((item) => <label key={item} className="flex items-center gap-3 border-b border-black/10 py-3 text-sm text-[var(--ink)]"><input className="h-4 w-4" type="checkbox" name="deliverable_items" value={item} defaultChecked={previousDeliverables.includes(item)} disabled={submitting} />{item}</label>)}
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <div className="grid gap-2"><p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">02 · Engineering context</p><h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Define the technical environment.</h2></div>
              <div className="grid gap-8 md:grid-cols-2">
                <SelectField label="Project type" name="project_type" options={projectTypes} defaultValue={String(state.submission?.project_type || prospect.project_type || '')} required disabled={submitting} />
                <SelectField label="Engineering discipline" name="discipline" options={disciplines} defaultValue={String(state.submission?.discipline || '')} disabled={submitting} />
                <SelectField label="Software / platform" name="software" options={softwareOptions} defaultValue={String(state.submission?.software || '')} disabled={submitting} />
                <label className={labelClass}>Approx. drawing count<input className={`${fieldClass} normal-case tracking-normal`} name="drawing_count" type="number" min="0" defaultValue={String(state.submission?.drawing_count || '')} disabled={submitting} /></label>
                <SelectField label="Initial complexity" name="complexity" options={complexities} defaultValue={String(state.submission?.complexity || '')} disabled={submitting} />
                <SelectField label="Files / drawings available" name="files_availability" options={filesAvailability} defaultValue={String(state.submission?.files_availability || '')} disabled={submitting} />
              </div>
            </section>

            <section className={sectionClass}>
              <div className="grid gap-2"><p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">03 · Inputs, outputs and timing</p><h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Confirm formats, revision state and delivery window.</h2></div>
              <div className="grid gap-8 md:grid-cols-2">
                <SelectField label="Source file format" name="source_file_format" options={sourceFormats} defaultValue={String(state.submission?.source_file_format || '')} disabled={submitting} />
                <SelectField label="Primary output format" name="required_output_format" options={outputFormats} defaultValue={String(state.submission?.required_output_format || '')} disabled={submitting} />
                <SelectField label="Timeline / urgency" name="timeline" options={timelines} defaultValue={String(state.submission?.timeline || '')} disabled={submitting} />
                <label className={labelClass}>Required deadline<input className={`${fieldClass} normal-case tracking-normal`} name="deadline" type="date" defaultValue={String(state.submission?.deadline || '')} disabled={submitting} /></label>
                <SelectField label="Revision status" name="revision_status" options={revisionStatuses} defaultValue={String(state.submission?.revision_status || '')} disabled={submitting} />
              </div>
            </section>

            <section className={sectionClass}>
              <div className="grid gap-2"><p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">04 · Control requirements</p><h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Capture standards and critical constraints.</h2></div>
              <label className={labelClass}>Standards or specifications<textarea className={`${fieldClass} min-h-24 resize-y normal-case tracking-normal`} name="standards" defaultValue={String(state.submission?.standards || '')} placeholder="BS, ISO, customer standards, drawing conventions…" disabled={submitting} /></label>
              <label className={labelClass}>Tolerances or critical requirements<textarea className={`${fieldClass} min-h-24 resize-y normal-case tracking-normal`} name="tolerances" defaultValue={String(state.submission?.tolerances || '')} disabled={submitting} /></label>
              <label className={labelClass}>Special instructions<textarea className={`${fieldClass} min-h-28 resize-y normal-case tracking-normal`} name="special_instructions" defaultValue={String(state.submission?.special_instructions || '')} placeholder="Include assumptions, unknowns, other software/formats or anything that may affect delivery." disabled={submitting} /></label>
            </section>

            <section className="grid gap-6 border-t border-black/10 pt-8">
              <div className="grid gap-2 border border-dashed border-black/20 bg-white/40 p-6"><p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">Technical files</p><p className="text-sm leading-6 text-[var(--muted)]">Private file upload is being connected to the controlled technical-intake storage area. Your written technical requirement can be submitted now.</p></div>
              <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center"><button className="min-h-12 bg-[var(--ink)] px-7 py-3 text-sm font-medium uppercase tracking-[0.08em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-neutral-500" type="submit" disabled={submitting}>{submitting ? 'Submitting' : 'Submit technical intake'}</button><p className="text-sm leading-6 text-[var(--subtle)]">This creates the controlled Step 2 record for internal technical review.</p></div>
              {result ? <p className="border border-black/10 bg-white/50 p-4 text-sm leading-6 text-[var(--muted)]" role="status">{result}</p> : null}
            </section>
          </form>
        )}
      </div>
    </main>
  );
}
