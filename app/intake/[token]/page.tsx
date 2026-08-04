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

const fieldClass =
  'field_input w-full border-0 border-b border-black/20 bg-transparent px-0 py-3 text-[var(--ink)] outline-none transition placeholder:text-neutral-400 focus:border-black';
const labelClass = 'grid gap-2 text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]';
const sectionClass = 'grid gap-7 border-t border-black/10 pt-8';

export default function TechnicalIntakePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [state, setState] = useState<IntakeState>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    fetch(`/api/intake/${token}`)
      .then(async (response) => {
        const data = await response.json();
        setState(data);
        setLoading(false);
      })
      .catch(() => {
        setState({ message: 'Unable to load this technical intake.' });
        setLoading(false);
      });
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult('');
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch(`/api/intake/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setResult(body.message || 'Unable to submit the technical intake.');
      return;
    }
    setResult('Technical intake submitted successfully. Overflow Partner will now review the engineering requirement.');
    setState((current) => ({
      ...current,
      session: current.session ? { ...current.session, status: 'submitted' } : undefined,
    }));
  }

  if (loading) {
    return (
      <main className="padding_global min-h-screen bg-[var(--paper)] py-20">
        <div className="container_large border-t border-black/10 pt-10">
          <p className="text-sm text-[var(--subtle)]">Loading technical intake…</p>
        </div>
      </main>
    );
  }

  if (!state.session) {
    return (
      <main className="padding_global min-h-screen bg-[var(--paper)] py-20">
        <div className="container_large grid gap-5 border-t border-black/10 pt-10">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">Overflow Partner</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-[var(--ink)] md:text-6xl">Technical intake unavailable</h1>
          <p className="max-w-xl text-base leading-7 text-[var(--muted)]">{state.message}</p>
        </div>
      </main>
    );
  }

  const prospect = state.session.prospect;
  const completed = ['submitted', 'converted'].includes(state.session.status);
  const expiresAt = new Date(state.session.expires_at);

  return (
    <main className="padding_global min-h-screen bg-[var(--paper)] py-16 md:py-24">
      <div className="container_large grid gap-12 border-t border-black/10 pt-10 lg:grid-cols-[0.9fr_1.4fr] lg:gap-16">
        <aside className="grid content-start gap-8 lg:sticky lg:top-10 lg:self-start">
          <div className="grid gap-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">Overflow Partner · Step 2</p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.035em] text-[var(--ink)] md:text-6xl">Technical intake</h1>
            <p className="max-w-xl text-base leading-7 text-[var(--muted)]">
              Provide the engineering detail needed to assess scope, capability, timing and commercial fit.
            </p>
          </div>

          <div className="grid gap-6 border-t border-black/10 pt-7">
            <div className="grid gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">Company</p>
              <p className="text-xl font-medium text-[var(--ink)]">{prospect.company_name}</p>
            </div>
            <div className="grid gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">Initial requirement</p>
              <p className="text-base leading-7 text-[var(--muted)]">{prospect.requirement_summary || 'No initial requirement summary was supplied.'}</p>
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-black/10 pt-6">
              <div className="grid gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">Project type</p>
                <p className="text-sm leading-6 text-[var(--ink)]">{prospect.project_type || 'Engineering support'}</p>
              </div>
              <div className="grid gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">Link expiry</p>
                <p className="text-sm leading-6 text-[var(--ink)]">{expiresAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>
          </div>

          <div className="border-l-2 border-[var(--accent)] pl-5">
            <p className="text-sm leading-6 text-[var(--muted)]">
              Your answers become part of the controlled technical review record. Complete only what is known; uncertainty can be noted in the final section.
            </p>
          </div>
        </aside>

        {completed ? (
          <section className="grid content-start gap-6 border-t border-black/10 pt-10">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">Submission received</p>
            <h2 className="text-3xl font-semibold tracking-[-0.025em] text-[var(--ink)]">Technical requirement submitted.</h2>
            <p className="max-w-2xl text-base leading-7 text-[var(--muted)]">Your information is now awaiting internal engineering review. Overflow Partner will contact you if clarification is required.</p>
          </section>
        ) : (
          <form className="grid gap-10" onSubmit={submit}>
            <section className={sectionClass}>
              <div className="grid gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">01 · Scope</p>
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">What work needs to be completed?</h2>
              </div>
              <label className={labelClass} htmlFor="description">
                Detailed description
                <textarea className={`${fieldClass} min-h-36 resize-y normal-case tracking-normal`} id="description" name="description" required minLength={20} defaultValue={String(state.submission?.description || prospect.requirement_summary || '')} placeholder="Describe the component, assembly, drawing pack or engineering task." disabled={submitting} />
              </label>
              <label className={labelClass} htmlFor="deliverables">
                Required deliverables
                <textarea className={`${fieldClass} min-h-28 resize-y normal-case tracking-normal`} id="deliverables" name="deliverables" required minLength={5} defaultValue={String(state.submission?.deliverables || '')} placeholder="For example: 3D models, manufacturing drawings, BOM, DXF files or revisions." disabled={submitting} />
              </label>
            </section>

            <section className={sectionClass}>
              <div className="grid gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">02 · Engineering context</p>
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Define the technical environment.</h2>
              </div>
              <div className="grid gap-8 md:grid-cols-2">
                <label className={labelClass}>Project type<input className={`${fieldClass} normal-case tracking-normal`} name="project_type" required defaultValue={String(state.submission?.project_type || prospect.project_type || '')} disabled={submitting} /></label>
                <label className={labelClass}>Engineering discipline<input className={`${fieldClass} normal-case tracking-normal`} name="discipline" defaultValue={String(state.submission?.discipline || '')} placeholder="Mechanical, fabrication, electrical…" disabled={submitting} /></label>
                <label className={labelClass}>Software / platform<input className={`${fieldClass} normal-case tracking-normal`} name="software" defaultValue={String(state.submission?.software || '')} placeholder="SolidWorks, Inventor, AutoCAD…" disabled={submitting} /></label>
                <label className={labelClass}>Approx. drawing count<input className={`${fieldClass} normal-case tracking-normal`} name="drawing_count" type="number" min="0" defaultValue={String(state.submission?.drawing_count || '')} disabled={submitting} /></label>
              </div>
            </section>

            <section className={sectionClass}>
              <div className="grid gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">03 · Inputs and outputs</p>
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Confirm formats and revision state.</h2>
              </div>
              <div className="grid gap-8 md:grid-cols-2">
                <label className={labelClass}>Source file format<input className={`${fieldClass} normal-case tracking-normal`} name="source_file_format" defaultValue={String(state.submission?.source_file_format || '')} placeholder="STEP, SLDPRT, PDF…" disabled={submitting} /></label>
                <label className={labelClass}>Required output format<input className={`${fieldClass} normal-case tracking-normal`} name="required_output_format" defaultValue={String(state.submission?.required_output_format || '')} placeholder="PDF, DWG, DXF, native CAD…" disabled={submitting} /></label>
                <label className={labelClass}>Required deadline<input className={`${fieldClass} normal-case tracking-normal`} name="deadline" type="date" defaultValue={String(state.submission?.deadline || '')} disabled={submitting} /></label>
                <label className={labelClass}>Revision status<input className={`${fieldClass} normal-case tracking-normal`} name="revision_status" defaultValue={String(state.submission?.revision_status || '')} placeholder="New design, redline revision, as-built…" disabled={submitting} /></label>
              </div>
            </section>

            <section className={sectionClass}>
              <div className="grid gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">04 · Control requirements</p>
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Capture standards and critical constraints.</h2>
              </div>
              <label className={labelClass}>Standards or specifications<textarea className={`${fieldClass} min-h-24 resize-y normal-case tracking-normal`} name="standards" defaultValue={String(state.submission?.standards || '')} placeholder="BS, ISO, customer standards, drawing conventions…" disabled={submitting} /></label>
              <label className={labelClass}>Tolerances or critical requirements<textarea className={`${fieldClass} min-h-24 resize-y normal-case tracking-normal`} name="tolerances" defaultValue={String(state.submission?.tolerances || '')} disabled={submitting} /></label>
              <label className={labelClass}>Special instructions<textarea className={`${fieldClass} min-h-28 resize-y normal-case tracking-normal`} name="special_instructions" defaultValue={String(state.submission?.special_instructions || '')} placeholder="Include assumptions, unknowns, access constraints or anything that may affect delivery." disabled={submitting} /></label>
            </section>

            <section className="grid gap-6 border-t border-black/10 pt-8">
              <div className="grid gap-2 border border-dashed border-black/20 bg-white/40 p-6">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">Technical files</p>
                <p className="text-sm leading-6 text-[var(--muted)]">Private file upload is being connected to the controlled technical-intake storage area. Your written technical requirement can be submitted now.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
                <button className="min-h-12 bg-[var(--ink)] px-7 py-3 text-sm font-medium uppercase tracking-[0.08em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-neutral-500" type="submit" disabled={submitting}>
                  {submitting ? 'Submitting' : 'Submit technical intake'}
                </button>
                <p className="text-sm leading-6 text-[var(--subtle)]">This creates the controlled Step 2 record for internal technical review.</p>
              </div>

              {result ? (
                <p className="border border-black/10 bg-white/50 p-4 text-sm leading-6 text-[var(--muted)]" role="status">{result}</p>
              ) : null}
            </section>
          </form>
        )}
      </div>
    </main>
  );
}
