'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type ReviewState = {
  review?: { id: string; case_reference: string; status: string; response_due_at: string; expires_at: string; review_instructions?: string | null; scope_summary: string; client_identity?: string | null };
  lead?: { title?: string; project_type?: string | null; service?: string | null };
  technical_intake?: Record<string, unknown> | null;
  partner?: { company_name: string; nda_signed: boolean } | null;
  files?: Array<{ id: string; display_name: string }>;
  latest_response?: Record<string, unknown> | null;
  commercial_response?: Record<string, unknown> | null;
  clarification?: { clarification_request: string; revision_number: number } | null;
  message?: string;
};

const field = 'w-full border-0 border-b border-black/20 bg-transparent px-0 py-3 outline-none focus:border-black';
const label = 'grid gap-2 text-xs font-medium uppercase tracking-[0.08em] text-neutral-500';
const section = 'grid gap-7 border-t border-black/10 pt-8';

function Select({ name, title, options, required = false, defaultValue = '' }: { name: string; title: string; options: Array<[string,string]>; required?: boolean; defaultValue?: string }) {
  return <label className={label}>{title}<select className={`${field} normal-case tracking-normal text-black`} name={name} required={required} defaultValue={defaultValue}><option value="">Select an option</option>{options.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}

export default function PartnerReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ReviewState>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`/api/partner-review/${token}`).then(async (response) => {
      const body = await response.json();
      setState(body);
      setLoading(false);
    }).catch(() => { setState({ message: 'Unable to load this partner review.' }); setLoading(false); });
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setMessage('');
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue | boolean>;
    payload.capability_confirmed = formData.get('capability_confirmed') === 'true';
    payload.declaration_checked = formData.get('declaration_checked') === 'true';
    const response = await fetch(`/api/partner-review/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json(); setSubmitting(false);
    if (!response.ok) return setMessage(body.message || 'Unable to submit the partner response.');
    setMessage('Technical and commercial response submitted. Overflow Partner will now complete its internal review.');
    setState((current) => ({ ...current, review: current.review ? { ...current.review, status: 'submitted' } : undefined, latest_response: body.response, commercial_response: body.commercial_response }));
  }

  if (loading) return <main className="min-h-screen bg-[#f5f4ef] px-6 py-20"><p>Loading controlled partner review…</p></main>;
  if (!state.review) return <main className="min-h-screen bg-[#f5f4ef] px-6 py-20"><div className="mx-auto max-w-5xl border-t border-black/10 pt-10"><p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Overflow Partner</p><h1 className="mt-4 text-4xl font-semibold">Partner review unavailable</h1><p className="mt-5 text-neutral-600">{state.message}</p></div></main>;

  const intake = state.technical_intake || {};
  const locked = ['submitted','approved','approved_with_conditions','rejected'].includes(state.review.status);
  return <main className="min-h-screen bg-[#f5f4ef] px-6 py-14 md:px-10 md:py-20">
    <div className="mx-auto grid max-w-7xl gap-14 border-t border-black/10 pt-10 lg:grid-cols-[0.9fr_1.45fr]">
      <aside className="grid content-start gap-8 lg:sticky lg:top-8 lg:self-start">
        <div><p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">Overflow Partner · Controlled review</p><h1 className="mt-5 text-4xl font-semibold tracking-[-0.035em] md:text-6xl">Partner review</h1><p className="mt-5 max-w-xl leading-7 text-neutral-600">Assess feasibility, capacity, risk, delivery readiness and commercial terms in one controlled response.</p></div>
        <div className="grid gap-5 border-t border-black/10 pt-7">
          <div><p className="text-xs uppercase tracking-[0.08em] text-neutral-500">Case reference</p><p className="mt-2 text-xl font-medium">{state.review.case_reference}</p></div>
          <div><p className="text-xs uppercase tracking-[0.08em] text-neutral-500">Scope</p><p className="mt-2 leading-7 text-neutral-700">{state.review.scope_summary}</p></div>
          {state.review.client_identity ? <div><p className="text-xs uppercase tracking-[0.08em] text-neutral-500">Client identity</p><p className="mt-2">{state.review.client_identity}</p></div> : null}
          <div className="grid grid-cols-2 gap-6 border-t border-black/10 pt-6"><div><p className="text-xs uppercase tracking-[0.08em] text-neutral-500">Response due</p><p className="mt-2 text-sm">{new Date(state.review.response_due_at).toLocaleDateString('en-GB')}</p></div><div><p className="text-xs uppercase tracking-[0.08em] text-neutral-500">NDA control</p><p className="mt-2 text-sm">{state.partner?.nda_signed ? 'Confirmed' : 'Not confirmed'}</p></div></div>
        </div>
        <div className="border-l-2 border-orange-500 pl-5 text-sm leading-6 text-neutral-600">Your commercial price is visible only to Overflow Partner. It cannot be selected for client pricing until your technical response is internally approved.</div>
      </aside>

      {locked ? <section className="grid content-start gap-6 border-t border-black/10 pt-10"><p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Response locked</p><h2 className="text-3xl font-semibold">Partner response received.</h2><p className="leading-7 text-neutral-600">The technical assessment and commercial price are recorded as separate linked records. Overflow Partner will issue a formal clarification request if revision is required.</p></section> : <form className="grid gap-10" onSubmit={submit}>
        <section className={section}><div><p className="text-xs uppercase tracking-[0.12em] text-neutral-500">01 · Review pack</p><h2 className="mt-2 text-2xl font-semibold">Engineering context</h2></div>
          <div className="grid gap-5 md:grid-cols-2">{['project_type','discipline','software','deliverables','source_file_format','required_output_format','drawing_count','standards','tolerances','deadline','complexity'].map((key) => <div key={key} className="border-b border-black/10 pb-4"><p className="text-xs uppercase tracking-[0.08em] text-neutral-500">{key.replaceAll('_',' ')}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{String(intake[key] || 'Not specified')}</p></div>)}</div>
          {state.review.review_instructions ? <div><p className="text-xs uppercase tracking-[0.08em] text-neutral-500">Review instructions</p><p className="mt-2 whitespace-pre-wrap leading-7">{state.review.review_instructions}</p></div> : null}
          <div><p className="text-xs uppercase tracking-[0.08em] text-neutral-500">Shared files</p>{state.files?.length ? <div className="mt-3 grid gap-2">{state.files.map((file) => <div key={file.id} className="border-b border-black/10 py-3 text-sm">{file.display_name}</div>)}</div> : <p className="mt-2 text-sm text-neutral-500">No controlled files were attached to this review.</p>}</div>
        </section>

        {state.clarification ? <section className="border-l-2 border-orange-500 pl-5"><p className="text-xs uppercase tracking-[0.08em] text-neutral-500">Clarification request · Revision {state.clarification.revision_number}</p><p className="mt-2 whitespace-pre-wrap leading-7">{state.clarification.clarification_request}</p></section> : null}

        <section className={section}><div><p className="text-xs uppercase tracking-[0.12em] text-neutral-500">02 · Feasibility</p><h2 className="mt-2 text-2xl font-semibold">Confirm technical capability.</h2></div>
          <div className="grid gap-8 md:grid-cols-2"><Select name="feasibility" title="Feasibility" required options={[["feasible","Feasible"],["feasible_with_conditions","Feasible with conditions"],["more_information_required","More information required"],["not_feasible","Not feasible"]]} /><label className={label}>Confidence %<input className={field} name="confidence_percent" type="number" min="0" max="100" required /></label><Select name="capability_confirmed" title="Capability confirmed" required options={[["true","Yes"],["false","No"]]} /><label className={label}>Software capability<input className={field} name="software_capability" /></label><Select name="capacity_status" title="Capacity status" required options={[["available","Available"],["limited","Limited"],["unavailable","Unavailable"]]} /><label className={label}>Earliest start date<input className={field} name="earliest_start_date" type="date" /></label></div>
        </section>

        <section className={section}><div><p className="text-xs uppercase tracking-[0.12em] text-neutral-500">03 · Delivery readiness</p><h2 className="mt-2 text-2xl font-semibold">Estimate effort and conditions.</h2></div>
          <div className="grid gap-8 md:grid-cols-2"><label className={label}>Estimated engineering hours<input className={field} name="estimated_engineering_hours" type="number" min="0" step="0.25" /></label><label className={label}>Estimated lead time days<input className={field} name="estimated_lead_time_days" type="number" min="0" /></label><Select name="pricing_readiness" title="Pricing readiness" required defaultValue="ready" options={[["ready","Ready"],["pending_information","Pending information"],["technical_review_only","Technical review only"]]} /></div>
          {[['missing_information','Missing information'],['assumptions','Conditions / assumptions'],['technical_risks','Technical risks'],['proposed_delivery_approach','Proposed delivery approach'],['exclusions','Technical exclusions'],['not_feasible_reason','Not feasible reason'],['partner_notes','Partner notes']].map(([name,title]) => <label className={label} key={name}>{title}<textarea className={`${field} min-h-24 resize-y normal-case tracking-normal`} name={name} /></label>)}
        </section>

        <section className={section}><div><p className="text-xs uppercase tracking-[0.12em] text-neutral-500">04 · Commercial response</p><h2 className="mt-2 text-2xl font-semibold">Provide price and commercial terms.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">Price and currency are required when the scope is feasible. They may be left blank when more information is required or the work is not feasible.</p></div>
          <div className="grid gap-8 md:grid-cols-2"><label className={label}>Commercial price<input className={field} name="commercial_price" type="number" min="0.01" step="0.01" /></label><Select name="commercial_currency" title="Currency" defaultValue="GBP" options={[["GBP","GBP"],["USD","USD"],["EUR","EUR"],["AED","AED"]]} /><label className={label}>Quote reference<input className={field} name="quote_reference" /></label><label className={label}>Valid until<input className={field} name="commercial_valid_until" type="date" /></label></div>
          {[['payment_terms','Payment terms'],['delivery_commitment','Delivery commitment'],['commercial_assumptions','Commercial assumptions'],['commercial_exclusions','Commercial exclusions']].map(([name,title]) => <label className={label} key={name}>{title}<textarea className={`${field} min-h-24 resize-y normal-case tracking-normal`} name={name} /></label>)}
        </section>

        <section className={section}><div><p className="text-xs uppercase tracking-[0.12em] text-neutral-500">05 · Declaration</p><h2 className="mt-2 text-2xl font-semibold">Identify the reviewer.</h2></div><div className="grid gap-8 md:grid-cols-2"><label className={label}>Reviewer name<input className={field} name="reviewer_name" required /></label><label className={label}>Reviewer role<input className={field} name="reviewer_role" /></label></div><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" name="declaration_checked" value="true" required />I confirm that I reviewed the controlled scope and that the technical and commercial response accurately states our capability, assumptions, risks, capacity, price and terms.</label><button className="min-h-12 bg-black px-7 py-3 text-sm font-medium uppercase tracking-[0.08em] text-white disabled:bg-neutral-500" disabled={submitting}>{submitting ? 'Submitting' : 'Submit technical and commercial response'}</button>{message ? <p className="border border-black/10 bg-white/50 p-4 text-sm" role="status">{message}</p> : null}</section>
      </form>}
    </div>
  </main>;
}
