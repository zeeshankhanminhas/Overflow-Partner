'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type IntakeState = { session?: { status: string; expires_at: string; prospect: { company_name: string; contact_name: string | null; project_type: string | null; requirement_summary: string | null } }; submission?: Record<string, unknown> | null; message?: string };

export default function TechnicalIntakePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [state, setState] = useState<IntakeState>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => { fetch(`/api/intake/${token}`).then(async (response) => {
    const data = await response.json(); setState(data); setLoading(false);
  }).catch(() => { setState({ message: 'Unable to load this technical intake.' }); setLoading(false); }); }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setResult('');
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch(`/api/intake/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const body = await response.json(); setSubmitting(false);
    if (!response.ok) { setResult(body.message || 'Unable to submit the technical intake.'); return; }
    setResult('Technical intake submitted successfully. Overflow Partner will now review the engineering requirement.');
    setState((current) => ({ ...current, session: current.session ? { ...current.session, status: 'submitted' } : undefined }));
  }

  if (loading) return <main className="container section"><p>Loading technical intake…</p></main>;
  if (!state.session) return <main className="container section"><p className="eyebrow">Overflow Partner</p><h1>Technical intake unavailable</h1><p>{state.message}</p></main>;
  const prospect = state.session.prospect;
  const completed = ['submitted', 'converted'].includes(state.session.status);

  return <main className="container section" style={{ maxWidth: 980 }}>
    <p className="eyebrow">Step 2 · Technical requirement</p>
    <h1>Help us understand the engineering work.</h1>
    <p className="lede">Your initial enquiry for <strong>{prospect.company_name}</strong> has been received. This controlled form captures the scope needed for technical review and accurate pricing.</p>
    <section className="card" style={{ width: '100%', marginTop: 24 }}>
      <p className="eyebrow">Initial brief</p><h2>{prospect.project_type || 'Engineering support'}</h2>
      <p>{prospect.requirement_summary || 'No initial requirement summary was supplied.'}</p>
      <small>Link expires {new Date(state.session.expires_at).toLocaleString('en-GB')}</small>
    </section>
    {completed ? <section className="card" style={{ width: '100%', marginTop: 24 }}><h2>Submission received</h2><p>Your technical requirement is now awaiting internal review.</p></section> :
    <form onSubmit={submit} className="card" style={{ width: '100%', marginTop: 24, display: 'grid', gap: 18 }}>
      <label>Detailed description<textarea name="description" required minLength={20} rows={6} defaultValue={String(state.submission?.description || prospect.requirement_summary || '')} placeholder="Describe the component, assembly, drawing pack or engineering task." /></label>
      <label>Required deliverables<textarea name="deliverables" required minLength={5} rows={4} defaultValue={String(state.submission?.deliverables || '')} placeholder="For example: 3D models, manufacturing drawings, BOM, DXF files or revisions." /></label>
      <div className="form-grid"><label>Project type<input name="project_type" required defaultValue={String(state.submission?.project_type || prospect.project_type || '')} /></label><label>Engineering discipline<input name="discipline" defaultValue={String(state.submission?.discipline || '')} placeholder="Mechanical, fabrication, electrical…" /></label></div>
      <div className="form-grid"><label>Software / platform<input name="software" defaultValue={String(state.submission?.software || '')} placeholder="SolidWorks, Inventor, AutoCAD…" /></label><label>Approx. drawing count<input name="drawing_count" type="number" min="0" defaultValue={String(state.submission?.drawing_count || '')} /></label></div>
      <div className="form-grid"><label>Source file format<input name="source_file_format" defaultValue={String(state.submission?.source_file_format || '')} placeholder="STEP, SLDPRT, PDF…" /></label><label>Required output format<input name="required_output_format" defaultValue={String(state.submission?.required_output_format || '')} placeholder="PDF, DWG, DXF, native CAD…" /></label></div>
      <div className="form-grid"><label>Required deadline<input name="deadline" type="date" defaultValue={String(state.submission?.deadline || '')} /></label><label>Revision status<input name="revision_status" defaultValue={String(state.submission?.revision_status || '')} placeholder="New design, redline revision, as-built…" /></label></div>
      <label>Standards or specifications<textarea name="standards" rows={3} defaultValue={String(state.submission?.standards || '')} placeholder="BS, ISO, customer standards, drawing conventions…" /></label>
      <label>Tolerances or critical requirements<textarea name="tolerances" rows={3} defaultValue={String(state.submission?.tolerances || '')} /></label>
      <label>Special instructions<textarea name="special_instructions" rows={4} defaultValue={String(state.submission?.special_instructions || '')} /></label>
      <p style={{ color: 'var(--muted)' }}>File upload will be enabled through the private technical-intake storage bucket after the database migration is active.</p>
      <button className="button" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit technical requirement'}</button>
      {result ? <p role="status">{result}</p> : null}
    </form>}
  </main>;
}
