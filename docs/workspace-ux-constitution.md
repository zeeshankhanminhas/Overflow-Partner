# Overflow Partner Workspace UX Constitution

Status: **Frozen baseline**

This document is the source of truth for workspace information architecture and interaction design. Feature implementation must conform to it. Do not invent a new page composition during implementation; amend this constitution deliberately first if the product model genuinely changes.

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
3. **Decision**
   - Readiness
   - Next permitted action
   - Record summary
4. **Current work**
   - Work relevant to the current governed state
   - Do not show unrelated forms merely because data exists
5. **Controlled evidence**
   - Evidence relevant to progression now
6. **More context** — collapsed by default
   - History
   - Older documents
   - Metadata
   - Audit

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

## Control / Overview composition

1. Header and business question
2. Key signals
3. Attention queue / exceptions
4. Relevant trend or distribution
5. Drill-through to the underlying register or record

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

Collapsed / secondary:
- older evidence
- long history
- metadata
- audit
- advanced configuration

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

If a component performs several of these jobs, split it or move secondary information behind disclosure.

## Feedback and continuity

Every governed action follows:

Action → validate → execute → refresh truth → show local confirmation → focus changed object → explain new state → expose next permitted action.

Failures must explain why, focus the offending state/field where possible and provide recovery guidance.

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

Desktop-only secondary detail should remain collapsed on mobile. Sticky actions must not obscure the content they affect.

## Stability rule: 80% compliance

If an existing page is at least 80% compliant with this constitution, do **not** redesign it. Correct only the specific violations.

During stabilisation:
- no new feature work
- no new cockpit philosophy
- no speculative visual redesign
- no duplicate routes
- no new component pattern where an approved shared pattern exists

## Review test for every change

Before merging a workspace change, answer:

1. What is the primary user outcome?
2. What is the primary object?
3. What is the current state?
4. What is the next permitted action?
5. What must remain visible?
6. What should be disclosed only when needed?
7. Does this duplicate another operating surface?
8. Does navigation preserve the user’s context?
9. Will this remain understandable with 100x more records?
10. Does this comply with the frozen composition family?

If those questions cannot be answered cleanly, stop and resolve the IA before implementing the UI.
