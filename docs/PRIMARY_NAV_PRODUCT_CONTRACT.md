# Workspace Navigation Product Contract

Status: Normative

Implementation reference: `lib/presentation/navigationContract.ts`.

## Rule

A route can be a valid product surface without deserving permanent primary navigation.

Every workspace destination is assigned one placement:

- **Primary** — a persistent operating destination used to choose or control work across records.
- **Contextual** — reached from the record or lifecycle context that owns the work; it must not create a parallel workflow.
- **Utility** — search, delivery-health or administration access that supports work but is not itself a business lifecycle destination.

Every destination must still have:

1. **One operator job** — a user can explain why they opened the page in one sentence.
2. **One conceptual source of truth** — the page may use an aggregate/read model, but cannot merge unrelated concepts merely because the data is available.
3. **One interaction pattern** — register, decision queue, intervention queue, control workspace, library, search or another clearly named pattern.

Navigation labels, hrefs, placement and contracts are encoded in `lib/presentation/navigationContract.ts`. A new permanent navigation item must be added there first and must justify `placement: 'primary'`.

## Operating hierarchy

The permanent desktop rail is intentionally smaller than the route inventory:

### Home
- Mission Control
- Approvals

### Operate
- Enquiries
- Cases
- Projects

### Control
- Client quotes
- Payments
- Commercial control
- Issues
- Actions

### Reference
- Documents
- Execution Partners
- Executive view
- Risk & compliance
- Knowledge

### System
- Settings

Search is provided through the workspace command palette. Notification delivery health belongs in the top bar. Contextual Messages and Partner Assessments remain reachable from their owning workflow and quick access, but are not promoted into parallel permanent navigation.

## Context ownership

- **Enquiry** owns qualification and Acquisition Partner Assessment work.
- **Case 360** owns pre-project technical and commercial governance.
- **Project 360** owns accepted delivery and closeout.
- **Messages** are correspondence attached to the owning record or cross-record correspondence register.
- **Documents** are used inside workflow context; the Documents destination is a controlled registry, not a second workflow.
- **Payments / Commercial control** may preserve Project context but do not become Project lifecycle stages.
- **Pipeline Orchestration** is internal implementation logic only. `/workspace/orchestration` remains a compatibility redirect to Cases and is never an operator workflow.

## Boundary rules

- **Messages are correspondence.** They may display governed business messages from the business-message view of `notification_outbox`. They must not display `activity_events` as messages.
- **Notifications are delivery health.** They monitor queued/sent/failed/cancelled automated-message delivery. They must not become an operational exception queue.
- **Issues are exceptions.** They contain genuinely off-plan work requiring intervention. They must not contain normal Partner/client waiting states or notification-delivery diagnostics.
- **Activity / History & Audit are governance trace.** Workflow events, stage changes and raw event evidence belong there, not in Messages.
- **Partner Assessments are Acquisition-owned.** They contain Execution Partner feasibility/capacity/price assessment only. Case technical definition remains in Case 360.
- **Approvals are authority decisions.** They aggregate authoritative decision records without creating a second approval workflow.

## Surface matrix

| Surface | Placement | Operator job | Conceptual source of truth | Interaction pattern |
| --- | --- | --- | --- | --- |
| Mission Control | Primary | Choose the next intervention | Operating-position presentation aggregate | Prioritised operating brief |
| Approvals | Primary | Make authority decisions | Canonical approval queue | Decision queue |
| Enquiries | Primary | Qualify opportunities | Governed Acquisition state | Register → Enquiry |
| Cases | Primary | Control pre-project basis | Case 360 governed state | Queue → Case 360 |
| Partner Assessments | Contextual | Assess Execution Partner feasibility/capacity/price | Acquisition Partner Assessment state | Assessment queue → Enquiry |
| Projects | Primary | Operate accepted delivery | Project 360 operating state | Portfolio → Project 360 |
| Client quotes | Primary | Inspect controlled quotations | Controlled quote state | Quote register |
| Payments | Primary | Track settlement | Financial settlement view | Financial register |
| Commercial control | Primary | Control project financial position | Project commercial-control aggregate | Financial control workspace |
| Execution Partners | Primary | Maintain Partner master records | Controlled Partner master | Partner register |
| Issues | Primary | Resolve off-plan work | Operational exception model | Intervention queue |
| Actions | Primary | Complete internal work items | Task model | Action register |
| Documents | Primary | Control publications | Document registry/lifecycle | Registry → review |
| Messages | Contextual | Review business correspondence | Business-message view | Message register/timeline |
| Executive view | Primary | Review management performance | Executive snapshot | Management summary |
| Risk & compliance | Primary | Review assurance posture | Risk/compliance view | Assurance register/summary |
| Knowledge | Primary | Access reference knowledge | Knowledge library | Searchable library |
| Search | Utility | Find a known record | Workspace search layer | Search → direct navigation |
| Notifications | Utility | Monitor delivery health | Notification delivery-state view | Delivery monitor |
| Settings | Utility | Configure workspace administration | Workspace configuration model | Configuration forms |

## Mobile contract

Mobile keeps only five persistent destinations:

1. Home
2. Enquiries
3. Cases
4. Projects
5. Finance

Finance opens Payments. Approvals remain available from Mission Control/navigation context rather than consuming one of the five mobile primary slots.

## Compatibility routes

Old URLs may remain only as redirects so bookmarks do not fail. They may not become parallel operating surfaces:

- `/workspace/orchestration` → Cases
- `/workspace/partner-quotes` → Case partner-pricing view
- `/workspace/commercial-reviews` → Case commercial-review view

## Acceptance test

Before merge, inspect every destination affected by a navigation change and answer:

- What single job does this page perform?
- Which record or business domain owns it?
- Is it primary, contextual or utility?
- Does another destination already own the same workflow?
- Does the route preserve Case/Project context where relevant?
- Does the page expose implementation terminology or raw event/database payloads in the normal operator path?
- On mobile, is it important enough to displace one of the canonical five destinations?

If the answers are ambiguous, the surface must be demoted, reconciled or split before it is promoted into permanent navigation.

## Change control

Any PR that adds a permanent workspace destination or materially changes the job/model/pattern/placement of an existing destination must update both:

- `lib/presentation/navigationContract.ts`
- this document

A route is not automatically entitled to primary navigation placement.