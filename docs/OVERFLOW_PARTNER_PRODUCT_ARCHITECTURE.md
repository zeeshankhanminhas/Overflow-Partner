# Overflow Partner — Product Architecture

This document is the canonical workspace information architecture and UI composition contract for the commercial SaaS product.

## Product model

Overflow Partner is organised around four operating levels:

1. **Portfolio** — triage work across many records.
2. **Record** — make decisions on one Prospect, Case or Project.
3. **Specialist control** — documents, payments, delivery, communications, tasks and assurance.
4. **Management** — exceptions, intelligence and cross-business search.

A page must not duplicate a specialist module inside an Overview. Overview surfaces show only the summary and the next action, then link to the specialist control surface.

## Canonical navigation and workspace route map

### Home
- `/workspace` — Mission Control

### Work
- `/workspace/acquisition/prospects` — Prospect register
- `/workspace/acquisition` — Acquisition overview
- `/workspace/acquisition/intake` — Internal technical-intake register
- `/workspace/acquisition/[id]` — Prospect operating record
- `/workspace/leads` — Case register (technical route remains `leads`; UI language is **Case**)
- `/workspace/leads/[id]` — Case 360
- `/workspace/assessments` — Assessment operating queue
- `/workspace/projects` — Project portfolio
- `/workspace/projects/[id]` — Project 360
- `/workspace/projects/[id]/delivery` — Project Delivery Control

### Commercial
- `/workspace/quotes` — Controlled client quote register
- `/workspace/payments` — Receivables, payables and cash movement
- `/workspace/commercial-control` — Financial authorisation and commercial ledger controls
- `/workspace/commercial-control/invoices/[id]` — Controlled invoice detail
- `/workspace/partners` — Execution partner network

### Operations
- `/workspace/exceptions` — Derived operational exception register
- `/workspace/tasks` — Cross-record task queue
- `/workspace/documents` — Controlled document register
- `/workspace/documents/templates/[slug]` — Controlled document viewer / review
- `/workspace/communications` — Communication register
- `/workspace/communications/lead/[id]` — Case communication timeline
- `/workspace/communications/project/[id]` — Project communication timeline

### Intelligence
- `/workspace/intelligence` — Management / Executive BI
- `/workspace/risk` — Risk & Compliance
- `/workspace/knowledge` — Enterprise knowledge

### Admin / shared data
- `/workspace/search` — Enterprise search
- `/workspace/notifications` — Attention Centre and message-delivery status
- `/workspace/settings` — Workspace administration
- `/workspace/settings/developer-data` — Developer-only test cleanup where permitted
- `/workspace/companies` — Master company register
- `/workspace/companies/[id]` — Company detail / relationship context

### Internal product-governance surface
- `/workspace/opds` — Overflow Partner Engineering Design System reference. This is not a day-to-day operator navigation destination; it governs visual, language and controlled-reference conventions.

## Canonical record composition

Every operating record follows this order:

1. **Record header** — customer, title, reference, owner, due date, current state.
2. **Lifecycle strip** — where the record sits, visually secondary to the decision.
3. **Decision** — readiness and the next permitted action from one canonical state model.
4. **Current work** — only the work relevant to the current stage.
5. **Controlled evidence** — summary of required documents; detailed control belongs in Documents.
6. **More context** — history, metadata and audit collapsed by default.

No record may show a green Ready state while any server-enforced transition gate is blocked.

## Register composition

Portfolio/register pages use one learned pattern:

- Product page header
- 3–4 compact operating metrics
- Filter/search bar
- Dense register
- Pagination when required
- Empty state with one useful next action

At 20–100+ records the register is the primary operating surface. Individual 360 pages are opened only when action is required.

## Semantic product states

All modules map their domain statuses into the same visual semantics:

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
4. automatically reconcile the current Server Component data;
5. preserve record context, filters and intended focus;
6. never require a manual browser refresh to make adjacent cards agree.

## Desktop behaviour

Desktop favours scan density:

- fixed navigation rail;
- 1200–1320px operating canvas;
- compact 40px controls;
- dense registers and sticky table headers;
- limited card usage;
- details remain in dedicated specialist modules.

## Mobile behaviour

Mobile is not stacked desktop:

- sticky compact product header;
- five primary destinations: Home, Acquire, Cases, Projects, Finance;
- 44px touch targets;
- portfolio tables become project cards rather than horizontally compressed columns;
- metrics collapse to 2 columns and then 1 where needed;
- lifecycle strips scroll horizontally;
- secondary context stays collapsed;
- actions remain near the decision they affect.

## Terminology contract

Preferred product language:

- **Prospect**, not lead, before qualification.
- **Case**, not Lead 360, after qualification and before Project ownership.
- **Project**, after accepted commercial work becomes delivery-owned.
- **Assessment**, for technical / partner assessment queues.
- **Commercial control**, for authorisation and financial controls.
- **Payments**, for receivables, payables and cash movement.
- **Attention Centre**, for operational exceptions plus notification delivery.
- **Mission Control**, for the home operating dashboard.

Technical database and route names such as `leads` can remain for backwards compatibility but must not leak into operator-facing language.

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

New feature work must use the shared `ProductUI` primitives and the final commercial SaaS stylesheet before introducing a new page-specific visual system.
