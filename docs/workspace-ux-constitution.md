# Overflow Partner Workspace UX Constitution

Status: **Frozen baseline**

This document is the source of truth for workspace information architecture and interaction design. Feature implementation must conform to it. Do not invent a new page composition during implementation; amend this constitution deliberately first if the product model genuinely changes.

Interaction-depth details are normative in `docs/WORKSPACE_INTERACTION_ARCHITECTURE.md`.

## Governing SaaS principles

1. **Outcome-based structure** — group surfaces around user jobs, not database tables.
2. **Clear taxonomy** — use real business language and remove implementation terminology from operator-facing UI.
3. **Flat predictable navigation** — deep hierarchy only where lifecycle context requires it.
4. **Search and filtering are architecture** — registers and heavy datasets must remain findable at scale.
5. **Role-aware visibility** — navigation and actions should reflect governance permissions rather than merely failing after entry.
6. **Fast time-to-value** — surfaces should expose the current job and next meaningful action quickly.
7. **Progressive disclosure** — current truth first; history, metadata, older evidence and advanced controls second.
8. **Consistent feedback** — every governed action must explain what changed and what can happen next.
9. **Workflow transparency** — blockers, automation, audit and state transitions must be understandable.
10. **Modular scalability** — reuse canonical components instead of inventing page-specific interaction models.

## The four surface families

### 1. Control / Overview
Purpose: understand business state and attention.
Examples: Dashboard, Acquisition Overview, Commercial Control, Executive Intelligence.

### 2. Register / Queue
Purpose: find, filter and prioritise records.
Examples: Prospects, Cases, Projects, Documents, Partner Review.

### 3. Record Workspace
Purpose: perform governed work on one primary object.
Examples: Acquisition Record, Case 360, Project 360, Invoice, Risk.

### 4. System / Utility
Purpose: cross-workspace findability, communication and configuration.
Examples: Search, Communications, Notifications, Settings.

A page must belong to one family. Do not mix the composition rules of multiple families on one surface.

## Global workspace structure

- **Left rail:** navigation and lifecycle orientation only.
- **Top bar:** search, notifications and identity/system tools.
- **Main work area:** one primary business object or one clearly bounded control/register purpose.
- **Contextual links:** preserve originating Case, Project or financial context across modules.

### Interaction grammar

The workspace follows one global rule:

> **Navigate to choose work. Stay in context to do work.**

Use the canonical interaction type by operator intent:

- **Page** — change operating area or primary business object.
- **Drawer** — inspect supporting context without leaving the current job.
- **Decision Dialog** — make one bounded decision with one business outcome.
- **Work Window** — perform substantial work while remaining anchored to the owning record/register.
- **Disclosure** — reveal only short, low-frequency local detail.

Maximum interaction depth is one active layer above the primary page. Do not stack drawer → modal → dialog → viewer.

Do not move record identity, current state, current owner/waiting-on actor, current blockers, next action or current evidence into secondary surfaces merely to make a page shorter.

### Navigation taxonomy

- Overview
  - Dashboard
  - Notifications
- Business lifecycle
  - Acquire
  - Assess
  - Commercial
  - Deliver
  - Close
- Business control
  - Commercial Control
  - Risk & Compliance
  - Executive Intelligence
- Knowledge
  - Documents
  - Communications
  - Search
  - Knowledge Library
- System
  - Partners
  - Settings

No duplicate destinations under different headings.

## Canonical Record Workspace

Every governed record follows this hierarchy:

1. **Page header**
   - Record / type
   - Reference
   - Customer / subject
   - Current state
   - Owner
2. **Stage / state strip**
   - Where this record sits
3. **Context actions**
   - Messages
   - History
   - Older evidence
   - Metadata
   - Audit
   - Open as drawers when needed; do not consume the main work surface
4. **Decision**
   - Readiness
   - Next permitted action
   - Record summary
5. **Current work**
   - Work relevant to the current governed state
   - Do not show unrelated forms merely because data exists
6. **Controlled evidence**
   - Evidence relevant to progression now

Above the fold should answer:

- Where am I?
- What is true?
- What is blocking progression?
- What should I do next?

## Register / Queue composition

1. Header and purpose
2. Search
3. Contextual filters / segments
4. Rows representing records
5. Pagination / scalable retrieval

A row shows only information needed to identify and prioritise the record: reference/name, customer, state, owner, age/blocker and next action where useful.

Registers must not contain full record workflows or large embedded forms.

Where basic prioritisation requires more context, use:

`Register row → Inspect drawer → deliberate Open of authoritative record`

Do not force navigation merely to answer what state the record is in, who owns the next move, why it is blocked or what basic evidence/financial position exists.

## Control / Overview composition

1. Header and business question
2. Key signals
3. Attention queue / exceptions
4. Relevant trend or distribution
5. Inspect context where useful
6. Drill-through to the underlying register or record when action is required

Control surfaces explain and direct. They do not absorb the detailed workflow of every object they report on.

## Object boundaries

- **Prospect:** pre-case acquisition and qualification.
- **Case:** technical/commercial governance before delivery commitment.
- **Quote:** controlled client offer.
- **Project:** delivery execution.
- **Document:** governed evidence.
- **Invoice:** client receivable.
- **Partner payable:** execution-partner liability.
- **Risk:** governed exposure/mitigation.

Do not make one object page become the registry or control centre for another object family.

## Lifecycle hand-offs

Successful transitions preserve object identity and carry the operator forward:

- Prospect conversion → newly created **Case 360**.
- Accepted quote → newly created **Project 360**.
- Project financial action → project-scoped **Commercial Control** state.
- Controlled document opened from Case/Project → preserve return context.
- Closeout → unified delivery, financial and evidence readiness before Closed.

Never require the user to re-find a record they were already working on.

## Terminology

Use nouns for objects, verbs for actions and statuses for state.

### Preferred objects
Prospect, Technical Intake, Case, Project, Quote, Invoice, Document, Partner, Risk.

### Preferred actions
Send technical intake, Approve technical scope, Record partner review, Generate client quote, Issue quotation, Authorise execution, Record payment, Close project.

### Avoid
Implementation labels such as “Step 2”, vague action labels where a governed verb is available, and internal table/schema terminology.

## Progressive disclosure rules

Always visible:
- identity
- state
- readiness/blocker
- next action
- concise summary

Contextually visible:
- current-stage forms
- current evidence
- current activities

Drawer / secondary context:
- messages not required for the current decision
- older evidence
- long history
- metadata
- audit

Work Window:
- substantial review or data-entry work that would otherwise create a routine child-page journey

Availability of information does not imply permanent visibility.

## Component rule

Every card or panel has one job only:
- Status
- Decision
- Evidence
- Input
- Queue
- History
- Intelligence

If a component performs several of these jobs, split it or move secondary information behind the correct interaction surface.

Do not create domain-specific popup primitives such as `ProjectDrawer` or `PaymentsModal`. Put domain content inside the canonical `WorkspaceDrawer`, `DecisionDialog` or `WorkWindow`.

## Feedback and continuity

Every governed action follows:

Action → validate → execute → refresh truth → close successful bounded interaction → show local confirmation → focus changed object → explain new state → expose next permitted action.

Failures must explain why, keep the relevant interaction available for correction, focus the offending state/field where possible and provide recovery guidance.

## Mobile constitution

Mobile is not desktop stacked vertically.

Priority order:
1. Record identity
2. Current state
3. Next permitted action
4. Readiness
5. Current work
6. Evidence
7. More context

Desktop Drawer / Dialog / Work Window geometry becomes an appropriate full-screen mobile surface while preserving the same semantic interaction type. Sticky actions must not obscure the content they affect.

## Stability rule: 80% compliance

If an existing page is at least 80% compliant with this constitution, do **not** redesign it. Correct only the specific violations.

During stabilisation:
- no new feature work
- no new cockpit philosophy
- no speculative visual redesign
- no duplicate routes
- no new component pattern where an approved shared pattern exists

Interaction compression is not permission to change business ownership, lifecycle authority, payment logic or document governance.

## Review test for every change

Before merging a workspace change, answer:

1. What is the primary user outcome?
2. What is the primary object?
3. What is the current state?
4. What is the next permitted action?
5. What must remain visible?
6. What should be disclosed only when needed?
7. Is this a Page, Drawer, Decision Dialog, Work Window or Disclosure — and why?
8. Does this duplicate another operating surface?
9. Does navigation preserve the user’s context?
10. Will this remain understandable with 100x more records?
11. Does this comply with the frozen composition family and `WORKSPACE_INTERACTION_ARCHITECTURE.md`?

If those questions cannot be answered cleanly, stop and resolve the IA before implementing the UI.
