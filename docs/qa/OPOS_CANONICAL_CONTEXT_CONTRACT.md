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
8. **Known QA blocker:** a secure watermarked, view-only browser Client Review Package has not been implemented. No unprotected PDF distribution or claims that a client has reviewed the work.
9. Client review acceptance requires genuine attributable evidence for the current cycle. Normally one included in-scope correction; additional scope is a separately priced/approved variation. An old-cycle acceptance does not cover a revised R02.
10. Verified full client settlement and a separate OP owner final release are required before native/editable file handover.
11. Partner payable requires partner completion, OP QA, final client review and actual final client receipt; all financial and technical liabilities must reconcile before closure.

## Current QA case and release boundary

Northfield QA: OP-PRJ-2026-0002 / b447f586-bf79-4839-be5e-1af607d9ca43. Last verified: internal_review, R01 and one actual private PDF, with no engineering acceptance, manifest verification or release authorisation. Refresh database before claiming this status remains unchanged.

**Branch:** design/opos-decision-first-ia. **QA Supabase:** ukcamenuxhdznxaxpyis. No changes or promotion to production are authorised by these QA implementations.

## QA acceptance

Run behavioural canonical context, three-portal presentation, engineering gating, Work Order and full build tests. Exercise real separate QA Client/Operator/Partner accounts; verify same event changes each actor's read state, deny cross-company access, and reject payment/approval/revision bypasses. The walkthrough is explanatory until authenticated E2E on standard, correction and variation scenarios passes. Never certify full client review before protected viewer exists.

Commands: npm run qa-canonical-context:check; npm run qa-three-portal-next:check; npm run qa-engineering:check; npm run qa-unified-portal:check; npm run build.
