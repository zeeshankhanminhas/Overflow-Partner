# OPOS production promotion gate — 9 November 2026

**Decision: NO-GO for direct promotion.** This document is a release workstream, not approval to deploy. Do not merge the frozen QA branch, enable live payments, copy QA data to production, or run QA-specific SQL against production.

## Frozen evidence and verified outcome

- Code reference: `ba70d2124118326d80cd0a7e88b790c2309bc32e`, preserved on `freeze/northfield-e2e-2026-11-09`.
- Successful preview: [frozen QA deployment](https://overflow-partner-hiuh97ww8-zeeshankhanminhas-projects.vercel.app).
- Northfield end-to-end sandbox scenario reached **Closed** using the existing governed project transition.
- Quote, deposit and final invoice reconciled in test mode; client portal handover access was exercised; controlled Handover Pack, invoice evidence and Completion Report were issued; partner settlement was **explicitly synthetic**.
- This validates one QA happy path, not a real-money, production-ready or native-manufacturing deliverables workflow.

## Why a direct merge is prohibited

The frozen QA branch diverges from `main`: **743 commits ahead, 7 behind, 247 changed files** at audit time. The newer `main` marketing changes include deliberately withdrawing unverified engineering demonstrations. They must not be overwritten.

The QA branch contains hardcoded Northfield case IDs and values, restricted payment simulations, branch-scoped features and historical billing reconciliation exceptions. Some QA-only database changes were made interactively or recorded under `scripts/qa/sql` rather than introduced through a production-safe migration pipeline.

## Consolidated pre-release gates

| ID | Gate | Required proof | Release priority |
| --- | --- | --- | --- |
| G01 | Selective integration | Main-based release candidate; audited per-file diff; no wholesale QA merge; preserve main marketing corrections | Blocker |
| G02 | Clean database migrations | Rebuild a fresh disposable database using reviewed, portable migrations; verify RLS/roles/tenant boundaries and deterministic lifecycle | Blocker |
| G03 | Reusable payments and reconciliation | A real client deposit/final-invoice ledger, signed and idempotent Stripe webhooks, no duplicate charges, real partner bank-evidence flow separate from QA simulation | Blocker |
| G04 | Controlled document life cycle | Generic report, invoice, technical register and handover revision workflow with protected files and owner approval; no hardcoded Northfield paths | Blocker |
| G05 | Native deliverables | Accepted PDF **and** native CAD test files with permission-scoped download, watermark/preview controls, revision matching and revoked-access tests | Blocker |
| G06 | Notifications | Authorised test-inbox send, queue, delivery/retry/failure recovery and client portal self-service, never counting queued as delivered | Blocker |
| G07 | Security and secrets | Review privileged functions, least privilege, anonymous access, account recovery, token expiry, RLS, public repo secrets and env-target isolation | Blocker |
| G08 | Repeatability | At least two separate synthetic organisations/projects through new-project E2E; automated negative-case tests, CI checks on release branch and PR, no manual DB corrections | Blocker |
| G09 | Production config / rollback | Validate production env matrix without printing secrets; stage a production-equivalent build, prove rollback and audit logging, obtain explicit owner go-live approval | Blocker |
| G10 | Commercial and legal | Counsel-reviewed client/partner agreements, IP/licensing, VAT invoices, international transfers, operating policies, incident/support playbook | Before external onboarding |
| G11 | Release UX and observability | Operator, client and partner single-next-action flow; mobile and accessibility checks; alerting, restore test and support ownership | **Blocker before any commercial portal launch** |
| G12 | UX experience parity | Pass `docs/release/OPOS_UI_UX_AUDIT_2026-11-09.md`: single authoritative CTA, uninterrupted operator/client/partner journey, route cleanup, clear failed/blocked/saved states and responsive role-by-role acceptance | **Blocker** |

## Implementation policy

1. Keep the frozen QA commit and existing closed Northfield record unchanged. Treat the snapshot branch as read-only by convention; repository rules must be configured separately if immutable protection is required.
2. Build the reusable release candidate **from current `main`**, never by replacing `main` with the QA branch. Review every cherry-picked or manually ported change.
3. Strictly quarantine `lib/qa/northfield*`, QA-only settlement/closeout pages, synthetic bank methods, historical one-project invoice exceptions and preview-only service keys. Production must not depend on these.
4. Replace case-specific repairs with generic, actor-scoped workflows and coherent typed result models for the whole `Opportunity -> Closure` lifecycle.
5. Use synthetic data only in a fresh sandbox for integration tests. Preserve real payment and production data isolation.
6. Do not send real client/partner email, create live payment requests or release native documents until the production gate is explicitly approved.
7. Repeat full E2E with a **second** synthetic project after every database migration/release-candidate change.

## Decision record

- Frozen source: complete and exact-commit verified.
- Test-case evidence: recorded; one happy-path completed.
- Production code integration: **not performed**.
- Production schema changes: **none**.
- Production launch authorisation: **withheld**.

Update gate IDs with linked tests, migration diff, review and acceptance evidence. A release is GO only when all blockers have independently passed on the main-based candidate and an owner explicitly authorises promotion.
