-- Staged for an isolated QA database first. Do NOT apply to the shared production
-- OPOS database until existing active review records have been checked for conflicts.
--
-- The original active-partner unique index is keyed to lead_id; prospect_id is NULL
-- in that index, so concurrent automatic pre-case referrals could create duplicates.
-- Preserve all existing records; do not delete/reconcile automatically.
create unique index if not exists ux_op_one_active_review_per_prospect
  on public.partner_review_requests (organisation_id, prospect_id)
  where prospect_id is not null
    and status in ('draft','invited','opened','in_progress','submitted',
                   'clarification_required','approved','approved_with_conditions');

comment on index public.ux_op_one_active_review_per_prospect is
  'Idempotent single-active pre-case partner assessment per organisation/prospect; protects automatic Step 2 referral from concurrent requests.';
