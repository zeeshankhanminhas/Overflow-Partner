# OPOS vNext — Visual Parity Ledger
**Status: IN PROGRESS — not locked, not release-approved.**
**Source:** OPOS Visual Review v2 HTML and approved desktop/mobile screenshots, not legacy `/workspace` layouts.

## Acceptance is screen-specific
| Area | New route | Prototype structural parity | Backend parity | Desktop / 390px screenshot verified | Release eligible |
|---|---|---|---|---|---|
| Mobile/desktop shell | /opos-next | Source-derived header / palette / navigation | Existing Supabase auth | No | No |
| Mission Control | /opos-next | Source-derived decision panel and visible Up next / Waiting sections | Canonical attention + approval priority; some links to governed records | No | No |
| Opportunity Detail | /opos-next/opportunities/[id] | Source-derived three-stage journey, current position and evidence | Tenant-scoped real intake; provider delivery unverified | No | No |
| Opportunities Register | /opos-next/opportunities | Partial; current mobile cards differ from approved mobile table | Real scoped prospects / search | No | No |
| Case 360 | /opos-next/cases/[id] | Source-derived decision, stage and evidence structure | Stage from case queue; complete technical/commercial evidence not integrated | No | No |
| Project 360 | /opos-next/projects/[id] | Source-derived decision, stage and evidence structure | Stage from projects; full work order, QA, payment evidence not integrated | No | No |
| Outreach conversation | /opos-next/outreach/[id] | Generic presentation; **not v2 parity** | Source records only; governed actions in /outreach | No | No |
| Client Portal | /client-portal | Not migrated; **not v2 parity** | Existing secure experience | No | No |
| Execution Partner Portal | Existing protected route(s) | Not migrated; **not v2 parity** | Existing governed work-order system | No | No |
| Finance, Partners, Documents | /opos-next/* | Generic registers/records; **not v2 parity** | Read-only real data, governed actions elsewhere | No | No |

## Mandatory review for each screen
- Compare implemented screen to the **actual v2 reference**, not a description of it.
- Render and inspect at **1440px desktop and 390px mobile**; test long names, waiting/blocked/empty states and overflow.
- Compare navigation, typography, colour, width, panel composition, hierarchy, spacing and tap targets.
- Verify no legacy `/workspace` shell appears inadvertently; governed legacy actions must be explicitly labelled until migrated.
- Verify all data, permissions, status and primary actions are grounded in authoritative system facts.
- Verify the interaction end-to-end. A successful build or a CSS-contract check is **not** proof of visual parity.
- Do not merge until reviewed and approved.

## Observed discrepancy to resolve
On October 29 the operator opened a mobile page displaying a **white legacy Workspace home**, red CTA and old bottom navigation. The new design lived separately under `/opos-next`. This branch adds preview-specific sign-in and home redirects to the vNext shell. Production continues to use legacy pages. Authentication redirect, back-button routing and all cross-record links require real mobile testing.

## Release rule
No page may be described as **finished** before both visual fidelity and workflow correctness are verified. No OS-wide completion claim until all eight reference archetypes and both portal experiences pass.
