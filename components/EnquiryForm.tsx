'use client';

import { FormEvent, useState } from 'react';
import { getWebhookDiagnostics, submitUrlEncodedPayload } from '@/components/formSubmission';

type AutomationMeta = {
  leadId: string;
  step1CompletedAt: string;
};

const fieldClass =
  'field_input border-0 border-b border-white/40 bg-transparent px-0 py-3 text-white outline-none transition placeholder:text-white focus:!border-white focus:!shadow-[0_1px_0_rgba(255,255,255,0.9)] disabled:text-white';
const labelClass = 'field_group grid gap-2 text-xs font-medium uppercase text-white';

export default function EnquiryForm() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [automationMeta, setAutomationMeta] = useState<AutomationMeta>({ leadId: '', step1CompletedAt: '' });
  const [submissionInfo, setSubmissionInfo] = useState<{ submissionId: string; timestamp: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(false);
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const form = event.currentTarget;
      const completedAt = new Date().toISOString();
      const leadId = `overflow-partner-${completedAt.replace(/[^0-9]/g, '')}`;
      const formData = new FormData(form);
      const payload: Record<string, string> = {};

      formData.forEach((value, key) => {
        if (typeof value === 'string') payload[key] = value;
      });

      await submitUrlEncodedPayload({
        ...payload,
        formStage: 'step1',
        lead_id: leadId,
        step_1_completed_at: completedAt,
        source: 'Website',
        pageUrl: window.location.href,
      });

      setAutomationMeta({ leadId, step1CompletedAt: completedAt });
      setSubmissionInfo({ submissionId: leadId, timestamp: completedAt });
      setSubmitted(true);
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Submission failed.';
      const diagnostics = getWebhookDiagnostics();
      const diagnosticSummary = [
        `Gateway configured: ${diagnostics.hasGatewayUrl ? 'yes' : 'no'}`,
        `Gateway is not Apps Script: ${diagnostics.gatewayLooksLikeAppsScript ? 'no' : 'yes'}`,
      ].join(' | ');
      setErrorMessage(`${message} ${diagnosticSummary}. Please use the contact form again later.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form_enquiry grid gap-8" onSubmit={handleSubmit}>
      <p className="text_body max-w-xl text-sm leading-6 text-white">Send the first request. The technical requirement form follows by email.</p>
      <input type="hidden" name="lead_id" value={automationMeta.leadId} readOnly />
      <input type="hidden" name="step_1_completed_at" value={automationMeta.step1CompletedAt} readOnly />
      <input type="hidden" name="step_2_completed" value="false" readOnly />
      <input type="hidden" name="nurture_state" value="Active" readOnly />
      <input type="hidden" name="reminder_status" value="Pending" readOnly />
      <input type="hidden" name="lead_score" value="" readOnly />
      <input type="hidden" name="qualification_status" value="Pending" readOnly />
      <input type="hidden" name="high_value_flag" value="false" readOnly />

      <div className="grid gap-8 md:grid-cols-2">
        <label className={labelClass} htmlFor="full-name">Full Name<input className={fieldClass} id="full-name" name="full_name" type="text" required disabled={isSubmitting} /></label>
        <label className={labelClass} htmlFor="work-email">Work Email<input className={fieldClass} id="work-email" name="work_email" type="email" required disabled={isSubmitting} /></label>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <label className={labelClass} htmlFor="company">Company<input className={fieldClass} id="company" name="company" type="text" required disabled={isSubmitting} /></label>
        <label className={labelClass} htmlFor="project-type">Project Type<select className={fieldClass} id="project-type" name="project_type" required defaultValue="" disabled={isSubmitting}><option value="" disabled>Select project type</option><option>Overflow CAD drafting support</option><option>Manufacturing-ready CAM assistance</option><option>Engineering documentation handoff</option><option>Other CAD/CAM requirement</option></select></label>
      </div>
      <label className={labelClass} htmlFor="brief-requirement">Brief Requirement<textarea className={`${fieldClass} field_textarea min-h-24 resize-y`} id="brief-requirement" name="brief_requirement" placeholder="A short summary is enough. Technical detail comes in Step 2." required disabled={isSubmitting} /></label>
      <div className="form_actions grid gap-4 border-t border-white/40 pt-8 md:grid-cols-[auto_1fr] md:items-center">
        <button className="button_primary min-h-12 rounded-md bg-white px-7 py-3 text-sm font-medium uppercase text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white disabled:text-black" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting' : 'Submit Requirement'}</button>
        <p className="text_body text-sm text-white">Step 2 follows by email.</p>
      </div>
      {submitted ? <p className="text_success rounded-md border border-white bg-white p-4 text-sm text-black" role="status">We&apos;ve received your initial request. Check your email to complete the technical requirement form.{submissionInfo ? ` Submission ID: ${submissionInfo.submissionId} at ${new Date(submissionInfo.timestamp).toLocaleString()}.` : ''}</p> : null}
      {errorMessage ? <p className="text_error rounded-md border border-white/15 p-4 text-sm text-white" role="alert">{errorMessage}</p> : null}
    </form>
  );
}
