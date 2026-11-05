# OPOS — Binding Execution and QA Rules

**Status:** Active execution contract for contributors and AI agents.
**Scope:** Overflow Partner's full business lifecycle, all Operator, Customer and Execution Partner experiences, and the QA-to-launch process.
**Purpose:** Finish the governed product and prove it works. Do not restart or redesign it in response to a local defect.

## 0. Authority and precedence

Read and follow the existing normative documents before changing code:
- `docs/BUSINESS_LIFECYCLE_CONSTITUTION.md` — authoritative lifecycle and ownership gates.
- `docs/OPOS_COMMERCIAL_LIFECYCLE_CONTRACT.md` — commercial conditions.
- `docs/OPOS_LIFECYCLE_REGRESSION_MATRIX.md` — 37-case minimum regression suite.
- `docs/WORKSPACE_PRODUCT_CONTRACTS.md`, `docs/UI_LANGUAGE_CONSTITUTION.md`, and `docs/GLOBAL_STATE_PRESENTATION_CONSTITUTION.md` — established interaction/presentation rules.

This file governs **execution discipline and acceptance evidence**, not a replacement business lifecycle. When requirements conflict, stop and flag the exact contradiction rather than inventing a new workflow or weakening a gate.

## 1. Non-negotiable priorities

1. **Complete integrated end-to-end QA first.** Until the full role-authenticated lifecycle is evidenced, do not initiate dashboard redesigns, new prototype work, parallel architecture, unrelated features or migration projects.
2. **One business lifecycle, three separate secure experiences.** Operator, Customer and Execution Partner share a workflow engine and design system, **not** one unrestricted data page or account. Each role sees only its own authorized records and actions.
3. **Simple interaction, full governance.** The user should see their current position, any blocker, and at most one visually prominent next action. Put registers and evidence behind progressive disclosure; never remove mandatory technical, commercial or approval records.
4. **No legacy fallbacks.** A repaired action must remain in the intended Workspace 2.0 path. Do not route users to an obsolete page merely to make a button work.
5. **Do not treat a green build, unit test, mock, SQL fixture, CSS screenshot or unauthenticated page load as end-to-end proof.** Label those as component, contract or isolated integration evidence only.
6. **Treat every defect as a journey defect.** Trace the source event, role identity, authorization, server/API action, database transition, document/email/payment evidence, recipient's next step and UI return route before declaring it fixed.
7. **No isolated patch acceptance.** A fix passes only after the failing path and its upstream/downstream dependency paths are retested at the *same exact commit*.
8. **Never fabricate business evidence.** No simulated bank reconciliation masquerading as cleared funds; no fake client acceptance; no self-approval on behalf of an external actor; no asserting emails were delivered when only an in-app record was created.
9. **No QA shortcuts in production.** QA-only forms, seeded credentials, impersonation controls, temporary buttons, fixture-write flags and mock providers must not appear or function in production.
10. **No production changes without explicit promotion approval.** Apply development changes only to `design/opos-decision-first-ia` with QA Supabase project `ukcamenuxhdznxaxpyis`; production Supabase and Vercel deployments are out of bounds unless separately authorized. No unrelated migrations.
11. **Respect external identity.** Customer and partner decisions require independently authenticated, authorized test identities with organization/project scope. Operator credentials must never stand in for their consent.
12. **Security is enforced on the server and in PostgreSQL/RLS/RPC policies, not merely hidden in the UI.** Test cross-account isolation and direct API calls as well as visible controls.
13. **Prefer minimal targeted changes.** Preserve existing product surfaces, business rules and documents; change the smallest complete chain that resolves the failing journey. New UI surfaces need explicit evidence that existing canonical surfaces cannot support the work.
14. **Report only verifiable facts.** State what passed, what failed, what is blocked and what is not tested, with evidence pointers and a single highest-priority next step. Never invent a completion percentage or call a pending stage complete.

## 2. Role and information boundary

| Principal | Allowed | Never exposed |
| --- | --- | --- |
| OP Operator (within authorized staff role) | OP-owned opportunities, commercial decision and risk records; assigned clients and partners; stage gates; finance and audit per staff permissions | Unrelated organizations or staff privileges beyond assigned rights |
| Customer | Only its authorized enquiries, requirements, exact quote/terms, acceptance/payment steps, own project milestones, controlled view-only review and post-payment handover | OP internal workflows, other clients, partner prices/agreements, OP margins, other partners' work, secret/admin data |
| Execution Partner | Only assigned vendor-safe scope, technical assessment, its own quote, Work Orders, permitted files, submissions, revisions and its own settlement | Customer commercial terms and price, OP margin, other partners, OP internal approvals, unrelated clients |

Never offer a production role-switcher that displays another principal's private data. A synthetic demonstration may switch *fictional* roles, but must be identified as non-production and cannot be used as QA authorization evidence.

## 3. Immutable business gates

- Intake and confidentiality controls before sensitive client information is shared; verified partner sharing authority/NDA before sending partner-safe requirements.
- Inherited approved feasibility and pricing before commercial quotation; use one governed technical assessment, not duplicate steps.
- Approved controlled quotation and terms, identified authorized signatory, and exact quote-revision acceptance before opening payment can release a project.
- **No Project 360 or mobilisation before independently verified opening payment**, except an explicitly governed/authorized contractual credit or purchase-order exception under the existing lifecycle.
- No issued Work Order without the governed project prerequisites; partner must accept before authorised mobilisation/execution.
- No engineering delivery to a customer before OP internal QA, document manifest/control and explicit release authorization.
- Client Review Package is protected and view-only; no downloadable/native final deliverables by default. No assumption that browser previews prevent all screen capture.
- A client's acceptance, correction or variation must be an attributable client decision, revision-bound and separately reconciled. One included correction is governed; changes in scope require separate commercial authorization.
- Final handover/native download **requires client approval and independently verified final payment**. No partner payout until partner completion, OP QA, client final review and client final payment are confirmed under the current settlement rules.
- No closure with unresolved invoices, payables, corrections or audit requirements.
- Every event must retain responsible identity, scope, correct revision and stage, timestamp and durable evidence; retries must be idempotent.

## 4. End-to-end acceptance sequence — not optional

Use one controlled fictional QA opportunity, quote, project, customer and execution partner, plus negative/unauthorized test actors. Execute and evidence the whole chain:

1. Public discovery/intake → registered opportunity → secure requirements and confidentiality decision.
2. Vendor-safe Partner Technical Assessment → independent partner response → OP feasibility decision.
3. Approved commercial basis → controlled quote issue → correct client recipient/identity/terms.
4. Exact revision accepted by authorized client → test-mode payment/independently verified mock bank evidence → one correctly gated Project 360.
5. Governed Work Order issued and accepted by authorized partner → mobilisation/execution.
6. Partner file delivery and revision → OP engineering review → document verification → authorized controlled client-review release.
7. Independent authenticated Customer sees *only its* protected R01 package, reviews and records an attributable decision → OP reconciliation.
8. Test an approved correction/revision branch **and** an out-of-scope variation branch, including invalid/mismatched revision rejection.
9. Final approved client review → verified final settlement → correct view/download permissions at final handover.
10. Partner settlement eligibility, payment evidence and formal closure.

For **each** step capture: environment + git SHA; actor and role; case/project and revision IDs; expected action; actual page/API result; relevant authoritative database records; protected document/notification evidence where applicable; negative access or gate checks; pass/fail; blocker; retest result.

Also run the existing `docs/OPOS_LIFECYCLE_REGRESSION_MATRIX.md` minimum 37 cases, and specifically test cancelled/failed/duplicate Stripe events, pending bank transfers, cross-client reads, cross-partner reads, wrong roles, superseded quotes, unauthorized client release, unpaid final download, and premature partner payout.

## 5. Evidence-based readiness

The only valid status values are:
- **PASS** — exercised at the target QA commit with complete evidence and correct downstream state.
- **FAIL** — actual observed incorrect outcome, with reproducible steps and ownership.
- **BLOCKED** — precondition/authorization/access missing; explicitly state the missing dependency.
- **NOT TESTED** — no trustworthy execution evidence.
- **ISOLATED PASS** — automated/mock/local fixture passed, but does not satisfy the live role-authenticated QA step.

A green CI/deployment is a prerequisite, never launch sign-off. Promotion is blocked until all critical paths are PASS, privacy and payment negative cases PASS, no critical failures remain, QA-only facilities are production-inaccessible, and the owner explicitly authorizes promotion.

## 6. Working method and user communication

For each active blocker: **inspect → reproduce → trace complete journey → fix on QA branch → verify at new commit → run affected + full governance regression → mark evidence**. Do not claim a write, fix, deployment, email or external action until the connected tool has confirmed it. Do not silently modify real commercial/financial records just to advance the QA scenario. Ask for a human step only when real authorization, actor consent, external email access or manual technical inspection genuinely requires it; state precisely why.

User updates are brief and business-focused:
`VERIFIED: ... | BLOCKED/FAILED: ... | NOT YET PROVEN: ... | NEXT: ...`

No generic progress percentages, no celebratory claims about partial gates, no repetitive design proposals, and no expectation that the user should test an unverified collection of links.

**Current known QA checkpoint (historical; re-check before acting):** Northfield sample R01 had internal review/document control/release authorization records; protected client issue, independent authenticated customer decision, verified final settlement, handover and partner payout had not been evidenced. Do not infer their current status without querying the QA source of truth.
