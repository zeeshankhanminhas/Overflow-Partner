# OPOS UI/UX release audit — 9 November 2026

**Decision: NO-GO.** This is an additional release gate on top of the Northfield workflow and production-promotion audit. Frozen QA source is commit `ba70d2124118326d80cd0a7e88b790c2309bc32e`, preserved independently. Do not merge the frozen QA branch or alter live UI in this documentation PR.

## Audit scope
Source inspection and Northfield user-supplied screenshots; **not** a new instrumented browser, screen-reader or WCAG audit. Includes operator Workspace 2.0, authenticated Client/Partner workspaces, secure transaction redirects, finance and documents. Conforms to `docs/design/OPOS_NORTH_STAR_PRODUCT_EXPERIENCE.md`, `docs/design/OPOS_IA_CONTRACT_V1.md` and `docs/ux/OPOS_ALL_PORTAL_SIMPLIFICATION_2026-11-04.md`.

## Critical findings

| ID | Priority | Verified source/observation | Launch acceptance |
| --- | --- | --- | --- |
| UX-01 | P0 | `app/opos-next/projects/[id]/page.tsx` (575 lines) uses `operatorProjectNextStep`, `displayNext`, `nextWithHandover` and another `governedHref` chain; `WorkRecordV2` links whenever waiting is false | One server-authoritative action projection from actual role + evidence; every visible CTA targets an available permitted action |
| UX-02 | P0 | Project 360 plus distinct Work Order, settlement, Handover Pack, partner settlement, closeout evidence, Finance, Documents and client-review pages repeat summary and return navigation | Project 360 remains stable workspace, with contextual Work & Partner, Engineering QA & Delivery, Commercial & Settlement, Activity & Evidence panels |
| UX-03 | P0 | `app/portal/[kind]/projects/[projectId]/open/route.ts` redirects authenticated clients to token `/client-portal`, `/project-final-payment`, `/client-final-files` while `app/client-portal/page.tsx` re-computes its own next step | Full quotation/payment/review/final handover inside authenticated Client Workspace; Stripe returns to the same project |
| UX-04 | P0 | The same `open/route.ts` redirects a partner assignment to `/execution/[token]` | One assignment workspace: accept Work Order, commence, update, submit, correct and view settlement, preserving commercial data isolation |
| UX-05 | P0 | Prior Northfield action feedback reported “Action blocked” after final release approval was saved; separate state cards repeat payment and release information | Saved decision, email queued/sent/delivered/failed, accessed/downloaded and payment reconciled all shown as separate evidenced events |
| UX-06 | P0 | Handover and stage pages expose disabled actions while readiness reasons may be collapsed; a primary link sometimes opens a page without an enabled form | Every blocked step shows reason, responsible party, valid resolution deep link and no misleading action CTA |
| UX-07 | P1 | Shared `OperatorRegister` is a basic table/list with no built-in filter/search/sort, Finance includes a separate Northfield QA block | Search/filter by owner/state and direct route from register to governing task; no QA simulation presented as real cash |
| UX-08 | P1 | Small 10–12px labels and metadata, long project descriptions, multiple nested disclosures and a separately scrollable 224px sidebar | Approve concise hierarchy and consistent type/spacing; show next decision immediately, evidence on demand |
| UX-09 | P1 | Mobile shell and focus rules exist but have no full device/keyboard evidence. Visible “Skip to content” may simply mean it was focused, not itself a defect | 360/390/768/1024/1440px and 200% zoom; keyboard navigation, menu focus, error summaries, contrast and touch targets tested |
| UX-10 | P0 | Hardcoded Northfield header, £1,200 QA-SIM simulation and historical £644.78 reconciliation are embedded in project-related routes | All real routes reusable for multiple customers; QA-only routes/test IDs never promoted into production |

## Launch-ready screen responsibilities

**Mission Control:** one priority decision, a short next queue, waiting on others, real exceptions only.

**Project 360:** concise verified position + one role-appropriate current action or waiting/blocked state + small lifecycle strip + last saved event; below it only four contextual views: **Work & Partner / Engineering QA & Delivery / Commercial & Settlement / Activity & Evidence**. Never display multiple competing primary CTAs.

**Client Workspace:** an authenticated project/quotation home continuously handles acceptance, verified advance, project updates, controlled drawing review, final payment and authorised file access. Stripe checkout is an external transaction, not a new portal identity.

**Partner Workspace:** the same secure assignment view handles Work Order, commencement, progress, revised submissions and settlement visibility without exposing customer totals/margin.

**Finance and Documents:** cross-project supporting registers, with direct context back to the owning project and its decision/event timeline.

## Mandatory UI state contract

Use one authoritative server-derived `CurrentAction` structure: `{key,title,owner,state,reason,evidence,target,canExecute,fallback,completionEvent}`. Display **actionable**, **waiting**, **blocked**, **failed**, **completed** and **unknown** distinctly. Neither a reachable URL nor a positive stage alone proves an action can execute. Server-side contractual and permission gates remain mandatory; UI simplification must never remove independent approvals.

## Acceptance tests before UI GO

1. Opportunity → accepted quotation → verified advance → Project 360 in one consistent user journey.
2. Independent Partner Work Order acceptance and start, genuine file upload, QA review and corrective revision without leaving an unrelated shell.
3. Client review, accepted final drawings, Stripe return, verified payment and final download remain in the authenticated Client Workspace; unauthorized and early downloads fail.
4. Partner payable and closeout evidence appear in one project context; QA-SIM is never presented as real funds.
5. For all gates, tests cover actionable, waiting, blocked, failed, saved-but-not-notified, expired/unauthorized, duplicate and closed states. No dead-end CTA.
6. Repeat end-to-end with a **different** fictional company, different values and native deliverables.
7. Screenshots reviewed at 360/390/768/1024/1440px, 200% zoom, keyboard-only and screen-reader labels/errors.
8. Exact role data exposure and document/payment approval boundaries remain enforced.

## Implementation instruction

Do **not** build another separate UI on top of current screens. First consolidate the decision/action projection, then refactor Project 360 and role portals as coherent workspaces, then remove redundant routes only when deep-link/role parity tests pass. Work from current `main` and selectively port frozen QA improvements. Keep existing public marketing changes, particularly the withdrawal of unverified CAD demos.

**The Northfield business journey passed; its UI acceptance did not.** This workstream is a production-release blocker, not visual polish.
