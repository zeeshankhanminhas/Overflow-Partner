# Primary Navigation Product Contract

Status: Normative

## Rule

Anything promoted into primary workspace navigation is a product surface, not a utility shortcut.

Every primary navigation destination MUST have:

1. **One operator job** — a user can explain why they opened the page in one sentence.
2. **One conceptual source of truth** — the page may use an aggregate/read model, but it cannot merge unrelated domain concepts merely because the data is available.
3. **One interaction pattern** — register, decision queue, intervention queue, control workspace, library, search, or another clearly named pattern. A page must not switch jobs halfway down the screen.

Primary navigation labels, hrefs and contracts are encoded in `lib/presentation/navigationContract.ts` and consumed by the workspace sidebar/topbar. New primary navigation entries MUST be added there first.

## Boundary rules

- **Messages are correspondence.** They may display governed business messages from the business-message view of `notification_outbox`. They MUST NOT display `activity_events` as messages.
- **Notifications are delivery health.** They monitor queued/sent/failed/cancelled automated message delivery. They MUST NOT become an operational exception queue.
- **Issues are exceptions.** They contain genuinely off-plan work requiring intervention. They MUST NOT contain normal Partner/client waiting states or notification delivery diagnostics.
- **Activity / History & Audit are governance trace.** Workflow events, stage changes and raw event evidence belong here, not in Messages.
- **Partner Assessments are Acquisition-owned.** The primary Partner Assessments surface contains Execution Partner feasibility/capacity/price assessment only. Case technical definition remains in Cases.
- **Approvals are authority decisions.** They aggregate authoritative decision records without creating a second approval workflow.

## Primary surface matrix

| Surface | Operator job | Conceptual source of truth | Interaction pattern |
| --- | --- | --- | --- |
| Mission Control | Choose the next intervention | Operating-position presentation aggregate | Prioritised operating brief |
| Approvals | Make authority decisions | Canonical approval queue | Decision queue |
| Enquiries | Qualify opportunities | Governed Acquisition state | Operating register → Enquiry |
| Cases | Control pre-project basis | Case 360 governed state | Case queue → Case 360 |
| Partner Assessments | Assess Execution Partner feasibility/capacity/price | Acquisition Partner Assessment state | Assessment queue → Enquiry |
| Projects | Operate accepted delivery | Project 360 operating state | Portfolio → Project 360 |
| Client quotes | Inspect controlled quotations | Controlled quote state | Quote register |
| Payments | Track settlement | Financial settlement view | Financial ledger |
| Commercial control | Control project financial position | Project commercial-control aggregate | Project financial control workspace |
| Execution Partners | Maintain Partner master records | Controlled Partner master | Partner register |
| Issues | Resolve off-plan work | Operational exception model | Intervention queue |
| Actions | Complete internal work items | Task model | Action register |
| Documents | Control publications | Document registry/lifecycle | Document registry → review |
| Messages | Review business correspondence | Business-message view of notification outbox | Message register/timeline |
| Executive view | Review management performance | Executive snapshot | Management summary |
| Risk & compliance | Review assurance posture | Risk/compliance assurance view | Assurance register/summary |
| Knowledge | Access reference knowledge | Knowledge library | Searchable library |
| Search | Find a known record | Workspace search layer | Search → direct navigation |
| Notifications | Monitor delivery health | Notification delivery-state view | Filtered delivery monitor |
| Settings | Configure workspace administration | Workspace configuration model | Configuration forms |

## Acceptance test for every primary destination

Before merge, open or inspect every primary navigation destination and answer:

- What single job does this page perform?
- What authoritative model/read model explains every major element on the page?
- What is the page's interaction pattern?
- Is any unrelated model being displayed just because it is convenient?
- Does the page expose raw JSON/database/event payloads in the normal operator path?
- Does another primary destination already own this information?

If the answers are ambiguous, the surface fails the contract and must be split, demoted from primary navigation, or reconciled before merge.

## Change control

Any PR that adds a primary navigation destination or materially changes the job/model/pattern of an existing destination MUST update both:

- `lib/presentation/navigationContract.ts`
- this document

A new route is not automatically entitled to primary navigation placement.
