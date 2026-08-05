import { requireUserContext } from '@/lib/auth/context';
import { submitTechnicalPartnerReviewFormAction, qualifyAfterTechnicalReviewFormAction } from '@/app/workspace/acquisition/review-actions';

const input = 'border border-black/15 bg-white px-3 py-2 text-black';

type Props = {
  prospectId: string;
  intakeSessionId: string;
  prospectStatus: string;
};

function value(value: unknown) {
  return value === null || value === undefined || value === '' ? 'Not specified' : String(value);
}

export default async function TechnicalPartnerReviewPanel({ prospectId, intakeSessionId, prospectStatus }: Props) {
  const { supabase, organisationId } = await requireUserContext();
  const [{ data: partners }, { data: review }] = await Promise.all([
    supabase.from('partners').select('id,company_name,services,rating').eq('organisation_id', organisationId).eq('status', 'approved').eq('nda_signed', true).order('company_name'),
    supabase.from('prospect_technical_reviews').select('*, partner:partners(company_name)').eq('organisation_id', organisationId).eq('prospect_id', prospectId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const approved = review?.status === 'approved' && ['feasible', 'feasible_with_clarification'].includes(review.decision);

  return <section className="acquisition-technical-review" style={{ marginTop: 20, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
    <p className="eyebrow">Engineering gate</p>
    <h3>Technical partner review</h3>

    {review ? <div style={{ marginTop: 14, display: 'grid', gap: 16, border: '1px solid var(--line)', background: 'var(--paper)', padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div><p className="eyebrow">Review partner</p><strong>{review.partner?.company_name || 'Partner not available'}</strong></div>
        <span>{review.status.replaceAll('_', ' ')}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
        <div><p className="eyebrow">Decision</p><p>{review.decision.replaceAll('_', ' ')}</p></div>
        <div><p className="eyebrow">Confidence</p><p>{review.confidence_percent}%</p></div>
        <div><p className="eyebrow">Estimated hours</p><p>{value(review.estimated_hours)}</p></div>
        <div><p className="eyebrow">Lead time</p><p>{review.estimated_lead_time_days ? `${review.estimated_lead_time_days} days` : 'Not specified'}</p></div>
        <div><p className="eyebrow">Pricing ready</p><p>{review.pricing_ready ? 'Yes' : 'No'}</p></div>
      </div>
      {review.missing_information ? <div><p className="eyebrow">Missing information</p><p style={{ whiteSpace: 'pre-wrap' }}>{review.missing_information}</p></div> : null}
      {review.technical_risks ? <div><p className="eyebrow">Technical risks</p><p style={{ whiteSpace: 'pre-wrap' }}>{review.technical_risks}</p></div> : null}
      {review.assumptions ? <div><p className="eyebrow">Assumptions</p><p style={{ whiteSpace: 'pre-wrap' }}>{review.assumptions}</p></div> : null}
      {review.review_notes ? <div><p className="eyebrow">Review notes</p><p style={{ whiteSpace: 'pre-wrap' }}>{review.review_notes}</p></div> : null}
    </div> : partners?.length ? <form action={submitTechnicalPartnerReviewFormAction} className="card stack" style={{ width: '100%', marginTop: 14 }}>
      <input type="hidden" name="prospect_id" value={prospectId} />
      <input type="hidden" name="intake_session_id" value={intakeSessionId} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">Approved technical partner<select className={input} name="partner_id" required defaultValue=""><option value="" disabled>Select partner</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.company_name}{partner.rating !== null ? ` · ${partner.rating}/5` : ''}</option>)}</select></label>
        <label className="field">Technical decision<select className={input} name="decision" required defaultValue="feasible"><option value="feasible">Feasible</option><option value="feasible_with_clarification">Feasible with clarification</option><option value="not_feasible">Not feasible</option></select></label>
        <label className="field">Confidence %<input className={input} name="confidence_percent" type="number" min="0" max="100" defaultValue="80" required /></label>
        <label className="field">Estimated engineering hours<input className={input} name="estimated_hours" type="number" min="0" step="0.5" /></label>
        <label className="field">Estimated lead time, days<input className={input} name="estimated_lead_time_days" type="number" min="0" /></label>
        <label className="field">Pricing readiness<select className={input} name="pricing_ready" defaultValue="false"><option value="false">Not pricing ready</option><option value="true">Pricing ready</option></select></label>
      </div>
      <label className="field">Missing information<textarea className={input} name="missing_information" rows={3} /></label>
      <label className="field">Technical risks<textarea className={input} name="technical_risks" rows={3} /></label>
      <label className="field">Assumptions<textarea className={input} name="assumptions" rows={3} /></label>
      <label className="field">Review notes<textarea className={input} name="review_notes" rows={3} /></label>
      <button className="button secondary" type="submit">Record technical partner review</button>
    </form> : <div className="card" style={{ marginTop: 14, width: '100%' }}><h3>No compliant technical partner available</h3><p>Add an approved partner with a signed NDA before completing this engineering gate.</p></div>}

    {approved && prospectStatus !== 'qualified' && prospectStatus !== 'converted' ? <div style={{ marginTop: 18, borderLeft: '2px solid var(--accent)', paddingLeft: 16 }}>
      <p className="eyebrow">Commercial gate</p>
      <h3>Technical feasibility approved</h3>
      <p>The prospect can now be commercially qualified. This remains a separate audited decision.</p>
      <form action={qualifyAfterTechnicalReviewFormAction}>
        <input type="hidden" name="prospect_id" value={prospectId} />
        <button className="button" type="submit">Approve commercial qualification</button>
      </form>
    </div> : null}
  </section>;
}
