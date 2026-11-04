# OPOS canonical context contract — isolated QA

## Purpose

One business state, one accountable owner, one permitted next decision. The source of truth is the recorded project stage **and the independently verified evidence for its current assignment/cycle/submission/revision**. A project-stage label or a page redirect alone is never approval.

**Business lifecycle:** Opportunity → Requirements → Feasibility → Commercial Offer → Contractual Commitment → Mobilisation → Execution → Quality Assurance → Delivery → Payment Settlement → Closure.

**Project stages:** mobilisation → ready_for_execution → in_progress / partner_correction → internal_review → ready_for_client_issue → issued_to_client → client_review → completion → closed. The project-stage sequence does not replace the upstream pre-project lifecycle.

## Technical sources of truth

- Read-only decision reducer: lib/presentation/canonicalProjectDecision.ts.
- Shared three-portal instructions: lib/presentation/threePortalNextAction.ts.
- Operator: app/opos-next/projects/[id]/page.tsx.
- Permanent external account portals: app/portal/[kind]/page.tsx and app/portal/[kind]/projects/[projectId]/page.tsx.
- Secure Client quote/payment: app/client-portal/page.tsx.
- Secure Partner execution: components/execution/PartnerWorkSurface.tsx.
- Actual authorisation: existing membership RLS, authenticated server actions, SQL project-stage readiness, partner WO and QA RPCs, independent payment evidence.

The presentation reducer **cannot** create a project, accept an offer, sign a Work Order, mark cash received, authorise engineering, issue files, approve client review or pay a partner. It must fail closed on missing evidence. All three role-specific pages must agree on the decision owner even though confidential details differ.

## Three roles

**Client:** requirements and confidentiality permission → authorised quotation acceptance → opening payment → receives OP status → controlled view-only review decision → final balance → downloadable native files only after verified payment and owner release.

**OP Operator:** qualify → approve technical baseline → Partner Technical Assessment → commercial approval (default 33% gross-margin target) → controlled quotation (normally 14 days) → verify opening payment → issue partner WO → manage execution → engineering QA → separate file-manifest verification → owner-authorised preparation of client review → reconciliation → final owner release → partner settlement → closure.

**Execution Partner:** governed assessment → signed Execution Partner Agreement and WO acceptance → separate start declaration → technical progress/issues → upload and submit actual drawings → revise on written corrective instruction → paid only after contractual client settlement, OP QA and client acceptance conditions.

The client contract family is Master Services Agreement + Statement of Work; the partner contract family is Execution Partner Agreement + Work Orders. IP and confidentiality terms must be back-to-back, with legal review before commercial use.

## Non-bypassable state/evidence chain

1. Client quotation acceptance does not create the project. Opening payment is normally 30% (25% by exception); independent Stripe/bank evidence controls whether funds are verified.
2. Project creation and Partner Work Order issue require valid technical/commercial lineage and independently verified opening funds.
3. A partner's formal Work Order acceptance never counts as engineering commencement. The partner must independently declare inputs, capacity and planned start.
4. Partner file submission (R01/R02) is not technical acceptance. The current-cycle private files must exist.
5. OP engineering reviewer inspects real files and records an attributable decision tied to exact revision and file fingerprint.
6. Separate document-control reviewer verifies the same accepted file manifest. Old generic Technical Review and Document Register signing records are not approval for current engineering work.
7. Owner/admin authorises review-package **preparation**, not external issue.
8. **QA implementation, pending authenticated acceptance:** Current-cycle protected Client Portal review is available in isolated QA, with a verified OP issuer, exactly one active company membership, inline watermarked PDF and external client-authenticated decision. OP must separately reconcile that external decision. No email is sent automatically, no native files are unlocked, and nobody may claim the E2E has passed until three-account authentication and browser tests verify the entire path. Browser rendering cannot prevent determined extraction; no explicit client PDF download link is offered.
9. Client review acceptance requires genuine attributable evidence for the current cycle. Normally one included in-scope correction; additional scope is a separately priced/approved variation. An old-cycle acceptance does not cover a revised R02.
10. Verified full client settlement and a separate OP owner final release are required before native/editable file handover.
11. Partner payable requires partner completion, OP QA, final client review and actual final client receipt; all financial and technical liabilities must reconcile before closure.

## Current QA case and release boundary

Northfield QA: OP-PRJ-2026-0002 / b447f586-bf79-4839-be5e-1af607d9ca43. Last verified 4 Nov 2026: ready_for_client_issue, R01 accepted, manifest verified, owner preparation authorised, **zero actual client issue or client response records**. A genuine owner action is required for in-app issue; refresh the database before claiming this status remains unchanged.

**Branch:** design/opos-decision-first-ia. **QA Supabase:** ukcamenuxhdznxaxpyis. No changes or promotion to production are authorised by these QA implementations.

## QA acceptance

Run behavioural canonical context, three-portal presentation, engineering gating, Work Order and full build tests. Exercise real separate QA Client/Operator/Partner accounts; verify same event changes each actor's read state, deny cross-company access, and reject payment/approval/revision bypasses. The walkthrough is explanatory until authenticated E2E on standard, correction and variation scenarios passes. Protected viewer code and database gates exist in QA, but real cross-account browser and issue/review/reconciliation tests still need to pass. For correction requests, the signed client attestation is recorded but automatic partner correction remains blocked until classification and variation policy are implemented.

Commands: npm run qa-canonical-context:check; npm run qa-three-portal-next:check; npm run qa-protected-client-review:check; npm run qa-engineering:check; npm run qa-unified-portal:check; npm run build.

## Protected QA client review implementation (4 November 2026)

- Operator internal preparation preview: `/opos-next/projects/[id]/review-preview` (watermarked, staff-only).
- Owner/admin in-app issue: `op_qa_issue_protected_client_review`, creates a normal controlled transmittal and a separate immutable issue tied to the current manifest and recipient membership; no email is represented as sent.
- Authenticated client review: `/portal/client/projects/[projectId]/review`; secure PDF route validates current QA evidence and does not expose native files or signed storage URLs.
- Client's own outcome: `op_qa_record_client_review_decision` stores external identity on a dedicated evidence row, not under a fabricated OP profile.
- OP verification: `op_qa_reconcile_client_review_decision` reconciles accepted outcomes into the existing canonical record. Changes/rejections remain blocked pending explicit inclusion/partner-defect/variation classification.
- The currently implemented PDF browser surface does not offer a client download button, but screenshots and determined extraction are not technically preventable. This limitation must be acknowledged before external commercial launch.
- No production SQL, production deployment or live client funds have been touched. The sprint is not considered complete until authenticated end-to-end QA passes.
