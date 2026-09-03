# Overflow Partner — Product Architecture

This document is the canonical workspace information architecture and UI composition contract for the commercial SaaS product. The route inventory is broader than permanent navigation: routes exist for primary work, contextual work, utilities, compatibility and governed external experiences.

## Product model

Overflow Partner is organised around four operating levels:

1. **Portfolio** — triage work across many records.
2. **Record** — make decisions on one Enquiry, Case or Project.
3. **Specialist control** — documents, payments, commercial control, delivery, actions and assurance.
4. **Management / utility** — executive signals, search, notification delivery and administration.

A page must not duplicate a specialist module inside an Overview. Overview surfaces show only the summary and next action, then link to the owning specialist or record surface.

## Navigation placement

Every workspace destination is classified in `lib/presentation/navigationContract.ts` as:

- **Primary** — persistent operating destination.
- **Contextual** — reached from the record/lifecycle that owns it.
- **Utility** — supporting search, delivery-health or administration access.

The desktop rail intentionally exposes fewer destinations than the complete route map.

### Permanent desktop rail

**Home**
- Mission Control
- Approvals

**Operate**
- Enquiries
- Cases
- Projects

**Control**
- Client quotes
- Payments
- Commercial control
- Issues
- Actions

**Reference**
- Documents
- Execution Partners
- Executive view
- Risk & compliance
- Knowledge

**System**
- Settings

Search is provided through the command palette. Notifications are a top-bar utility. Partner Assessments and Messages are contextual/quick-access surfaces rather than competing permanent workflows.

## Canonical workspace route map

### Home
- `/workspace` — Mission Control
- `/workspace/approvals` — authority decision queue

### Operate
- `/workspace/acquisition/prospects` — Enquiry register
- `/workspace/acquisition` — Acquisition overview
- `/workspace/acquisition/intake` — internal Technical Intake register
- `/workspace/acquisition/[id]` — Enquiry operating record
- `/workspace/assessments` — contextual Acquisition Partner Assessment queue
- `/workspace/leads` — Case register (technical route remains `leads`; UI language is **Case**)
- `/workspace/leads/[id]` — Case 360
- `/workspace/projects` — Project portfolio
- `/workspace/projects/[id]` — Project 360
- `/workspace/projects/[id]/delivery` — Project Delivery Control
- `/workspace/projects/[id]/execution` — Project Execution Partner control

### Commercial / control
- `/workspace/quotes` — controlled client quote register
- `/workspace/payments` — receivables, payables and cash movement
- `/workspace/commercial-control` — financial authorisation and commercial ledger control
- `/workspace/commercial-control/invoices/[id]` — controlled invoice detail
- `/workspace/partners` — Execution Partner network
- `/workspace/exceptions` — operational exception register
- `/workspace/tasks` — cross-record action queue

### Evidence / reference
- `/workspace/documents` — controlled document registry
- `/workspace/documents/[documentId]` — controlled document detail / authorisation evidence
- `/workspace/documents/templates/[document]` — controlled document template/viewer/review
- `/workspace/communications` — contextual cross-record correspondence register
- `/workspace/communications/[entityType]/[entityId]` — Case or Project message timeline
- `/workspace/intelligence` — management / executive view
- `/workspace/risk` — Risk & compliance
- `/workspace/knowledge` — governed knowledge

### Utility / administration
- `/workspace/search` — full workspace search surface; the command palette is the normal fast entry
- `/workspace/notifications` — automated-message delivery health
- `/workspace/settings` — workspace administration
- `/workspace/settings/developer-data` — developer-only test cleanup where permitted
- `/workspace/companies` — master company register
- `/workspace/companies/[companyId]` — company relationship context
- `/workspace/contacts` — master contact register
- `/workspace/users` — organisation membership and roles
- `/workspace/activity` — cross-workspace audit register

### Internal product-governance surface
- `/workspace/opds` — Overflow Partner Engineering Design System reference. This is not a day-to-day operator navigation destination.

### Compatibility routes retained intentionally
These URLs remain so old bookmarks do not fail, but they do not create parallel operating surfaces:
- `/workspace/commercial-reviews` → canonical Case `commercial-review` queue
- `/workspace/partner-quotes` → canonical Case `partner-pricing` queue
- `/workspace/orchestration` → canonical Cases register

## Ownership boundaries

- **Enquiry** owns qualification, Technical Intake collection and pre-Case Partner Assessment.
- **Case 360** owns technical/commercial governance before delivery commitment.
- **Client Quote** is a controlled offer; quote history does not become a parallel Case workflow.
- **Project 360** owns delivery and closeout only after written acceptance and confirmed opening payment.
- **Documents** are workflow evidence; the Documents route is a controlled registry only.
- **Messages** are correspondence; they do not contain activity/audit events.
- **Issues** are genuinely off-plan work requiring intervention.
- **Notifications** are delivery-engine health only: queued, sent, failed or cancelled automated messages.
- **Commercial control** owns project financial authorisation; it is not a lifecycle stage.
- **Pipeline Orchestration** is implementation logic, not a user workflow.

## Adjacent public and API routes

### Secure external experiences
- `/intake/[token]` — customer technical intake
- `/partner-review/[token]` — Execution Partner review
- `/execution/[token]` — controlled Execution Partner delivery experience
- `/invoice/[token]` — externally accessible controlled invoice view
- `/login` — workspace authentication

### APIs
- `/api/intake`
- `/api/intake/[token]`
- `/api/intake/[token]/files`
- `/api/partner-review/[token]`
- `/api/execution/[token]`
- `/api/execution/[token]/files`
- `/api/notifications/process`
- `/api/workspace/search`
- `/api/workspace/lifecycle-context`

### Public website / policy routes
- `/`
- `/privacy`
- `/terms`
- `/cookie-policy`
- `/robots.txt`
- `/sitemap.xml`

## Canonical record composition

Every operating record follows this order:

1. **Record header** — customer, title, reference, owner, due date, current state.
2. **Lifecycle strip** — where the record sits, visually secondary to the decision.
3. **Decision** — readiness and next permitted action from one canonical state model.
4. **Current work** — only work relevant to the current stage.
5. **Controlled evidence** — summary of required evidence; detailed registry/control belongs in Documents.
6. **More context** — history, metadata and audit collapsed by default.

No record may show a Ready state while a server-enforced transition gate is blocked.

## Register composition

Portfolio/register pages use one learned pattern:

- Product page header
- 3–4 compact operating metrics
- Filter/search bar
- Dense register
- Pagination when required
- Empty state with one useful next action

At 20–100+ records the register is the primary scanning surface. Individual 360 pages are opened when action or evidence review is required.

## Semantic product states

All modules map domain statuses into the same visual semantics:

- `neutral` — informational / historical
- `active` — currently in work
- `waiting` — waiting on a person or external event
- `attention` — needs intervention soon
- `blocked` — cannot progress
- `critical` — immediate intervention
- `complete` — controlled requirement satisfied

Domain status remains visible in text; semantic state controls visual emphasis.

## Mutation behaviour

A successful mutation must:

1. show an in-progress control state;
2. save through the canonical server action;
3. return explicit success or error feedback;
4. reconcile current Server Component data;
5. preserve record context, filters and intended focus;
6. never require a manual browser refresh to make adjacent surfaces agree.

## Desktop behaviour

Desktop favours scan density:

- fixed navigation rail;
- 1200–1320px operating canvas;
- compact controls;
- dense registers and sticky table headers;
- limited card usage;
- record context appears only while a record is being operated.

## Mobile behaviour

Mobile is not stacked desktop:

- sticky compact product header;
- five persistent destinations: **Home, Enquiries, Cases, Projects, Finance**;
- Finance opens Payments;
- 44px touch targets;
- portfolio tables become cards rather than horizontally compressed columns;
- metrics collapse responsively;
- lifecycle strips scroll horizontally;
- secondary context stays collapsed;
- actions remain near the decision they affect.

## Terminology contract

Preferred product language:

- **Enquiry / Prospect** before qualification.
- **Case** after qualification and before Project ownership.
- **Project** after accepted commercial work and confirmed opening payment becomes delivery-owned.
- **Partner Assessment** for Execution Partner feasibility/capacity/price review.
- **Commercial control** for authorisation and project financial controls.
- **Payments** for receivables, payables and cash movement.
- **Issues** for operational exceptions.
- **Notifications** for automated-message delivery health.
- **Mission Control** for the home operating brief.

Technical database and route names such as `leads` may remain for compatibility but must not leak into operator-facing language.

## Visual contract

The UI should feel like a premium engineering operating system:

- off-black / charcoal operating canvas;
- high-contrast neutral typography;
- restrained orange accent;
- no generic SaaS gradients, glass cards or decorative shadows;
- no people imagery;
- cards only where the object is genuinely independent;
- whitespace, dividers and typography carry hierarchy;
- compact status pills are semantic, not decorative;
- important exceptions are visible; normal work stays quiet.

## Productisation rule

New feature work must use the shared `ProductUI` primitives and the final commercial SaaS stylesheet before introducing a page-specific visual system. New routes do not earn permanent navigation by existing; placement must be justified in the navigation contract.