# OPOS Navigation Product Contract

**Status: ACTIVE — subordinate to [OPOS Operator Experience Contract](OPOS_OPERATOR_EXPERIENCE_CONTRACT.md).**
The old Home / Operate / Control / Reference rail and Home / Enquiries / Cases / Projects / Finance mobile five-tab system are **retired**. Do not restore them from past implementations, tests or archived screenshots.

## Current destinations
| Destination | Desktop | Mobile | Operator job |
| --- | --- | --- | --- |
| Outreach | Primary, first | Primary, first | Cold LinkedIn conversation and follow-up **before CRM** |
| Home | Primary | Primary | Current priority; one next action |
| Opportunities | Primary | Primary | Enquiries and Cases in one read-only worklist |
| Projects | Primary | Primary | Authoritative Project 360 delivery |
| Finance | Primary | Via More | Payments and settlement register |
| Documents | Primary | Via More | Controlled document register |
| My Work | Supporting | Via More or Home | Filter existing canonical attention queue |
| More | Supporting | Primary | Partners, company/contacts, management, approvals, tasks, settings and other specialist tools |

`lib/presentation/navigationContract.ts` owns current labels, href, placement, operator job, truth source and interaction pattern. Desktop sidebar, mobile navigation and Command Palette must reflect its vocabulary. Specialist registers may remain available through More and contextual records but must not automatically become primary.

## Domain and route boundaries
- Outreach uses independent organisation-scoped threads/messages. Explicitly confirmed interest **and operator conversion** are required before CRM creation. No shadow LinkedIn Prospects.
- Enquiry owns qualification and partner feasibility. Case 360 owns technical/commercial basis, quote and pre-project release. Project 360 owns delivery after contractual/payment release. No navigation merge changes source-of-truth tables, RLS, approvals or payment gates.
- Payments are the receivable/payable register. Project Commercial Control is a separate governed authority surface.
- Messages are correspondence, Notifications are delivery health, Issues are exceptions, Approvals are decisions, and Activity/Audit is trace. Do not invent a parallel queue or business status merely for navigation.
- Compatibility and technical routes can stay for bookmarks and direct links but may not create competing front doors.
- A route may be **primary**, **contextual**, or **utility** without implying new workflow ownership.

## Before approving an IA change
Confirm each page has one operator job; correct source of truth; no duplicate UI workflow; reachable desktop and mobile route; no cold-Outreach CRM pollution; Case/Project relationships and old deep links preserved; search names agree; no implementation terms in main UI. Require regression checks and signed-in narrow-screen verification on the exact preview commit.
