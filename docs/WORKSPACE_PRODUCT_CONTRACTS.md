# Overflow Partner — Workspace Product Contracts

**Status: Normative and authoritative for workspace frontend behaviour**

This document governs the commercial operator experience of the Overflow Partner workspace. It does not redefine lifecycle authority, database state, RLS, document governance or financial controls.

The product uses exactly four reusable page surfaces, seven frontend contracts and five CRM/business relationship contracts. New pages or components must fit these rules rather than create a new design language.

## Four canonical surfaces

### Dashboard
Mission Control only. Answers: **What needs attention now?**

### Record
Case 360 and Project 360. Answers: **What is happening with this record, who owns the next move, what evidence exists, and what can I do?**

### Register
Projects, Opportunities, Documents, Quotes, Payments and comparable collections. Answers: **What records exist, what state are they in, and which one needs action?**

### Decision
Approvals, commercial review, document review and bounded authority decisions. Answers: **What am I deciding, what evidence supports it, what is the consequence, and what actions are permitted?**

Drawers, dialogs, work windows, forms, notifications, inspectors and activity panels are interaction components, not additional surfaces.

---

# 1. Filter Contract

Filters exist to reduce a real working queue. Do not expose database fields simply because they can be filtered.

Use only the dimensions useful to the current operating job:

- Status / operating state
- Stage
- Age: <24h, 1–3d, 3–7d, >7d, >30d where meaningful
- Due: overdue, today, this week, next 30 days
- Owner: me, unassigned, named owner
- Waiting on: client, Execution Partner, internal
- Exception / blocker
- Commercial state
- Search

Rules:

1. Filter state should be URL-addressable where practical so it survives refresh, back navigation and sharing.
2. Selecting a simple scope/filter must not require a redundant **Apply** button.
3. Always provide a clear path back to the unfiltered view.
4. Show only filters that materially reduce the current queue.
5. Search is part of the filter system, not a separate page decoration.
6. Saved/personal views may be introduced only after the underlying filter contract is stable.

Canonical UI: `ProductFilterBar`, `ProductFilterGroup`.

---

# 2. Register Contract

A register is a productivity surface for finding, prioritising and opening records.

Desktop anatomy:

`# | Object | State | Owner | Due/Age | Business context | Next action | More`

A domain may omit columns that do not help the operator, but column order and visual hierarchy should remain familiar.

Rules:

1. Business reference remains authoritative; optional serial numbering is only a scanning/discussion aid.
2. First column identifies the object strongly.
3. Status, due/age and next action are visually scannable.
4. Currency and numeric values use tabular figures and align consistently.
5. Long registers use sticky headers where the scroll container supports it.
6. Sorting should be introduced for columns where it changes prioritisation.
7. Pagination/scalable retrieval is required for large collections.
8. Bulk selection exists only for genuine batch work.
9. Row actions show one expected action plus Inspect/More rather than every possible action.
10. Mobile preserves priority: Object → State → Due/Age → Next action; secondary metadata moves behind Inspect.
11. Returning from a record should preserve filter, page and scroll context where technically practical.

Canonical UI: `ProductRegister`, `ProductRegisterRow`.

---

# 3. Action Contract

Action styling communicates consequence, not decoration.

Canonical action meanings:

- **Primary** — expected next operator action
- **Secondary** — inspect, navigate, neutral utility
- **Approve** — governed positive decision
- **Warning** — consequential but non-destructive intervention
- **Destructive** — withdraw, delete, irreversible negative action

Rules:

1. One governed next action has primary visual weight.
2. Use specific business verbs from `UI_LANGUAGE_CONSTITUTION.md`.
3. Impossible actions are hidden; temporarily unavailable actions may be disabled only when the reason is useful and visible.
4. Reversible actions prefer success + Undo over unnecessary confirmation.
5. Confirmation/dialogs are reserved for consequential, externally visible, financial or irreversible actions.
6. Administrative/rare actions live under More rather than competing with routine work.

Canonical UI: `ProductActionLink` and governed interaction primitives.

---

# 4. Information Contract

Every visible item must help the operator **recognise, decide, act or verify**.

Rules:

1. Page header: business area/eyebrow → title → optional one-line business context → actions.
2. Do not permanently explain how drawers, dialogs, registers or workflow mechanics work.
3. Section headings describe the business content, not the component type.
4. Use exactly three visual levels: canvas → panel → inset group.
5. Current state and next action outrank history and metadata.
6. Zero/empty information is omitted unless it reassures a current decision.
7. Help/tutorial material belongs in onboarding/help surfaces, not repeated under every heading.
8. Executive surfaces show decision-changing management information, not generic KPI-card inflation.
9. Role-aware interfaces should not display irrelevant controls merely because backend security would reject them.

Language authority remains `UI_LANGUAGE_CONSTITUTION.md`.

---

# 5. Time Contract

Time has two different meanings and must not be conflated.

**Operational age** answers: *How long has this been waiting?*  
Examples: `45m`, `6h`, `4d`, `12d`.

**Absolute date** answers: *When is/was the contractual or recorded event?*  
Examples: `30 Aug 2026`, invoice due date, committed delivery date.

Rules:

1. Use age in queues where delay changes priority.
2. Use absolute dates for commitments, evidence and financial/legal facts.
3. Overdue is a state, not just red text.
4. Aging thresholds escalate restrainedly; normal waiting is not automatically a blocker.
5. Calendar/agenda views are introduced only where date relationships are operationally useful: project delivery, task planning and commercial due dates are valid candidates.
6. Do not add calendars to modules with no genuine time-planning job.

Canonical UI: `ProductAge`, `ProductDate`.

---

# 6. Interaction & Continuity Contract

Governing rule: **Navigate to choose work. Stay in context to do work.**

Canonical interactions:

- Page — change operating area or primary object
- Drawer — inspect supporting context
- Decision Dialog — one bounded decision
- Work Window — substantial controlled work
- Disclosure — short local low-frequency detail

Rules:

1. One active interaction layer above the page; never stack drawer → dialog → viewer chains.
2. Preserve originating record/filter context when navigating away and back.
3. A routine action should refresh local truth rather than force unnecessary route changes.
4. Search/command navigation should resolve business objects by reference/name and group results by object type.
5. Notifications report that something changed; work queues report that something requires action. Do not duplicate the same work in both.
6. Forms use logical grouping, sensible defaults, inline validation, appropriate input types and preserve entered values on recoverable errors.
7. Mobile changes geometry, not semantic interaction type.
8. Related business objects remain inspectable and navigable from the work that owns them; the operator must not have to search again for a company, contact, Case, Quote, Project, invoice, document or Partner already visible in context.

Canonical interaction primitives remain in `components/workspace/InteractionSurface.tsx`.

---

# 7. System Feedback & Accessibility Contract

The product must always make system state understandable without exposing infrastructure details.

Rules:

1. Every governed action follows: validate → execute → refresh truth → confirm result → expose next permitted action.
2. Errors state what happened and what the operator can do next; raw Supabase/Postgres/RPC language is not primary UI.
3. Loading/skeleton states resemble the final surface and do not reintroduce legacy dark-theme assumptions.
4. Focus states are visible and keyboard navigation remains usable.
5. Status is never communicated by colour alone; text remains authoritative.
6. Interactive controls have accessible names and meaningful native semantics where practical.
7. Mobile tap targets remain usable and sticky controls do not cover content.
8. Respect reduced-motion preferences.
9. Disabled controls remain perceivable and explain why when that explanation helps recovery.
10. Success, warning, blocked and critical feedback use stable semantic treatment across modules.

---

# CRM / Business Relationship Contracts

These contracts govern how companies, people and commercial relationships behave inside the four product surfaces. They do not create additional surface types.

## CRM 1. Relationship Contract

Company, Contact, Enquiry, Case, Quote, Project, Invoice, Document, Communication and Execution Partner are related business objects, not isolated routes.

Rules:

1. If a visible object has an authoritative record, its name/reference is inspectable or openable.
2. Relationship navigation is contextual and scoped to the current object; Company 360 links to that company's work, not a generic global register where a scoped view is available.
3. Record surfaces expose the core relationship chain without duplicating lifecycle state.
4. Inspect supporting context in a drawer first; open the authoritative record when deeper work is required.
5. Historical relationships remain stable even when a contact later changes employer or role.

## CRM 2. Contact Role Contract

A person and their role in a piece of work are separate concepts.

Canonical roles include:

- Primary relationship contact
- Technical contact
- Commercial contact
- Quote recipient
- Billing contact
- Project contact
- Delivery reviewer
- Final approver

Rules:

1. One contact may hold several roles.
2. Roles belong to the company/work relationship, not permanently to the person.
3. External actions identify the actual recipient person, role and address before execution.
4. Generic labels such as `Client` may describe responsibility, but must not replace recipient identity where a communication or decision depends on a person.
5. Until dedicated relationship-role persistence is introduced, existing Case/Lead `contact_id` is the authoritative primary contact and contextual recipient fields remain transaction evidence.

## CRM 3. Communication Contract

Every external communication must be attributable and observable.

Minimum communication evidence:

- Recipient name
- Recipient address
- Company/party
- Purpose/scenario
- Related business object
- Queue/sent/failure state where available
- Timestamp
- Retry path when delivery fails

Rules:

1. Workflow state must never imply successful communication when notification queuing/delivery failed silently.
2. Externally visible actions show who will receive the communication before execution.
3. After execution, the owning record shows recipient and communication evidence when available.
4. Reminder, notification and work-queue concepts remain distinct.
5. Communication history is supporting evidence, not the primary source of lifecycle truth.

## CRM 4. Account Context Contract

Company 360 is the commercial relationship context, not another workflow engine.

It should answer:

1. Who is this company?
2. Who do we deal with?
3. What active and historical business do we have with them?
4. What is the current commercial position?
5. What needs attention?
6. What happened recently?

Company 360 may aggregate Contacts, Enquiries, Cases, Quotes, Projects, invoices/receivables, Documents and recent activity. Decisions and governed work remain in their authoritative records.

## CRM 5. Data Stewardship Contract

CRM master data must remain trustworthy over time.

Rules:

1. Email is normalised before duplicate comparison where practical.
2. Creation flows should warn/block obvious duplicate contacts rather than silently create parallel identities.
3. Companies and contacts with historical work are not hard-deleted merely because they become inactive.
4. Historical transactions retain the recipient/company identity recorded at the time.
5. Missing recipient data blocks external communication that requires it.
6. Source/provenance of identity should remain traceable where available: enquiry, manual entry, import or transaction evidence.
7. Future merge tooling must preserve references and audit history rather than delete one side of a relationship.

---

# File Identity & Attachment Presentation

File links must communicate what the operator is about to open.

Rules:

1. Any visible attached/generated file uses a compact SVG/type thumbnail plus filename/title; do not present an unexplained bare link where the type can be inferred.
2. Thumbnail identity is derived from extension or controlled document type and remains text-labelled (`PDF`, `DWG`, `DOC`, `XLS`, `IMG`, `ZIP`, etc.) so colour is not the only cue.
3. Controlled documents may use their business document type when no physical extension is available.
4. File thumbnails are presentation aids only; document reference/revision/status remain authoritative.

Canonical UI: `components/workspace/FileTypeThumbnail.tsx`.

---

# Contract precedence and overlap resolution

The repository previously contained several overlapping UX/presentation documents. Their useful rules are consolidated here or remain in narrower domain documents as follows:

| Previous document | Resolution |
| --- | --- |
| `PRODUCT-SURFACE-SYSTEM.md` | Superseded. Its four-surface rules are incorporated here. |
| `workspace-ux-constitution.md` | Superseded. Its register, progressive disclosure, mobile, continuity and interaction rules are incorporated here. Its old `System / Utility` fourth surface conflicted with the approved `Decision` surface and is retired. |
| `UX_UI_PARITY_CONSTITUTION.md` | Superseded. Current-state, next-action, evidence provenance and mobile-priority rules are incorporated here. |
| `WORKSPACE_INTERACTION_ARCHITECTURE.md` | Remains normative for detailed drawer/dialog/work-window mechanics. This document owns the higher-level Interaction & Continuity contract. |
| `UI_LANGUAGE_CONSTITUTION.md` | Remains normative for nouns, verbs, stage labels, blocker language and microcopy. |
| `GLOBAL_STATE_PRESENTATION_CONSTITUTION.md` | Remains normative for `domain truth → canonical presentation state → UI`; presentation CSS references must point to the current canonical system. |
| `BUSINESS_LIFECYCLE_CONSTITUTION.md` | Remains the authority for business lifecycle and permitted transitions. Frontend contracts cannot override it. |
| `GLOBAL_STATE_PRESENTATION_MATRIX.md` | Remains a validation matrix, not a competing UX contract. |

## Implementation authority

- Surface types: `components/workspace/ProductSurface.tsx` + `app/workspace/product-surfaces.css`
- Product primitives: `components/workspace/ProductUI.tsx`
- Presentation contracts: `app/workspace/workspace-presentation-system.css`
- Interaction mechanics: `components/workspace/InteractionSurface.tsx` + `app/workspace/interaction-surfaces.css`
- Business presentation state: `lib/presentation/`
- CRM relationship presentation: Company/Contact master records + scoped drawers/links on owning records
- File identity: `components/workspace/FileTypeThumbnail.tsx`

## Change-control rule

Before changing a workspace page, classify the change against one of the seven contracts or five CRM relationship contracts. If it does not belong to a contract and does not fix an accessibility/security defect or implement a genuine product capability, do not create a new presentation pattern.

Do not add `*-polish.css`, `*-wave.css`, `*-parity.css`, `*-canonical-v2.css` or similar rescue layers. Modify the authoritative primitive/contract instead.
