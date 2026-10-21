# OPOS Voice-approved lifecycle — implementation & release matrix

**Owner-approved business decisions, 21 October 2026.** This document distinguishes *implemented code* from *database-proven, deployed behavior*. Do not mark a stage complete solely because a component or email template exists.

## Commercial business contract

1. **Acquisition split**: inbound website enquiry gets `enquiry.received` acknowledgement. Optional five-message nurture after affirmative checkbox opt-in, stops on response/opt-out; Step 2 only after interest. LinkedIn contacts are researched/captured manually; initial outreach is a LinkedIn message, **no unsolicited email**; interested reply opens secure Step 2.
2. **Convergence**: Step 2 submitted → customer email `requirements.received` → automatic approved NDA partner review via secure `/partner-review/[token]`; OPOS retains client contact, pricing and commercial ownership. All missing-information loops explicitly show who is waiting.
3. **Feasibility / review**: partner evaluates technical feasibility, files, risk, hours, cost, software, lead times. Go/No-Go approval is internal and only then creates Case 360.
4. **Commercial offer**: default **33% gross margin**, operator editable per case; 14-day quote validity; controlled non-editable quotation PDF attached to the `quote.issued` email and available through a persistent secure client portal.
5. **Commitment**: named authorised client acceptance immediately exposes a payment route. Standard terms **30% opening payment** with **70% on approved client final review, before editable final file handover**. Bank or Stripe only. No Project 360 without **verified** opening payment.
6. **Mobilisation**: after verified contractual payment, create Project 360 once; automatically issue partner work order with already controlled approved SOW (no redundant new scope document), awaiting partner acknowledgement. Milestones control execution.
7. **Quality**: execution team prepares deliverables; supervising engineer at execution partner personally checks and records technical review (partner-led QC, not independent QA). OPOS owner provides explicit **manual release to client review**, or returns package to partner for correction.
8. **Client review**: seven working days; one consolidated in-scope correction round. Unfixed technical errors attributable to partner do not count against client. Revision to approved design and out-of-scope change go to separately quoted and approved change request. Partner technical QC and OP owner review are repeated after corrections.
9. **Final payment + release**: after client review resolved, verify final 70%; OPOS owner must explicitly approve final editable engineering package release, no automatic handover.
10. **Partner settlement**: once customer final funds verified and final package released, OPOS owner approves partner payable and records *actual* bank payment reference/date; approval alone is not evidence of paid status.
11. **Closure**: all files issued, client and partner payments reconciled, document register complete; project marked ready, and OPOS owner manually closes.

## Stage-by-stage system integration

| Stage | Owner / next action | Trigger / state | Email / PDF or portal | Evidence and release status |
|---|---|---|---|---|
| Website enquiry | OPOS acquisition / wait for interest | Public `/api/intake`: prospect capture, acknowledgment, optional nurture | `enquiry.received`, five `enquiry.nurture.*` templates | **Coded in PR #104**; isolated notification E2E outstanding |
| LinkedIn acquisition | Business development / LinkedIn message & log reply | Manual Prospect source=linkedin, `replied/interested` gate | No cold email; user-triggered `requirements.requested` link | **Coded**; partner-consent and active test pending |
| Secure Step 2 | Customer, then OPOS | `intake_sessions`: invited/opened/submitted | `requirements.received` acknowledgement; controlled file upload | **Coded**; no live test or external mail sent |
| Partner feasibility | Execution partner | `partner_review_requests` invited/opened/in_progress/submitted | `partner_review.requested`, secure Partner Portal & intake files | **Coded automatic referral with fallback**, branch migration for concurrent duplicates **not applied** |
| Clarification | OPOS owns customer communication | Needs info → waiting for client → reassessment | `partner_review.clarification` exists, customer request and state mapping need further wiring | **Partial** |
| Go/No-Go & Case 360 | OPOS owner | Approved partner feasibility+price → Case created | Existing case templates, inherited partner review | **Existing governed RPCs**; new voice-specific regression not fully run |
| Quote & acceptance | OPOS / authorised client | Margin then quote generated, PDF approved, emailed; 14-day validity; portal reply | `quote.issued`; controlled quote PDF attachment; secure client portal | **33%/14 day/30% terms code staged**; quote-contract DB schema absent in live |
| Opening payment | Client; OPOS verifies | Accepted quote → payment due → verified opening amount | Existing quote payment page + Stripe Sandbox and bank instructions | **Partial**: Stripe currently full-amount test path; 30% provider reconciliation missing |
| Mobilisation & partner work order | OPOS → partner | Verified opening payment → one project → SOW, partner acknowledgement | `partner_work.released`, partner execution portal | **Existing gated workflow**, no 30% advance release E2E |
| Execution & QC | Partner engineer then OPOS | Milestone updates, partner delivery review, OPOS manual client-review release | Controlled technical review + handover package | **Existing workflow + manual stages**, evidence-check regression pending |
| Client review/variations | Client → OPOS → partner | 7 workdays, one included consolidated correction, partner defects reworked, paid changes separately approved | `client_delivery.review_outcome`, `project_change_requests` | **Coded classification and separate variations**; DB-atomicity and portal E2E pending |
| Final settlement/release | OPOS owner | Full balance received + client approval + manual OP release → final file issue | Final handover package and invoice | **Policy model only for new manual hold**, full DB gate pending |
| Partner pay & closure | OPOS owner | Final delivered + client paid + invoice + payment reference; manual close | `partner_payment.sent`, `project.completed`, completion PDF | **Existing records/RPCs + policy model**, new end-to-end reconciliation pending |

## UX operating principle

All internal and external screens must answer **current state, responsible owner, next action, and blocker**. Primary action visible; secondary information behind progressive disclosure. Mission Control = exceptions / work queue, Opportunity = acquisition, Case 360 = technical/commercial decisions, Project 360 = delivery to closure, Partner Portal = scoped assigned technical work, Client Portal = secure persistent commercial and review relationship. Keep audit IDs/history available but not in primary work surface.

**CSS baseline (verified)**: 13 repository CSS files, 10 workspace files. More important than raw file count: overlapping selector definitions, old/new prefixes, inconsistent button scale, and mobile navigation. Target shared typography, spacing, forms, action bar, and accessible responsive breakpoints. Do not blindly delete CSS or remove working components.

## Critical client review file-safety correction

The original `recordClientTransmittalAction` previously generated long-lived signed download URLs to **all uploaded partner deliverables** and included them in the first client-review email, exposing editable engineering files before final payment. This violates the approved contract. On the feature branch it now sends only the controlled PDF review pack and **no partner source-file download URLs**. The new regression verifies this prohibition. The final editable handover remains **blocked** until a separate verified-final-payment + named OPOS manual-release action is implemented and tested; do not mislabel the review email as final delivery.

## Release blockers — not complete

- **P0** OPOS DB has no live `quote_release_contracts` table; pending contractual release migrations must be fixed/validated and deployed in controlled order.
- **P0** Stripe staged opening payment / final balance, bank reconciliation, and verified-before-project insert need integrated implementation and QA.
- **P0** Auto partner referral needs the staged unique-index migration deployed after duplicate check; test sender/token/portal against isolated backend. Shared Preview is not isolated from live Supabase.
- **P0 security** `public.quote_payment_provider_events` RLS is disabled on live database. Do not auto-toggle without auditing consumers/policies; obtain approval and verified permissions.
- **P1** Formal client clarification loop, independent senior-engineer QC record proof, final manual release lock, partner-payment reference, manual closure regression.
- **P1** Persist and atomically enforce exactly one included correction round; current app-level classification and event history require migration-backed transaction guarantees.
- **P1** CSS selector/screen inventory, desktop/mobile browser audit, UI consolidation, accessibility and performance.
- **P1** Full two-source E2E including negative, retry, concurrent, data-integrity, outbox and document/PDF checks.

**Release decision:** feature branch only; no production migration, customer email, bank transaction or live Stripe payment. PR #104 stays unmerged until these release gates are closed. Never claim this document is proof of live DB completeness.
