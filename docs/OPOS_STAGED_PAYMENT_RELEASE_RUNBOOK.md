# OPOS payment-to-project and final-file-release QA runbook

**Status: code staged on PR #104; no Supabase migration applied; no real payment or customer email triggered.** Never use Preview as QA while it shares the OPOS production database `klricctsxiifuduxpmzd`.

## 1. Trusted environment
- Provide a separate Supabase QA project/branch, with a distinct project ref and database URL. A Supabase branch may incur additional cost: obtain operator approval before creating it.
- Vercel Preview must have `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` scoped to **that isolated backend**, and `OP_QA_SUPABASE_PROJECT_REF` exactly matching its hostname. `lib/qa/isolation.ts` refuses the known production ref, missing refs and host mismatches. No QA env has been created yet.
- Set `OP_ISOLATED_QA_BACKEND=true` only after verifying the above. Incomplete configuration fails closed.
- Test-only flags (after migrations and sandbox data): `OP_CONTRACTUAL_RELEASE_ENABLED=true`, `OP_PACKAGE01_PAYMENTS_ENABLED=true`, `OP_STRIPE_DEPOSIT_TEST_ENABLED=true`, `OP_STRIPE_FINAL_TEST_ENABLED=true`, `OP_PACKAGE01_AUTO_RELEASE_ENABLED=true`, `OP_VOICE_FINAL_RELEASE_ENABLED=true`.
- Use **Stripe sk_test_** secret, a valid test-mode webhook signing secret, and `OP QA TEST`-prefixed QA customer/case records with a time-limited `op_sandbox_payment_authorisations` row for the exact quotation revision. Do not enable live Stripe keys or production webhook endpoints.
- Do not enable `OP_BANK_SETTLEMENT_VERIFICATION_ENABLED` before an independently verified bank reconciliation implementation is available. The code currently has no production-ready bank settlement feed.

## 2. Migration sequence — isolated DB only, validate SQL and live grants first
1. Existing pending `20261019023000_quote_contractual_release_gates.sql` — quote-level immutable release terms + named signer + project-creation trigger; repaired malformed dollar quote and deposit gate.
2. Existing pending `20261019030000_project_financial_release_handoff.sql` — inherits opening payment to Project 360 finance readiness.
3. `20261021042900_single_active_pre_case_partner_referral.sql` — unique active pre-case Partner Review per prospect.
4. `20261021054100_verified_deposit_stripe_release.sql` — atomic, idempotent verified opening 30% settlement → exactly one Project 360. This intentionally replaces the older full-amount sandbox finalizer definition.
5. `20261021060000_final_payment_and_owner_release.sql` — separate 70% cleared Stripe evidence, explicit authenticated owner release pinned to a QC-accepted immutable submission, partner payment bank reference and manual-closure guards.
6. `20261021070000_payment_provider_event_rls.sql` — defense-in-depth RLS with service-role access only; validate any legacy routines first.

These staged files are not proof that SQL has been parsed, applied, or that all dependent triggers cooperate. Do not apply to shared production without a transaction-level isolated QA suite.

## 3. Positive end-to-end test

1. Website enquiry or interested LinkedIn reply -> secure Step 2 -> customer receipt and exactly one approved NDA partner review (with no client identity leak).
2. Partner feasibility priced -> OPOS Go/No-Go -> Case 360 -> 33% gross margin (49.2537% markup) -> controlled noneditable PDF issued with 14-day validity.
3. Named authorised quote acceptance -> persistent secure Client Portal immediately shows the **30% deposit**, not 100%; test Stripe Checkout amount exactly equals `round(quote.total * .30,2)`.
4. A valid signed Stripe test webhook stores a unique event; the service finalizer creates **one Project 360 only after deposit evidence**. Retry the same webhook 3 times: still one payment confirmation and one project.
5. Mobilisation must retain approved scope and SOW. Partner work order cannot be released until the approved SOW exists, matching selected partner, verified financial authority and assignment. Existing project creation makes SOW **draft**; automatic work-order handoff is not yet implemented.
6. Partner milestone updates, senior-engineer QC, OPOS manual controlled review release -> client reviews PDF only, *no signed links to editable source files*.
7. Latest client outcome accepted -> final 70% Stripe test Checkout -> independently validated `op_project_final_settlements` row, **no automatic file release**.
8. Authenticated owner manually approves the exact accepted submission -> customer receives an idempotent transactional notice; the Client Portal mints short-lived signed URLs only for that approved submission.
9. Partner invoice approved; user records actual bank transfer reference, then manually closes project after evidence and finance gates. No automatic closure.

## 4. Negative and isolation checks

- Preview still pointed at production ref or mismatching `OP_QA_SUPABASE_PROJECT_REF` -> **all public intake writes, Stripe Checkout, webhooks, referral and file release fail closed**.
- Duplicate Stripe event/session, wrong amount/currency, wrong quote revision, missing signer claim, expired quote, non-QA customer or missing allowlist -> no project.
- No partner NDA, multiple partners, duplicate Step 2, invalid token, missing document -> no automatic technical leak or second review.
- Client requests out-of-scope change -> no included correction; exactly one consolidated in-scope round; partner defects still reworked. The round limit needs atomic DB migration E2E.
- Client source links requested before final verified payment OR before manual owner approval OR after a new unapproved partner revision -> no files.
- Partner-payment insert before final release or without payment reference -> reject.
- Closure without cleared partner payment or explicit owner final release -> reject.
- Send/fail/retry notification worker; verify outbox state and no duplicate client/partner emails.
- Test desktop/mobile navigation and CSS for Mission Control, Opportunity, Case 360, Project 360 and both external portals.

## 5. Current unresolved release blockers

- Isolated QA project and valid scoped environment are absent.
- Production-ready **bank-transfer clearing feed**, Stripe live credentials/verification policy, VAT/rounding and final-invoice accounting are unproven. Do not claim the 30/70 flows are live.
- Post-project automatic partner work-order release is not implemented: existing core creates a **draft** Statement of Work and governed release requires approval.
- One correction round and seven-business-day review enforcement need atomic DB-state and holiday-calendar integration.
- Full responsive browser UX/CSS consolidation and live E2E tests remain outstanding.
- The staged security RLS migration requires consumer verification; currently anon/authenticated have no direct SELECT/INSERT grant on legacy `quote_payment_provider_events`.

**Release decision:** keep PR #104 unmerged until an isolated transaction-level regression suite passes. No tests should send actual client/partner emails or use production funds.

## Additional staged migrations (after the ordered payment/release files)

7. `20261021080000_atomic_client_correction_gate.sql`: one included consolidated correction, separate partner defects, nonduplicated active variations.
8. `20261021081000_seven_workday_client_review.sql`: 2026–2028 England/Wales business calendar, `review_due_at` on transmittal and Project 360 window status.
9. `20261021082000_unique_partner_execution_session.sql`: one active Partner execution portal session per assignment. Verify legacy sessions for duplicates before application.

Only set `OP_AUTO_PARTNER_RELEASE_ENABLED=true` **after** the controlled SOW approval and end-to-end payment-to-work-order flow have been tested in isolated QA. Work order after SOW approval does not bypass milestone or financial gates.
