# Workspace 2.0 — isolated QA readiness (2026-11-01)

This is an engineering test checklist, **not** a declaration that all tests have passed. Target branch: `design/opos-decision-first-ia`. Test against isolated `ukcamenuxhdznxaxpyis` only; never use production or real funds.

## Preflight

- [ ] Latest Vercel preview build reports READY with the latest commit SHA; confirm typecheck, build and lint logs.
- [ ] Sign in to `/opos-next`; sidebar and mobile navigation stay in Workspace 2.0.
- [ ] Verify roles: owner/admin/operator may see authorised QA actions; unauthorised users cannot mutate records.
- [ ] Confirm QA backend project ref and Preview URL match; all fixture and transactional gates are isolated.
- [ ] Verify no unexpected `/workspace/*` or `/outreach/*` navigation from the Workspace 2.0 primary routes.

## Mission Control and Accounts

- [ ] Mission Control renders live priorities and waiting records with correct next actions.
- [ ] Click an account-review priority: `/opos-next/accounts/:id`, not a legacy company page.
- [ ] Accounts register opens related Case and Opportunity 360 records.
- [ ] For a fictional `QA - ` account only, schedule a new review date; confirm database change and audit event. Ensure non-QA records cannot be rescheduled by the QA form.

## Outreach

- [ ] Create a fictional LinkedIn conversation from `/opos-next/outreach`; confirm no CRM record or email is created.
- [ ] Save a LinkedIn note, confirm chronology and modern redirect.
- [ ] Set waiting/follow-up; verify due dates and Mission Control context.
- [ ] Confirm interest; ensure CRM is still empty until explicit conversion.
- [ ] Convert to CRM and verify redirect to `/opos-next/opportunities/:id`; repeat to verify duplicate safety.
- [ ] Verify closed/converted conversations do not show active edit controls.

## Opportunity / Case 360

- [ ] Create a fictional QA Opportunity; submit secure requirements via approved test inbox only.
- [ ] Check queued/sent/failed notifications without treating provider acceptance as inbox delivery.
- [ ] Select an approved partner with NDA evidence; send PTA only when authority and technical intake permit.
- [ ] Record partner response, decision rationale, and quote; convert to Case 360 without duplication.
- [ ] Verify controlled documents and commercial approvals.
- [ ] Existing Northfield case: accepted quotation revision 1; agreed opening amount **£644.78**. Register and Case 360 must both show acceptance/release pending, not a generic stale queue action.
- [ ] Resend quote only when current revision is issued and client has not responded.

## Client payment and project creation

- [ ] Client portal shows `Continue to payment` only for an accepted quote with an agreed opening payment and enabled QA payment page.
- [ ] Payment page displays the contractual opening amount, not the full quote by default.
- [ ] Stripe test-only controls must not create live payments; bank instructions must be suppressed unless verified settlement is enabled.
- [ ] Merely visiting Checkout, abandoning it, or submitting an unverified bank reference must **not** create Project 360.
- [ ] Verify advance via authorised sandbox payment evidence; Project 360 may be created only after the actual verified release gate.
- [ ] Verify duplicate webhook/payment handling does not create duplicate projects or Work Orders.

## Project, Partner, QA and delivery

- [ ] Projects register and Project 360 stay in `/opos-next`.
- [ ] Mobilisation form saves manager/dates with correct audit, permission and readiness checks.
- [ ] Stage transitions reject missing financial, document, partner and QA evidence.
- [ ] Approved Work Order is issued only at the agreed gate; Execution Partner must accept before execution.
- [ ] Partner progress and submitted deliverables are recorded; technical QA and correction decisions are evidenced.
- [ ] Client Review Package remains view-only; verify that direct native/download links are not available before final payment and owner release.
- [ ] Client review acceptance, final payment verification, final release, partner settlement and closure are individually gated.

## Documents, finance, external portals, layout

- [ ] Documents and Finance register links remain in Workspace 2.0 and show real records.
- [ ] External client/partner links require valid scoped tokens and reject expired, altered and cross-tenant tokens.
- [ ] Emails use controlled templates, correct recipient, revision, attachments and idempotency keys.
- [ ] Check mobile (375px), tablet (768px), desktop (1440px), keyboard navigation, button contrast and no horizontal overflow.
- [ ] No visible dead buttons or links to missing routes; locked actions explain the gate rather than implying success.

## Known unverified / blockers at preparation time

- QA database contains 1 Prospect, 1 Case, 1 Partner, 3 Documents, **0 Projects**, **1 fictional Outreach conversation** (seeded for UI QA), **0 Invoices**. This means the full post-payment project path cannot be exercised until authorised test payment evidence is available.
- Client portal and payment UI were code-inspected, not end-to-end browser-tested in an authenticated customer session.
- Project 360 now exposes guarded native forms for mobilisation, standard stage transitions, evidenced client outcome, final owner release and closure. These are **not functionally verified** because QA contains no released project; partner execution/Work Order acceptance and payout remain to be exercised and may require further native UI work.
- **Release blocker:** the existing client review transmittal emails an attached PDF, which conflicts with the agreed secure watermarked **view-only, no-download** Client Review Package. QA preview now blocks that legacy action; implement and verify a secure browser review viewer before end-to-end client delivery can pass.
- Vercel builds and runtime checks must be re-verified against the final commit before calling the workspace test-ready.

## Afternoon implementation and evidence (same isolated QA branch)

- Project 360 now reads organisation-scoped Work Order / execution assignment, partner session, technical submission, delivery-item QA and client transmittal evidence in a native read-only panel. No partner acceptance or technical approval is inferred from the existence of a session. This panel has **not** been functionally tested on a released project because QA still has zero projects.
- Mission Control's shared dashboard model now recognises an actual `quote_issue_records.client_response = accepted` for the current quotation revision. It shows release/payment verification as the next dependency instead of the stale `Record client decision` instruction. This is code-implemented; authenticated UI testing is still required.
- Opening-payment UI and Stripe server action now fail closed if payment/release queries fail or a Project already exists for the quotation. The client portal offers `Continue to payment` only when an actual authorised payment channel is ready; otherwise it explains the agreed amount and the missing payment arrangements.
- Document review can now be opened from a Workspace 2.0 document record, with canonical template alias redirects, a modern register back button and a modern `Open document registry` link from Case 360. These fixes need authenticated navigation testing.
- Verified the QA database directly: one accepted Northfield quote `OP-Q-2026-0001-R01`, total £2,149.25, contractual opening amount £644.78, **zero opening-payment confirmations, zero release confirmations, zero Projects**, one Outreach conversation, three controlled documents and zero invoices.
- **Additional Stripe sandbox blocker:** Northfield is labelled `QA - Northfield Demonstration Engineering`, whereas the existing sandbox Checkout server action intentionally allows only cases whose lead company begins `OP QA TEST`. Northfield also has **zero** active `op_sandbox_payment_authorisations` records. Do not weaken the guard or create payment evidence. Use a separately approved, explicitly labelled sandbox case and real test-only Checkout credentials to exercise the project creation gate.
- Unauthenticated preview route smoke tests confirmed that `/opos-next` renders the protected sign-in, an invalid client portal token displays access unavailable, and an invalid payment token is rejected. This does not constitute authenticated E2E QA.
- **Still blocked:** secure watermarked view-only technical Client Review Package, real partner Work Order acceptance and execution, post-payment project stage transitions, final settlement/payout and customer-native final handover. The old downloadable client review PDF remains blocked in the isolated preview.

The latest commit must be independently confirmed Vercel READY with its exact SHA before this pass can be called build-verified. Do not mark the above authenticated or post-payment checks as passed without a real test.
