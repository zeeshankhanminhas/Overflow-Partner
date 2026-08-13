# Operator Journey Compression Sprint

Status: **Implementation sprint**
Branch: `sprint/operator-journey-compression`

## Purpose

Make Overflow Partner learnable through the business journey rather than through memorising application topology.

The operator should primarily remember:

**Mission Control → Enquiry / Case / Project → Current state → Next permitted action**

Supporting functions such as Documents, Messages, Payments, Commercial detail, Partner activity, audit and historical evidence must remain available without forcing the operator to navigate across multiple primary and child pages for routine work.

This sprint does **not** flatten the product into one giant page. It introduces deliberate interaction depth through dialogs, drawers / slide-overs, focused work windows and disclosures so that complexity is available when needed but does not dominate the primary surface.

This sprint must conform to:

- `workspace-ux-constitution.md`
- `UX_UI_PARITY_CONSTITUTION.md`
- `UI_LANGUAGE_CONSTITUTION.md`
- `GLOBAL_STATE_PRESENTATION_CONSTITUTION.md`
- `PRIMARY_NAV_PRODUCT_CONTRACT.md`
- `BUSINESS_LIFECYCLE_CONSTITUTION.md`

No lifecycle authority, financial gate, document-control rule, security rule or Supabase integrity constraint is weakened by this work.

---

## Operator-memory target

A trained operator should be able to work productively after a few days without memorising a route map.

The normal mental model is:

1. **Mission Control** — what needs attention?
2. **Enquiry** — qualify work before Case creation.
3. **Case 360** — establish technical and commercial basis and secure client acceptance.
4. **Project 360** — deliver accepted work through payment, Partner execution, internal review, client delivery and closeout.
5. **Approvals** — authority decisions that are explicitly waiting for the operator.

Everything else is supporting context, specialist control, reference or administration.

The operator must not need to remember where a database-backed function lives in order to complete the next business action.

---

## Primary rule: record first, topology second

When an operator is already inside a governed record, routine work should remain anchored to that record.

The record surface must answer:

- Where am I?
- What is true now?
- Who are we waiting on?
- What is blocking progression?
- What happens next?
- What evidence supports this decision?

The interface may open supporting work above or beside the record, but should not make the operator repeatedly leave the record and rediscover it.

Primary modules remain valid for cross-workspace registers and specialist work. Contextual interaction is not a replacement for global registers; it is a reduction in unnecessary navigation during record work.

---

## Interaction-depth contract

### 1. Primary record surface

Use for:

- identity
- current state
- current stage
- waiting-on owner
- readiness / blocker
- concise summary
- one governed next action
- current-stage evidence

Do not permanently expose every possible form, registry or history block.

### 2. Dialog

Use for a **short, bounded decision** that belongs to the current state.

Examples:

- approve technical scope
- approve commercial position
- request changes
- record quote acceptance
- confirm payment
- confirm Partner release
- record client outcome
- close Project

Rules:

- one decision per dialog
- concise evidence summary before commit
- clear primary and cancel action
- no hidden lifecycle authority
- no nested dialogs
- destructive / irreversible actions use an alert-style confirmation
- validation remains visible inside the dialog

### 3. Drawer / slide-over

Use for **supporting context that should not displace the primary record**.

Examples:

- current Documents
- Messages / correspondence
- Partner activity
- Payment evidence
- Commercial position
- current exceptions
- record metadata
- audit preview

Rules:

- opens from the owning record
- preserves record identity and stage in the background
- may contain read-heavy context and light actions
- never becomes a second full application shell
- close returns the operator to the same record position
- URL / deep-link support should be retained when the underlying resource needs independent access

`Slider` in this sprint means a controlled slide-over / drawer interaction, not a carousel.

### 4. Focused work window

Use for a **larger bounded task that is too rich for a dialog but does not deserve a permanent child page in the routine journey**.

Examples:

- document review and approval
- compare Partner submission with controlled scope
- internal delivery review
- quote preview / issue evidence
- finance reconciliation before closeout

A focused work window may be a large modal or route-backed overlay. It should feel like opening a task on top of the record rather than navigating into another product.

Rules:

- clear title and owning record reference
- obvious close / return action
- retains current record context
- no free-floating multi-window desktop metaphor
- no stacking more than one work window
- significant work remains directly addressable by URL where useful

### 5. Disclosure / accordion

Use for low-frequency or historical material:

- older evidence
- history
- metadata
- audit trail
- advanced settings

Do not use disclosure for the current next action or active blocker.

### 6. Full child page

Retain only where the task genuinely benefits from a dedicated surface, including:

- scalable registers / queues
- complex specialist control with substantial independent state
- long-running work requiring its own URL and navigation model
- developer / administration surfaces

A child page must not exist merely because implementation originally separated the code.

---

## Journey compression targets

### Enquiry

Normal path:

**Open Enquiry → understand current state → perform next action → wait / advance**

Compress routine technical-intake, Partner-assessment and decision interactions into the Enquiry context where practical.

External client or Partner links are treated as evidence hand-offs, not destinations the operator must memorise.

Operator language should read:

- Send technical intake
- Waiting on Client
- Send Partner assessment
- Waiting on Partner
- Review Partner response
- Create Case 360

### Case 360

Normal path:

**Technical scope → Partner assessment → Commercial position → Client Quote → acceptance → Project 360**

The operator should not need to navigate separately to global Documents, Quotes or Messages to complete ordinary Case progression.

Preferred compression:

- short approvals / confirmations → dialogs
- Documents / Messages / Partner evidence → drawers
- full document review or quote preview → focused work window
- global Quote and Document registers remain available for cross-workspace control

### Project 360

Normal path:

**Payment → Partner release → Partner execution → Internal review → Client delivery → Client review → Closeout**

Routine progression should happen from Project 360.

Preferred compression:

- payment confirmation → dialog
- Partner release / commencement control → dialog or compact work window
- Partner activity → drawer
- engineering delivery evidence → drawer leading to focused Internal Review window
- Documents → drawer / focused review window
- Messages → drawer
- Commercial position → drawer
- client delivery / outcome → dialog
- closeout finance reconciliation → focused work window

`Delivery` and `Execution` may remain technically separate routes where needed, but they should not require the operator to understand them as separate products during the normal Project journey.

---

## External-actor continuity

External token pages remain separate secure experiences:

- Client technical intake
- Partner assessment
- Partner execution
- Client invoice / payment evidence where applicable

The internal operator should see those as business hand-offs:

**Send → Waiting on X → Response received → Review**

The operator should not need to know or remember `/intake/[token]`, `/partner-review/[token]`, `/execution/[token]` or `/invoice/[token]`.

When an external actor completes work, Mission Control and the owning record should surface the next internal action directly.

---

## Navigation compression

The sprint must inspect **all navigation layers**, not only primary navigation:

- primary sidebar
- current-record sidebar context
- Project 360 horizontal navigation
- Case / Project child links
- inline links
- document links
- commercial links
- message links
- external token links
- command palette
- return links / breadcrumbs

Goals:

1. remove duplicated navigation choices
2. prevent the same function appearing as both a global destination and a routine record-level detour
3. keep cross-workspace registers available without making them mandatory for record progression
4. preserve return context automatically
5. make the current record and next action visually dominant

---

## Interaction guardrails

Compression must not become modal overload.

- Do not place every form in a modal.
- Do not create modal-inside-modal flows.
- Do not hide blockers, current state or next action.
- Do not use drawers for complex multi-step work that requires substantial space.
- Do not use a full page for a three-field confirmation.
- Escape / close behavior must be predictable.
- Keyboard focus must be trapped and restored correctly for modal surfaces.
- Back-button behavior must not lose the owning record.
- Mobile uses bottom-sheet / full-height sheet patterns where a desktop side drawer is unsuitable.
- Every interaction must still follow Action → validate → execute → refresh truth → confirmation → next permitted action.

---

## Implementation phases

### Phase 1 — Journey graph and duplication removal

- inventory every operator-reachable route and contextual link
- trace the canonical Enquiry → Case → Project journey
- identify where routine work currently forces a route change
- identify duplicate Project / record navigation
- classify each detour as keep page / dialog / drawer / focused window / disclosure
- remove duplicate navigation before adding new surface chrome

### Phase 2 — Shared interaction primitives

Introduce or standardise reusable accessible primitives for:

- Dialog
- Alert dialog
- Drawer / slide-over
- Focused work window
- contextual action launcher

Prefer the existing React / component stack and approved primitives. Do not create page-specific overlay systems.

### Phase 3 — Case 360 compression

Convert the highest-frequency Case detours first while preserving Case lifecycle behavior and evidence rules.

Success condition: a normal Case can progress from technical basis to Project creation without the operator needing to memorise global module locations.

### Phase 4 — Project 360 compression

Compress payment, Partner execution context, delivery review, client issue / outcome and closeout around Project 360.

Success condition: routine Project progression reads as one business journey, while specialist registers remain available for exception and portfolio work.

### Phase 5 — External hand-off continuity

Ensure every external invitation / submission / completion returns internally as an obvious owning-record state and next action.

### Phase 6 — Operator walkthrough acceptance

Run an end-to-end operator simulation:

**Enquiry → technical intake → Partner assessment → Case 360 → Quote → Payment → Project 360 → Partner execution → final Partner delivery → Internal Review → client delivery → client outcome → Closeout**

Acceptance test:

- Can a new operator identify the next action without knowing route names?
- Can they complete normal work without using global registers except for intentional cross-workspace tasks?
- Can they return from every supporting surface without re-finding the record?
- Do dialogs / drawers / windows reduce rather than add decision load?
- Is current state always visible before a governed action?
- Does every external wait state name the external owner and resume cleanly when evidence arrives?

---

## Definition of done

This sprint is complete when:

1. the daily journey can be taught as **Mission Control → Enquiry / Case / Project → Next action**
2. routine record work does not require memorising child-page topology
3. duplicate contextual navigation has been removed
4. dialogs, drawers and focused work windows are used consistently according to the interaction-depth contract
5. primary pages remain calm without becoming flat or information-poor
6. global registers remain available for portfolio, control and specialist jobs
7. external actor pages are represented internally as hand-offs and waiting states
8. lifecycle, security, evidence and financial controls remain unchanged or stronger
9. desktop and mobile interaction patterns are both usable
10. the full launch journey passes the operator walkthrough without a route-map cheat sheet

The objective is not fewer routes for its own sake. The objective is **less operator memory, fewer context switches, clearer next actions and richer interaction depth without loss of control**.
