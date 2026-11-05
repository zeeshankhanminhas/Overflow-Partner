# OPOS — Execution Rules

**Scope:** All OPOS development, QA and release work. **Current priority:** complete authenticated end-to-end QA; do not redesign the workspace or add unrelated features.

## 1. Source of truth — do not duplicate it

Follow these existing contracts rather than restating their business rules here:

- [Business Lifecycle Constitution](docs/BUSINESS_LIFECYCLE_CONSTITUTION.md) — stages, owners, evidence and transition gates.
- [Commercial Lifecycle Contract](docs/OPOS_COMMERCIAL_LIFECYCLE_CONTRACT.md) — quotation, contract and payment requirements.
- [Lifecycle Regression Matrix](docs/OPOS_LIFECYCLE_REGRESSION_MATRIX.md) — 37 minimum acceptance/negative cases.
- [Workspace Product Contracts](docs/WORKSPACE_PRODUCT_CONTRACTS.md), [UI Language](docs/UI_LANGUAGE_CONSTITUTION.md) and [Global State Presentation](docs/GLOBAL_STATE_PRESENTATION_CONSTITUTION.md) — canonical surfaces, interactions, copy and state.

This file adds *execution and proof* rules; it must not create a competing lifecycle. Report contradictions instead of bypassing either requirement.

## 2. Experience: simple, private, complete

- **One business system, three authorized experiences.** Operator, Customer and Execution Partner use a consistent design and the same authoritative lifecycle, but **never a common unrestricted information page or role-switching access**.
- **Operator:** only work and records permitted by their OP staff role. **Customer:** only its own requirements, quotations, payments, project reviews and handover. **Partner:** only its assigned technical packages, Work Orders, submissions, revisions and settlement. Never expose OP margin/internal decisions, customer pricing to partners, partner pricing to customers, or unrelated organizations' records.
- Enforce the boundary in server actions, APIs and PostgreSQL RLS/RPC permissions, **not** merely by hiding UI. Test cross-account reads and writes.
- At each stage show position, blocker (if any), and **one prominent next action**. Keep essential evidence discoverable, not duplicated on every screen.
- **Remove redundant UI:** repeated instructions, status panels, menus, actions and screens that perform the same job. Reuse existing canonical surfaces and preserve a single route of record; **no legacy fallback**. Never remove mandated evidence, governance controls or accessible access to history.

## 3. Work on the whole journey, not isolated buttons

1. **Inspect → reproduce → trace** role, source event, authorized action, server/API, database, document/payment/notification evidence, downstream recipient and return route.
2. **Fix the smallest complete chain** in `design/opos-decision-first-ia`, using QA Supabase `ukcamenuxhdznxaxpyis`. Avoid unrelated migrations and changes.
3. **Retest both directions** at the exact resulting commit: the failing path, upstream prerequisites, downstream next role, relevant negative/security cases, and the established regression suite.
4. **Never claim success from** a green build, static check, isolated SQL fixture, mock payment, screenshot or unauthenticated page. These are partial evidence only.

## 4. End-to-end acceptance

Prove the **full integrated journey with independently authenticated QA actors**:

1. Enquiry and secure intake → NDA-safe partner assessment → internal Go/No-Go.
2. Controlled quote and exact-revision authorized customer acceptance → **independently verified sandbox advance or explicitly authorized contractual credit exception** → exactly one Project 360.
3. Authorized Work Order and partner acceptance → partner R01 delivery → OP engineering QA, document control and release approval.
4. Protected **view-only** Client Review Package → independent authenticated customer decision → OP reconciliation; exercise correction and variation paths separately.
5. Approved final review → **verified final payment** → downloadable final handover → eligible partner settlement and closure.

In addition to the existing [37-case matrix](docs/OPOS_LIFECYCLE_REGRESSION_MATRIX.md), verify role isolation, invalid/superseded revisions, payment failure/retry/duplicate, pending bank transfers, unapproved client issue, unpaid download and early partner payout. No stage may bypass the authoritative database gates.

**Per-step evidence:** environment and commit; actor/role; organization, project and revision; expected vs actual UI/API/database result; document/payment/communication evidence where relevant; negative authorization result; test outcome and retest. No invented client decisions, releases, bank clearances, sent emails or financial records.

## 5. Safety and release

- QA-only controls, fictional identities, fixtures and mock services must be inaccessible in production.
- Never impersonate an external customer/partner or turn operator action into their consent.
- **No production changes or promotion without explicit approval** and a QA evidence review. Existing QA isolation must remain intact.
- Preserve confidential data boundaries, controlled-document revisions, idempotency, payments, authorization and auditable transitions.

## 6. Honest outcomes and updates

Use **PASS** (end-to-end verified), **FAIL** (reproducible), **BLOCKED** (state missing prerequisite), **NOT TESTED**, or **ISOLATED PASS** (mock/CI/component evidence only). Do not inflate partial tests into launch readiness.

Update the user only with: **VERIFIED | FAILED/BLOCKED | NOT YET PROVEN | NEXT ACTION**. No percentages without evidence, no repeat prototypes, no unnecessary requests for manual testing. Ask for human authorization only when genuinely needed.

**Release condition:** every critical integrated path, privacy/payment negative case and required lifecycle regression must pass; no critical blockers, no production QA bypass, and explicit owner approval. The latest live QA checkpoint must always be re-queried before acting.
