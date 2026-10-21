'use client';

import { FormEvent, useState } from 'react';
import { submitNativeIntake } from '@/components/formSubmission';

const fieldClass =
  'field_input border-0 border-b border-white/40 bg-transparent px-0 py-3 text-white outline-none transition placeholder:text-white focus:!border-white focus:!shadow-[0_1px_0_rgba(255,255,255,0.9)] disabled:text-white';
const labelClass = 'field_group grid gap-2 text-xs font-medium uppercase text-white';

export default function EnquiryForm() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submissionInfo, setSubmissionInfo] = useState<{ submissionId: string; timestamp: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(false);
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const form = event.currentTarget;
      const completedAt = new Date().toISOString();
      const websiteSubmissionId = `overflow-partner-${completedAt.replace(/[^0-9]/g, '')}`;
      const formData = new FormData(form);
      const payload: Record<string, string> = {};

      formData.forEach((value, key) => {
        if (typeof value === 'string') payload[key] = value;
      });

      const result = await submitNativeIntake({
        ...payload,
        lead_id: websiteSubmissionId,
        source: 'Website',
        pageUrl: window.location.href,
        nurture_consent: formData.get('nurture_consent') === 'on' ? 'true' : 'false',
      });

      // Keep the existing acknowledgement reference; Step 2 is invitation-only after interest.
      setSubmissionInfo(result);
      setSubmitted(true);
      form.reset();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The requirement could not be submitted. Please try again shortly.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form_enquiry grid gap-8" onSubmit={handleSubmit}>
      <p className="text_body max-w-xl text-sm leading-6 text-white">Tell us about your engineering requirement. We will acknowledge your enquiry and only invite you to the detailed secure form after you agree to proceed.</p>

      <div className="grid gap-8 md:grid-cols-2">
        <label className={labelClass} htmlFor="full-name">Full Name<input className={fieldClass} id="full-name" name="full_name" type="text" minLength={2} required disabled={isSubmitting} /></label>
        <label className={labelClass} htmlFor="work-email">Work Email<input className={fieldClass} id="work-email" name="work_email" type="email" required disabled={isSubmitting} /></label>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <label className={labelClass} htmlFor="company">Company<input className={fieldClass} id="company" name="company" type="text" minLength={2} required disabled={isSubmitting} /></label>
        <label className={labelClass} htmlFor="project-type">Project Type<select className={fieldClass} id="project-type" name="project_type" required defaultValue="" disabled={isSubmitting}><option value="" disabled>Select project type</option><option>Overflow CAD drafting support</option><option>Manufacturing-ready CAM assistance</option><option>Engineering documentation handoff</option><option>Other CAD/CAM requirement</option></select></label>
      </div>
      <label className={labelClass} htmlFor="brief-requirement">Brief Requirement<textarea className={`${fieldClass} field_textarea min-h-24 resize-y`} id="brief-requirement" name="brief_requirement" placeholder="At least 10 characters. Technical detail comes in Step 2." minLength={10} maxLength={4000} required disabled={isSubmitting} /></label>
      <label className="flex max-w-xl items-start gap-3 text-sm leading-6 text-white">
        <input type="checkbox" name="nurture_consent" className="mt-1.5 h-4 w-4 shrink-0" disabled={isSubmitting}/>
        <span>Yes, you may email me up to five follow-up messages about Overflow Partner's engineering services. I can unsubscribe at any time. This is optional; you will still receive an acknowledgement of this enquiry.</span>
      </label>
      <div className="form_actions grid gap-4 border-t border-white/40 pt-8 md:grid-cols-[auto_1fr] md:items-center">
        <button className="button_primary min-h-12 rounded-md bg-white px-7 py-3 text-sm font-medium uppercase text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white disabled:text-black" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting' : 'Submit Requirement'}</button>
        <p className="text_body text-sm text-white">We will email an acknowledgement. Technical intake follows after you confirm interest.</p>
      </div>
      {submitted ? <p className="text_success rounded-md border border-white bg-white p-4 text-sm text-black" role="status">We&apos;ve received your initial request. Submission ID: {submissionInfo?.submissionId}.</p> : null}
      {errorMessage ? <p className="text_error rounded-md border border-white/15 p-4 text-sm text-white" role="alert">{errorMessage}</p> : null}
    </form>
  );
}
